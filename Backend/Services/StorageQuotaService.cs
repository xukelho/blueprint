using System.Text.Json;
using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Services;

public sealed record ProjectStorageUsage(long ProjectId, string Title, string Code, bool IsArchived, long UsedBytes, long ReservedBytes)
{
    public long TotalBytes => UsedBytes + ReservedBytes;
}

public sealed record CompanyStorageUsage(
    long CompanyId,
    long BaseLimitBytes,
    long AdminExtraBytes,
    long PurchasedExtraBytes,
    long UsedBytes,
    long ReservedBytes,
    IReadOnlyList<ProjectStorageUsage> Projects)
{
    public long LimitBytes => checked(BaseLimitBytes + AdminExtraBytes + PurchasedExtraBytes);
    public long TotalBytes => checked(UsedBytes + ReservedBytes);
    public long AvailableBytes => Math.Max(0, LimitBytes - TotalBytes);
    public decimal UsagePercent => LimitBytes == 0 ? (TotalBytes == 0 ? 0 : 100) : decimal.Round(TotalBytes * 100m / LimitBytes, 1);
    public bool IsOverCapacity => TotalBytes > LimitBytes;
}

public interface IStorageQuotaService
{
    Task<(long CompanyId, long CurrentChargeBytes, long LimitBytes)> LockCompanyForProjectAsync(long projectId, CancellationToken cancellationToken = default);
    Task<CompanyStorageUsage> GetUsageAsync(long companyId, CancellationToken cancellationToken = default);
    Task EvaluateWarningAsync(long companyId, long actorUserId, CancellationToken cancellationToken = default);
    Task ResetWarningAsync(long companyId, CancellationToken cancellationToken = default);
}

public sealed class StorageQuotaService(BlueprintDbContext db, TimeProvider timeProvider) : IStorageQuotaService
{
    public async Task<(long CompanyId, long CurrentChargeBytes, long LimitBytes)> LockCompanyForProjectAsync(long projectId, CancellationToken cancellationToken = default)
    {
        var companyId = await db.Projects.Where(project => project.Id == projectId)
            .Select(project => (long?)project.CompanyId).SingleOrDefaultAsync(cancellationToken)
            ?? throw new FileResourceNotFoundException("Project not found.");

        var baseLimit = await db.Database.SqlQuery<long>($"SELECT base_limit_bytes AS \"Value\" FROM storage_configuration WHERE id = 1 FOR SHARE")
            .SingleAsync(cancellationToken);
        if (db.Database.IsRelational())
            await db.Database.SqlQuery<long>($"SELECT company_id AS \"Value\" FROM company_storage_allocations WHERE company_id = {companyId} FOR UPDATE")
                .SingleAsync(cancellationToken);
        var allocation = await db.CompanyStorageAllocations.SingleAsync(item => item.CompanyId == companyId, cancellationToken);
        var current = await db.StoredObjects.Where(item => item.Project!.CompanyId == companyId && item.Status != StoredObjectStatus.Deleted)
            .SumAsync(item => item.QuotaChargeBytes, cancellationToken);
        return (companyId, current, checked(baseLimit + allocation.AdminExtraBytes + allocation.PurchasedExtraBytes));
    }

    public async Task<CompanyStorageUsage> GetUsageAsync(long companyId, CancellationToken cancellationToken = default)
    {
        var baseLimit = await db.StorageConfigurations.AsNoTracking().Where(item => item.Id == StorageConfiguration.SingletonId)
            .Select(item => item.BaseLimitBytes).SingleAsync(cancellationToken);
        var allocation = await db.CompanyStorageAllocations.AsNoTracking().SingleAsync(item => item.CompanyId == companyId, cancellationToken);
        var projects = await db.Projects.AsNoTracking().Where(project => project.CompanyId == companyId)
            .Select(project => new ProjectStorageUsage(
                project.Id, project.Title, project.Code, project.IsArchived,
                project.StoredObjects.Where(item => item.Status == StoredObjectStatus.Available || item.Status == StoredObjectStatus.DeletionPending).Sum(item => item.QuotaChargeBytes),
                project.StoredObjects.Where(item => item.Status == StoredObjectStatus.PendingUpload).Sum(item => item.QuotaChargeBytes)))
            .ToArrayAsync(cancellationToken);
        projects = projects.OrderByDescending(item => item.TotalBytes).ThenBy(item => item.Title).ToArray();
        return new CompanyStorageUsage(companyId, baseLimit, allocation.AdminExtraBytes, allocation.PurchasedExtraBytes,
            projects.Sum(item => item.UsedBytes), projects.Sum(item => item.ReservedBytes), projects);
    }

