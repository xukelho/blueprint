using Blueprint.Api.Data;
using Blueprint.Api.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Blueprint.Api.Services;

public interface IFileService
{
    Task<PendingUpload> CreatePendingUploadAsync(long projectId, long phaseId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default);
    Task CompleteUploadAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default);
    Task<PresignedDownloadGrant> CreateDownloadGrantAsync(Guid documentId, CancellationToken cancellationToken = default);
    Task MoveAsync(Guid documentId, long targetPhaseId, long actorId, CancellationToken cancellationToken = default);
    Task<PendingReplacement> CreateReplacementUploadAsync(Guid documentId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default);
    Task CompleteReplacementAsync(Guid documentId, Guid replacementObjectId, long actorId, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default);
}

public sealed record PendingUpload(Guid DocumentId, Guid StoredObjectId, PresignedUploadGrant Grant);
public sealed record PendingReplacement(Guid StoredObjectId, PresignedUploadGrant Grant);

public sealed class FileService(BlueprintDbContext db, IObjectStore objectStore, IOptions<ObjectStorageOptions> options, TimeProvider timeProvider) : IFileService
{
    private readonly ObjectStorageOptions _options = options.Value;

    public async Task<PendingUpload> CreatePendingUploadAsync(long projectId, long phaseId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default)
    {
        ValidateUpload(fileName, contentType, length);
        if (!await db.ProjectPhases.AnyAsync(phase => phase.Id == phaseId && phase.ProjectId == projectId, cancellationToken))
            throw new FileDomainException("The phase does not belong to the project.");

        var storedObject = NewPendingObject(projectId, fileName, contentType, length, actorId);
        var now = timeProvider.GetUtcNow();
        var document = new ProjectDocument
        {
            Id = Guid.NewGuid(), ProjectId = projectId, PhaseId = phaseId, StoredObjectId = storedObject.Id,
            CreatedAt = now, UpdatedAt = now, CreatedBy = actorId, UpdatedBy = actorId
        };
        db.StoredObjects.Add(storedObject);
        db.ProjectDocuments.Add(document);
        await db.SaveChangesAsync(cancellationToken);
        try
        {
            return new PendingUpload(document.Id, storedObject.Id,
                await objectStore.CreateUploadGrantAsync(storedObject.ObjectKey, contentType, _options.UploadGrantLifetime, cancellationToken));
        }
        catch
        {
            db.ProjectDocuments.Remove(document);
            db.StoredObjects.Remove(storedObject);
            await db.SaveChangesAsync(cancellationToken);
            throw;
        }
    }

