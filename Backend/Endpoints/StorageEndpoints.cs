using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class StorageEndpoints
{
    public static IEndpointRouteBuilder MapStorageEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/company/storage", GetCompanyStorage).RequireAuthorization();

        var admin = endpoints.MapGroup("/api/admin").RequireAuthorization(policy => policy.RequireRole("platform admin"));
        admin.MapGet("/storage-settings", GetSettings);
        admin.MapPut("/storage-settings", UpdateSettings).Accepts<UpdateStorageSettingsRequest>("application/json").ProducesValidationProblem();
        admin.MapGet("/companies/{companyId:long}/storage", GetCompanyAllocation);
        admin.MapPut("/companies/{companyId:long}/storage", UpdateCompanyAllocation)
            .Accepts<UpdateCompanyStorageAllocationRequest>("application/json").ProducesValidationProblem();
        return endpoints;
    }

    private static async Task<IResult> GetCompanyStorage(ClaimsPrincipal principal, BlueprintDbContext db, IStorageQuotaService quotas, CancellationToken ct)
    {
        var companyId = await OwnerCompanyId(principal, db, ct);
        if (companyId is null) return TypedResults.NotFound();
        return TypedResults.Ok(ToResponse(await quotas.GetUsageAsync(companyId.Value, ct)));
    }

    private static async Task<IResult> GetSettings(BlueprintDbContext db, CancellationToken ct) =>
        TypedResults.Ok(ToResponse(await db.StorageConfigurations.AsNoTracking().SingleAsync(item => item.Id == StorageConfiguration.SingletonId, ct)));

    private static async Task<IResult> UpdateSettings(UpdateStorageSettingsRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, IStorageQuotaService quotas, TimeProvider timeProvider, CancellationToken ct)
    {
        var validation = ValidateCapacity(request?.BaseLimitBytes, "baseLimitBytes");
        if (validation is not null) return validation;
        var actorId = UserId(principal);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.SqlQuery<int>($"SELECT id AS \"Value\" FROM storage_configuration WHERE id = 1 FOR UPDATE").SingleAsync(ct);
        var settings = await db.StorageConfigurations.SingleAsync(item => item.Id == StorageConfiguration.SingletonId, ct);
        settings.BaseLimitBytes = request!.BaseLimitBytes;
        settings.UpdatedAt = timeProvider.GetUtcNow();
        settings.UpdatedBy = actorId;
        await db.SaveChangesAsync(ct);
        var companyIds = await db.Companies.Where(item => item.IsActive).Select(item => item.Id).ToArrayAsync(ct);
        foreach (var companyId in companyIds) await quotas.EvaluateWarningAsync(companyId, actorId, ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(ToResponse(settings));
    }

    private static async Task<IResult> GetCompanyAllocation(long companyId, BlueprintDbContext db, IStorageQuotaService quotas, CancellationToken ct)
    {
        var allocation = await db.CompanyStorageAllocations.AsNoTracking().SingleOrDefaultAsync(item => item.CompanyId == companyId, ct);
        if (allocation is null) return TypedResults.NotFound();
        return TypedResults.Ok(ToResponse(allocation, await quotas.GetUsageAsync(companyId, ct)));
    }

    private static async Task<IResult> UpdateCompanyAllocation(long companyId, UpdateCompanyStorageAllocationRequest? request, ClaimsPrincipal principal,
        BlueprintDbContext db, IStorageQuotaService quotas, TimeProvider timeProvider, CancellationToken ct)
    {
        var validation = ValidateCapacity(request?.AdminExtraBytes, "adminExtraBytes");
        if (validation is not null) return validation;
        var actorId = UserId(principal);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var locked = await db.Database.SqlQuery<long>($"SELECT company_id AS \"Value\" FROM company_storage_allocations WHERE company_id = {companyId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        if (locked == 0) return TypedResults.NotFound();
        var allocation = await db.CompanyStorageAllocations.SingleAsync(item => item.CompanyId == companyId, ct);
        allocation.AdminExtraBytes = request!.AdminExtraBytes;
        allocation.UpdatedAt = timeProvider.GetUtcNow();
        allocation.UpdatedBy = actorId;
        await db.SaveChangesAsync(ct);
        await quotas.EvaluateWarningAsync(companyId, actorId, ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(ToResponse(allocation, await quotas.GetUsageAsync(companyId, ct)));
    }

    private static IResult? ValidateCapacity(long? bytes, string field) =>
        bytes is null || bytes < 0 || bytes > StorageConfiguration.MaximumLimitBytes || bytes % StorageConfiguration.CapacityStepBytes != 0
            ? TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = ["Capacity must be a non-negative multiple of 0.1 GB."] })
            : null;

    private static async Task<long?> OwnerCompanyId(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var userId = UserId(principal);
        return await db.CompanyEmployees.Where(item => item.Employee!.UserId == userId && item.CompanyRole == CompanyRoles.Owner && item.Company!.IsActive)
            .Select(item => (long?)item.CompanyId).SingleOrDefaultAsync(ct);
    }

    private static long UserId(ClaimsPrincipal principal) => long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
    private static StorageSettingsResponse ToResponse(StorageConfiguration value) => new(value.BaseLimitBytes, value.UpdatedAt, value.UpdatedBy);
    private static CompanyStorageUsageResponse ToResponse(CompanyStorageUsage usage) => new(
        usage.BaseLimitBytes, usage.AdminExtraBytes, usage.PurchasedExtraBytes, usage.LimitBytes,
        usage.UsedBytes, usage.ReservedBytes, usage.AvailableBytes, usage.UsagePercent, usage.IsOverCapacity,
        usage.Projects.Select(item => new ProjectStorageUsageResponse(item.ProjectId, item.Title, item.Code, item.IsArchived, item.UsedBytes, item.ReservedBytes, item.TotalBytes)).ToArray());
    private static CompanyStorageAllocationResponse ToResponse(CompanyStorageAllocation allocation, CompanyStorageUsage usage) => new(
        allocation.CompanyId, allocation.AdminExtraBytes, allocation.PurchasedExtraBytes, usage.LimitBytes,
        usage.UsedBytes, usage.ReservedBytes, usage.AvailableBytes, usage.UsagePercent, usage.IsOverCapacity,
        allocation.UpdatedAt, allocation.UpdatedBy);
}
