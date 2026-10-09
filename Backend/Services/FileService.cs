using Blueprint.Api.Data;
using Blueprint.Api.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Blueprint.Api.Services;

public interface IFileService
{
    Task<PendingUpload> CreatePendingUploadAsync(long projectId, long phaseId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default);
    Task<bool> CompleteUploadAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default);
    Task<PresignedDownloadGrant> CreateDownloadGrantAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task<ProjectDocument> SetVisibilityAsync(Guid documentId, bool isVisible, long actorId, CancellationToken cancellationToken = default);
    Task<bool> MoveAsync(Guid documentId, long targetPhaseId, long actorId, CancellationToken cancellationToken = default);
    Task<PendingReplacement> CreateReplacementUploadAsync(Guid documentId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default);
    Task<bool> CompleteReplacementAsync(Guid documentId, Guid replacementObjectId, long actorId, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default, bool createNotification = true);
}

public sealed record PendingUpload(Guid DocumentId, Guid StoredObjectId, PresignedUploadGrant Grant);
public sealed record PendingReplacement(Guid StoredObjectId, PresignedUploadGrant Grant);

public sealed class FileService(BlueprintDbContext db, IObjectStore objectStore, IOptions<ObjectStorageOptions> options, TimeProvider timeProvider, IProjectNotificationService notifications, IStorageQuotaService quotas) : IFileService
{
    private readonly ObjectStorageOptions _options = options.Value;