    public async Task EvaluateWarningAsync(long companyId, long actorUserId, CancellationToken cancellationToken = default)
    {
        if (db.Database.IsRelational())
            await db.Database.SqlQuery<long>($"SELECT company_id AS \"Value\" FROM company_storage_allocations WHERE company_id = {companyId} FOR UPDATE")
                .SingleAsync(cancellationToken);
        var usage = await GetUsageAsync(companyId, cancellationToken);
        var level = Threshold(usage.TotalBytes, usage.LimitBytes);
        var allocation = await db.CompanyStorageAllocations.SingleAsync(item => item.CompanyId == companyId, cancellationToken);
        var previous = allocation.WarningLevel;
        allocation.WarningLevel = level;
        if (level <= previous) return;

        var companyName = await db.Companies.Where(item => item.Id == companyId).Select(item => item.Name).SingleAsync(cancellationToken);
        var actorName = await db.Users.Where(item => item.Id == actorUserId)
            .Select(item => item.Employee != null ? item.Employee.DisplayName : item.Client != null ? item.Client.DisplayName : item.Username)
            .SingleAsync(cancellationToken);
        var ownerIds = await db.CompanyEmployees.Where(item => item.CompanyId == companyId && item.CompanyRole == CompanyRoles.Owner && item.Employee!.User!.IsActive)
            .Select(item => item.Employee!.UserId).Distinct().ToArrayAsync(cancellationToken);
        var now = timeProvider.GetUtcNow();
        var storageEvent = new ProjectEvent
        {
            CompanyId = companyId,
            ProjectId = null,
            Scope = NotificationScopes.Company,
            ActorUserId = actorUserId,
            ActorDisplayName = actorName,
            ProjectTitle = companyName,
            Type = ProjectEventTypes.StorageWarning,
            Summary = level == 100 ? "atingiu o limite de armazenamento." : $"atingiu {level}% do armazenamento disponível.",
            TargetKind = NotificationTargetKinds.CompanyStorage,
            ContextJson = JsonSerializer.Serialize(new { level, usage.TotalBytes, usage.LimitBytes }),
            DeduplicationKey = $"company-storage:{companyId}:{level}:{now.UtcTicks}",
            OccurredAt = now
        };
        foreach (var ownerId in ownerIds)
            storageEvent.Notifications.Add(new UserNotification { RecipientUserId = ownerId, CreatedAt = now });
        db.ProjectEvents.Add(storageEvent);
    }

    public async Task ResetWarningAsync(long companyId, CancellationToken cancellationToken = default)
    {
        await using var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(cancellationToken) : null;
        if (db.Database.IsRelational())
            await db.Database.SqlQuery<long>($"SELECT company_id AS \"Value\" FROM company_storage_allocations WHERE company_id = {companyId} FOR UPDATE")
                .SingleAsync(cancellationToken);
        var usage = await GetUsageAsync(companyId, cancellationToken);
        var allocation = await db.CompanyStorageAllocations.SingleAsync(item => item.CompanyId == companyId, cancellationToken);
        allocation.WarningLevel = Threshold(usage.TotalBytes, usage.LimitBytes);
        await db.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
    }

    private static int Threshold(long total, long limit)
    {
        if (limit == 0) return total == 0 ? 0 : 100;
        var percentage = total * 100m / limit;
        return percentage >= 100 ? 100 : percentage >= 90 ? 90 : percentage >= 80 ? 80 : 0;
    }
}

public sealed class StorageQuotaExceededException() : FileConflictException("The company storage limit has been reached.");
