using Blueprint.Api.Data;
using Blueprint.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Services;

public sealed class FileMaintenanceProcessor(BlueprintDbContext db, IObjectStore objectStore, TimeProvider timeProvider, ILogger<FileMaintenanceProcessor> logger)
{
    public async Task<int> ProcessBatchAsync(int batchSize = 50, CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow();
        var expired = await db.StoredObjects
            .Where(candidate => candidate.Status == StoredObjectStatus.PendingUpload && candidate.UploadExpiresAt <= now)
            .OrderBy(candidate => candidate.UploadExpiresAt).Take(batchSize).ToListAsync(cancellationToken);
        foreach (var storedObject in expired)
        {
            storedObject.Status = StoredObjectStatus.DeletionPending;
            storedObject.DeletionRequestedAt = now;
            storedObject.RetryAfter = now;
            foreach (var document in await db.ProjectDocuments.Where(candidate => candidate.StoredObjectId == storedObject.Id && !candidate.IsDeleted).ToListAsync(cancellationToken))
            {
                document.IsDeleted = true;
                document.DeletedAt = now;
                document.DeletedBy = AuditActors.System;
                document.UpdatedAt = now;
                document.UpdatedBy = AuditActors.System;
            }
        }
        await db.SaveChangesAsync(cancellationToken);

        var candidates = await db.StoredObjects
            .Where(candidate => candidate.Status == StoredObjectStatus.DeletionPending && (candidate.RetryAfter == null || candidate.RetryAfter <= now))
            .OrderBy(candidate => candidate.DeletionRequestedAt).Take(batchSize).ToListAsync(cancellationToken);
        foreach (var storedObject in candidates)
        {
            try
            {
                await objectStore.DeleteAsync(storedObject.ObjectKey, cancellationToken);
                storedObject.Status = StoredObjectStatus.Deleted;
                storedObject.DeletedAt = timeProvider.GetUtcNow();
                storedObject.RetryAfter = null;
                storedObject.LastStorageError = null;
            }
            catch (ObjectStoreException exception)
            {
                storedObject.MaintenanceAttempts++;
                storedObject.LastStorageError = exception.Message;
                storedObject.RetryAfter = timeProvider.GetUtcNow().Add(RetryDelay(storedObject.MaintenanceAttempts));
                logger.LogWarning(exception, "Object deletion failed for {StoredObjectId}; retry {Attempt} scheduled.", storedObject.Id, storedObject.MaintenanceAttempts);
            }
            storedObject.UpdatedAt = timeProvider.GetUtcNow();
            storedObject.UpdatedBy = AuditActors.System;
            await db.SaveChangesAsync(cancellationToken);
        }
        return expired.Count + candidates.Count;
    }

    internal static TimeSpan RetryDelay(int attempt) => TimeSpan.FromMinutes(Math.Min(60, Math.Pow(2, Math.Min(attempt, 6))));
}

public sealed class FileMaintenanceService(IServiceScopeFactory scopeFactory, ILogger<FileMaintenanceService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<FileMaintenanceProcessor>().ProcessBatchAsync(cancellationToken: stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception exception)
            {
                logger.LogError(exception, "File maintenance iteration failed.");
            }
            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }
}
