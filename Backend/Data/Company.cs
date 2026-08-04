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

    public ICollection<Client> ActiveClients { get; set; } = [];

    public ICollection<CompanyClient> CompanyClients { get; set; } = [];

    public ICollection<ClientInvitation> ClientInvitations { get; set; } = [];

    public ICollection<Project> Projects { get; set; } = [];
}