    public async Task<PendingUpload> CreatePendingUploadAsync(long projectId, long phaseId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default)
    {
        ValidateUpload(fileName, contentType, length);
        if (!await db.ProjectPhases.AnyAsync(phase => phase.Id == phaseId && phase.ProjectId == projectId, cancellationToken))
            throw new FileResourceNotFoundException("The phase was not found.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var quota = await quotas.LockCompanyForProjectAsync(projectId, cancellationToken);
        if (quota.CurrentChargeBytes > quota.LimitBytes - length) throw new StorageQuotaExceededException();
        var storedObject = NewPendingObject(projectId, fileName, contentType, length, length, actorId);
        var now = timeProvider.GetUtcNow();
        var document = new ProjectDocument
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            PhaseId = phaseId,
            StoredObjectId = storedObject.Id,
            IsVisible = false,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = actorId,
            UpdatedBy = actorId
        };
        db.StoredObjects.Add(storedObject);
        db.ProjectDocuments.Add(document);
        await db.SaveChangesAsync(cancellationToken);
        await quotas.EvaluateWarningAsync(quota.CompanyId, actorId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        var grant = await objectStore.CreateUploadGrantAsync(storedObject.ObjectKey, contentType, length, _options.UploadGrantLifetime, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new PendingUpload(document.Id, storedObject.Id, grant);
    }

    public async Task<bool> CompleteUploadAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default)
    {
        await using var transaction = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var document = await LockActiveDocumentAsync(documentId, cancellationToken);
        if (document.StoredObject!.Status == StoredObjectStatus.Available) return false;
        await VerifyPendingObjectAsync(document.StoredObject!, actorId, cancellationToken);
        await notifications.AddAsync(new ProjectNotificationCommand(
            document.ProjectId, actorId, ProjectEventTypes.DocumentUploaded,
            $"adicionou o ficheiro «{document.StoredObject.FileName}».", NotificationTargetKinds.Document,
            $"document-uploaded:{document.Id}:{document.StoredObjectId}", document.Id,
            Context: new { document.StoredObject.FileName, document.PhaseId }, Audience: AudienceFor(document)), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<PresignedDownloadGrant> CreateDownloadGrantAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var document = await db.ProjectDocuments.AsNoTracking().Include(candidate => candidate.StoredObject)
            .SingleOrDefaultAsync(candidate => candidate.Id == documentId && !candidate.IsDeleted, cancellationToken)
            ?? throw new FileResourceNotFoundException("Document not found.");
        if (document.StoredObject!.Status != StoredObjectStatus.Available)
            throw new FileConflictException("The document is not available.");
        return await objectStore.CreateDownloadGrantAsync(document.StoredObject.ObjectKey, document.StoredObject.FileName, _options.DownloadGrantLifetime, cancellationToken);
    }

    public async Task<bool> MoveAsync(Guid documentId, long targetPhaseId, long actorId, CancellationToken cancellationToken = default)
    {
        await using var transaction = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var document = await LockActiveDocumentAsync(documentId, cancellationToken);
        if (!await db.ProjectPhases.AnyAsync(phase => phase.Id == targetPhaseId && phase.ProjectId == document.ProjectId, cancellationToken))
            throw new FileResourceNotFoundException("The target phase was not found.");
        if (document.PhaseId == targetPhaseId) return false;
        var previousPhaseId = document.PhaseId;
        document.PhaseId = targetPhaseId;
        Touch(document, actorId);
        await notifications.AddAsync(new ProjectNotificationCommand(
            document.ProjectId, actorId, ProjectEventTypes.DocumentMoved,
            "moveu um ficheiro para outra fase.", NotificationTargetKinds.Document,
            $"document-moved:{document.Id}:{document.UpdatedAt.UtcTicks}", document.Id,
            Context: new { previousPhaseId, targetPhaseId }, Audience: AudienceFor(document)), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<PendingReplacement> CreateReplacementUploadAsync(Guid documentId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default)
    {
        ValidateUpload(fileName, contentType, length);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var existing = await db.ProjectDocuments.AsNoTracking().Include(candidate => candidate.StoredObject)
            .SingleOrDefaultAsync(candidate => candidate.Id == documentId && !candidate.IsDeleted, cancellationToken)
            ?? throw new FileResourceNotFoundException("Document not found.");
        var projectId = existing.ProjectId;
        var quota = await quotas.LockCompanyForProjectAsync(projectId, cancellationToken);
        existing = await LockActiveDocumentAsync(documentId, cancellationToken);
        var reservation = Math.Max(0, length - (existing.StoredObject!.VerifiedLength ?? existing.StoredObject.ExpectedLength));
        if (quota.CurrentChargeBytes > quota.LimitBytes - reservation) throw new StorageQuotaExceededException();
        var storedObject = NewPendingObject(projectId, fileName, contentType, length, reservation, actorId);
        db.StoredObjects.Add(storedObject);
        await db.SaveChangesAsync(cancellationToken);
        await quotas.EvaluateWarningAsync(quota.CompanyId, actorId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        var grant = await objectStore.CreateUploadGrantAsync(storedObject.ObjectKey, contentType, length, _options.UploadGrantLifetime, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new PendingReplacement(storedObject.Id, grant);
    }

    public async Task<bool> CompleteReplacementAsync(Guid documentId, Guid replacementObjectId, long actorId, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var projectId = await db.ProjectDocuments.Where(item => item.Id == documentId && !item.IsDeleted)
            .Select(item => (long?)item.ProjectId).SingleOrDefaultAsync(cancellationToken)
            ?? throw new FileResourceNotFoundException("Document not found.");
        // Quota operations take the company lock before any document lock.
        var quota = await quotas.LockCompanyForProjectAsync(projectId, cancellationToken);
        var document = await LockActiveDocumentAsync(documentId, cancellationToken);
        var replacement = await db.StoredObjects.SingleOrDefaultAsync(candidate => candidate.Id == replacementObjectId && candidate.ProjectId == document.ProjectId, cancellationToken)
            ?? throw new FileResourceNotFoundException("Replacement object not found.");
        if (document.StoredObjectId == replacementObjectId && replacement.Status == StoredObjectStatus.Available) return false;
        if (await db.ProjectDocuments.AnyAsync(candidate => candidate.StoredObjectId == replacementObjectId, cancellationToken))
            throw new FileConflictException("Replacement object is already in use.");

        await VerifyPendingObjectAsync(replacement, actorId, cancellationToken);
        replacement.QuotaChargeBytes = replacement.VerifiedLength!.Value;
        document.StoredObject!.QuotaChargeBytes = 0;
        QueueDeletion(document.StoredObject!, actorId);
        document.StoredObjectId = replacement.Id;
        Touch(document, actorId);
        await notifications.AddAsync(new ProjectNotificationCommand(
            document.ProjectId, actorId, ProjectEventTypes.DocumentReplaced,
            $"substituiu o ficheiro por «{replacement.FileName}».", NotificationTargetKinds.Document,
            $"document-replaced:{document.Id}:{replacement.Id}", document.Id,
            Context: new { replacement.FileName, document.PhaseId }, Audience: AudienceFor(document)), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await quotas.EvaluateWarningAsync(quota.CompanyId, actorId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default, bool createNotification = true)
    {
        await using var transaction = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        var document = await ProjectDocumentAccessService.LockAsync(db, documentId, cancellationToken)
            ?? throw new FileResourceNotFoundException("Document not found.");
        if (document.IsDeleted) return false;
        var now = timeProvider.GetUtcNow();
        var storedObject = document.StoredObject!;
        document.IsDeleted = true;
        document.DeletedAt = now;
        document.DeletedBy = actorId;
        Touch(document, actorId);
        QueueDeletion(storedObject, actorId);
        if (createNotification)
            await notifications.AddAsync(new ProjectNotificationCommand(
                document.ProjectId, actorId, ProjectEventTypes.DocumentDeleted,
                $"eliminou o ficheiro «{storedObject.FileName}».", NotificationTargetKinds.Document,
                $"document-deleted:{document.Id}:{now.UtcTicks}", document.Id,
                Context: new { storedObject.FileName, document.PhaseId }, Audience: AudienceFor(document)), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<ProjectDocument> SetVisibilityAsync(Guid documentId, bool isVisible, long actorId, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var document = await LockActiveDocumentAsync(documentId, cancellationToken);
        if (await db.Projects.AnyAsync(item => item.Id == document.ProjectId && item.IsArchived, cancellationToken))
            throw new FileConflictException("Archived projects are read-only.");
        if (document.StoredObject!.Status != StoredObjectStatus.Available)
            throw new FileConflictException("The document is not available.");
        if (document.IsVisible == isVisible)
        {
            await transaction.CommitAsync(cancellationToken);
            return document;
        }

        document.IsVisible = isVisible;
        Touch(document, actorId);
        var verb = isVisible ? "adicionou" : "removeu";
        await notifications.AddAsync(new ProjectNotificationCommand(
            document.ProjectId, actorId, isVisible ? ProjectEventTypes.DocumentAdded : ProjectEventTypes.DocumentRemoved,
            $"{verb} o ficheiro «{document.StoredObject.FileName}».", NotificationTargetKinds.Document,
            $"document-visibility:{document.Id}:{Guid.NewGuid():N}", document.Id,
            Context: new { document.StoredObject.FileName, document.PhaseId }, Audience: ProjectNotificationAudience.ClientsOnly), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return document;
    }

    private async Task<ProjectDocument> LockActiveDocumentAsync(Guid documentId, CancellationToken ct)
    {
        var document = await ProjectDocumentAccessService.LockAsync(db, documentId, ct);
        if (document is null || document.IsDeleted) throw new FileResourceNotFoundException("Document not found.");
        return document;
    }

    private static ProjectNotificationAudience AudienceFor(ProjectDocument document) =>
        document.IsVisible ? ProjectNotificationAudience.AllParticipants : ProjectNotificationAudience.EmployeesOnly;

    private StoredObject NewPendingObject(long projectId, string fileName, string contentType, long length, long quotaChargeBytes, long actorId)
    {
        var id = Guid.NewGuid();
        var now = timeProvider.GetUtcNow();
        return new StoredObject
        {
            Id = id,
            ProjectId = projectId,
            ObjectKey = $"projects/{projectId}/objects/{id:N}",
            FileName = fileName.Trim(),
            ContentType = contentType.Trim(),
            ExpectedLength = length,
            QuotaChargeBytes = quotaChargeBytes,
            Status = StoredObjectStatus.PendingUpload,
            UploadExpiresAt = now.Add(_options.PendingUploadLifetime),
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = actorId,
            UpdatedBy = actorId
        };
    }

    private async Task VerifyPendingObjectAsync(StoredObject storedObject, long actorId, CancellationToken cancellationToken)
    {
        if (storedObject.Status != StoredObjectStatus.PendingUpload) throw new FileConflictException("The upload is not pending.");
        if (storedObject.UploadExpiresAt <= timeProvider.GetUtcNow()) throw new FileConflictException("The upload has expired.");
        var metadata = await objectStore.GetMetadataAsync(storedObject.ObjectKey, cancellationToken)
            ?? throw new FileConflictException("The uploaded object was not found.");
        if (metadata.Length != storedObject.ExpectedLength || !string.Equals(metadata.ContentType, storedObject.ContentType, StringComparison.OrdinalIgnoreCase))
            throw new FileConflictException("Uploaded object metadata does not match the pending upload.");
        storedObject.Status = StoredObjectStatus.Available;
        storedObject.VerifiedLength = metadata.Length;
        storedObject.ETag = metadata.ETag;
        storedObject.UploadedAt = timeProvider.GetUtcNow();
        storedObject.UpdatedAt = timeProvider.GetUtcNow();
        storedObject.UpdatedBy = actorId;
        storedObject.LastStorageError = null;
        storedObject.RetryAfter = null;
    }

    private void QueueDeletion(StoredObject storedObject, long actorId)
    {
        if (storedObject.Status == StoredObjectStatus.Deleted) return;
        storedObject.Status = StoredObjectStatus.DeletionPending;
        storedObject.DeletionRequestedAt ??= timeProvider.GetUtcNow();
        storedObject.RetryAfter = timeProvider.GetUtcNow();
        storedObject.UpdatedAt = timeProvider.GetUtcNow();
        storedObject.UpdatedBy = actorId;
    }

    private void Touch(ProjectDocument document, long actorId)
    {
        document.UpdatedAt = timeProvider.GetUtcNow();
        document.UpdatedBy = actorId;
    }

    private static void ValidateUpload(string fileName, string contentType, long length)
    {
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 512) throw new FileValidationException("A valid file name is required.", "fileName");
        if (string.IsNullOrWhiteSpace(contentType) || contentType.Length > 256) throw new FileValidationException("A valid content type is required.", "contentType");
        if (length < 0) throw new FileValidationException("File length cannot be negative.", "length");
    }
}

public abstract class FileDomainException(string message) : InvalidOperationException(message);
public sealed class FileValidationException(string message, string field) : FileDomainException(message)
{
    public string Field { get; } = field;
}
public sealed class FileResourceNotFoundException(string message) : FileDomainException(message);
public class FileConflictException(string message) : FileDomainException(message);
