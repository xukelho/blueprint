namespace Blueprint.Api.Contracts;

public sealed record ProjectStorageUsageResponse(
    long ProjectId, string Title, string Code, bool IsArchived,
    long OccupiedBytes, long ReservedBytes, long TotalBytes);

public sealed record CompanyStorageUsageResponse(
    long BaseLimitBytes,
    long AdminExtraBytes,
    long PurchasedExtraBytes,
    long TotalCapacityBytes,
    long OccupiedBytes,
    long ReservedBytes,
    long AvailableBytes,
    decimal UsagePercent,
    bool IsOverCapacity,
    IReadOnlyList<ProjectStorageUsageResponse> Projects);

public sealed record StorageSettingsResponse(long BaseLimitBytes, DateTimeOffset UpdatedAt, long UpdatedBy);
public sealed record UpdateStorageSettingsRequest(long BaseLimitBytes);
public sealed record CompanyStorageAllocationResponse(
    long CompanyId, long AdminExtraBytes, long PurchasedExtraBytes, long TotalCapacityBytes,
    long OccupiedBytes, long ReservedBytes, long AvailableBytes, decimal UsagePercent, bool IsOverCapacity,
    DateTimeOffset UpdatedAt, long UpdatedBy);
public sealed record UpdateCompanyStorageAllocationRequest(long AdminExtraBytes);
public sealed record StorageQuotaExceededResponse(string Code, string Error);
