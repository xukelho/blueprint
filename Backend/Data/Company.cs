namespace Blueprint.Api.Data;

public sealed class Company
{
    public long Id { get; set; }

    public required string Name { get; set; }

    public required string LegalName { get; set; }

    public required string Nif { get; set; }

    public required string Email { get; set; }

    public required string PhoneNumber { get; set; }

    public required string Address { get; set; }

    public string? Website { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public long CreatedBy { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long UpdatedBy { get; set; }

    public ICollection<CompanyEmployee> CompanyEmployees { get; set; } = [];

    public ICollection<CompanyClient> CompanyClients { get; set; } = [];

    public ICollection<ClientInvitation> ClientInvitations { get; set; } = [];

    public ICollection<Project> Projects { get; set; } = [];

    public CompanyStorageAllocation? StorageAllocation { get; set; }

    public ICollection<ProjectEvent> Events { get; set; } = [];
}

public sealed class StorageConfiguration
{
    public const int SingletonId = 1;
    public const long DefaultBaseLimitBytes = 5_000_000_000;
    public const long CapacityStepBytes = 100_000_000;
    public const long MaximumLimitBytes = 9_000_000_000_000_000;

    public int Id { get; set; } = SingletonId;
    public long BaseLimitBytes { get; set; } = DefaultBaseLimitBytes;
    public DateTimeOffset UpdatedAt { get; set; }
    public long UpdatedBy { get; set; }
}

public sealed class CompanyStorageAllocation
{
    public long CompanyId { get; set; }
    public long AdminExtraBytes { get; set; }
    public long PurchasedExtraBytes { get; set; }
    public int WarningLevel { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long UpdatedBy { get; set; }
    public Company? Company { get; set; }
}