    public async Task CompleteUploadAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default)
    {
        var document = await db.ProjectDocuments.Include(candidate => candidate.StoredObject)
            .SingleOrDefaultAsync(candidate => candidate.Id == documentId && !candidate.IsDeleted, cancellationToken)
            ?? throw new FileDomainException("Document not found.");
        await VerifyPendingObjectAsync(document.StoredObject!, actorId, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PresignedDownloadGrant> CreateDownloadGrantAsync(Guid documentId, CancellationToken cancellationToken = default)
    {
        var document = await db.ProjectDocuments.AsNoTracking().Include(candidate => candidate.StoredObject)
            .SingleOrDefaultAsync(candidate => candidate.Id == documentId && !candidate.IsDeleted, cancellationToken)
            ?? throw new FileDomainException("Document not found.");
        if (document.StoredObject!.Status != StoredObjectStatus.Available)
            throw new FileDomainException("The document is not available.");
        return await objectStore.CreateDownloadGrantAsync(document.StoredObject.ObjectKey, document.StoredObject.FileName, _options.DownloadGrantLifetime, cancellationToken);
    }

    public async Task MoveAsync(Guid documentId, long targetPhaseId, long actorId, CancellationToken cancellationToken = default)
    {
        var document = await db.ProjectDocuments.SingleOrDefaultAsync(candidate => candidate.Id == documentId && !candidate.IsDeleted, cancellationToken)
            ?? throw new FileDomainException("Document not found.");
        if (!await db.ProjectPhases.AnyAsync(phase => phase.Id == targetPhaseId && phase.ProjectId == document.ProjectId, cancellationToken))
            throw new FileDomainException("The target phase does not belong to the project.");
        document.PhaseId = targetPhaseId;
        Touch(document, actorId);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PendingReplacement> CreateReplacementUploadAsync(Guid documentId, string fileName, string contentType, long length, long actorId, CancellationToken cancellationToken = default)
    {
        ValidateUpload(fileName, contentType, length);
        var projectId = await db.ProjectDocuments.Where(candidate => candidate.Id == documentId && !candidate.IsDeleted)
            .Select(candidate => (long?)candidate.ProjectId).SingleOrDefaultAsync(cancellationToken)
            ?? throw new FileDomainException("Document not found.");
        var storedObject = NewPendingObject(projectId, fileName, contentType, length, actorId);
        db.StoredObjects.Add(storedObject);
        await db.SaveChangesAsync(cancellationToken);
        try
        {
            return new PendingReplacement(storedObject.Id,
                await objectStore.CreateUploadGrantAsync(storedObject.ObjectKey, contentType, _options.UploadGrantLifetime, cancellationToken));
        }
        catch
        {
            db.StoredObjects.Remove(storedObject);
            await db.SaveChangesAsync(cancellationToken);
            throw;
        }
    }

    public async Task CompleteReplacementAsync(Guid documentId, Guid replacementObjectId, long actorId, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var document = await db.ProjectDocuments.Include(candidate => candidate.StoredObject)
            .SingleOrDefaultAsync(candidate => candidate.Id == documentId && !candidate.IsDeleted, cancellationToken)
            ?? throw new FileDomainException("Document not found.");
        var replacement = await db.StoredObjects.SingleOrDefaultAsync(candidate => candidate.Id == replacementObjectId && candidate.ProjectId == document.ProjectId, cancellationToken)
            ?? throw new FileDomainException("Replacement object not found.");
        if (await db.ProjectDocuments.AnyAsync(candidate => candidate.StoredObjectId == replacementObjectId, cancellationToken))
            throw new FileDomainException("Replacement object is already in use.");

        await VerifyPendingObjectAsync(replacement, actorId, cancellationToken);
        QueueDeletion(document.StoredObject!, actorId);
        document.StoredObjectId = replacement.Id;
        Touch(document, actorId);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid documentId, long actorId, CancellationToken cancellationToken = default)
    {
        var document = await db.ProjectDocuments.Include(candidate => candidate.StoredObject)
            .SingleOrDefaultAsync(candidate => candidate.Id == documentId && !candidate.IsDeleted, cancellationToken)
            ?? throw new FileDomainException("Document not found.");
        var now = timeProvider.GetUtcNow();
        document.IsDeleted = true;
        document.DeletedAt = now;
        document.DeletedBy = actorId;
        Touch(document, actorId);
        QueueDeletion(document.StoredObject!, actorId);
        await db.SaveChangesAsync(cancellationToken);
    }

    private StoredObject NewPendingObject(long projectId, string fileName, string contentType, long length, long actorId)
    {
        var id = Guid.NewGuid();
        var now = timeProvider.GetUtcNow();
        return new StoredObject
        {
            Id = id, ProjectId = projectId, ObjectKey = $"projects/{projectId}/objects/{id:N}",
            FileName = fileName.Trim(), ContentType = contentType.Trim(), ExpectedLength = length,
            Status = StoredObjectStatus.PendingUpload, UploadExpiresAt = now.Add(_options.PendingUploadLifetime),
            CreatedAt = now, UpdatedAt = now, CreatedBy = actorId, UpdatedBy = actorId
        };
    }

    private async Task VerifyPendingObjectAsync(StoredObject storedObject, long actorId, CancellationToken cancellationToken)
    {
        if (storedObject.Status != StoredObjectStatus.PendingUpload) throw new FileDomainException("The upload is not pending.");
        if (storedObject.UploadExpiresAt <= timeProvider.GetUtcNow()) throw new FileDomainException("The upload has expired.");
        var metadata = await objectStore.GetMetadataAsync(storedObject.ObjectKey, cancellationToken)
            ?? throw new FileDomainException("The uploaded object was not found.");
        if (metadata.Length != storedObject.ExpectedLength || !string.Equals(metadata.ContentType, storedObject.ContentType, StringComparison.OrdinalIgnoreCase))
            throw new FileDomainException("Uploaded object metadata does not match the pending upload.");
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
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 512) throw new FileDomainException("A valid file name is required.");
        if (string.IsNullOrWhiteSpace(contentType) || contentType.Length > 256) throw new FileDomainException("A valid content type is required.");
        if (length < 0) throw new FileDomainException("File length cannot be negative.");
    }
}

public sealed class FileDomainException(string message) : InvalidOperationException(message);
