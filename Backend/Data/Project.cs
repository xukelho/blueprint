namespace Blueprint.Api.Data;

public sealed class Project
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long? ClientId { get; set; }
    public required string Title { get; set; }
    public required string Code { get; set; }
    public required string Address { get; set; }
    public string? GoogleMapsUrl { get; set; }
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public long CreatedBy { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long UpdatedBy { get; set; }
    public Company? Company { get; set; }
    public Client? Client { get; set; }
    public ICollection<ProjectMember> Members { get; set; } = [];
    public ICollection<ProjectPhase> Phases { get; set; } = [];
}

public sealed class ProjectPhase
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public required string PhaseCode { get; set; }
    public int Position { get; set; }
    public bool IsCurrent { get; set; }
    public Project? Project { get; set; }
}

public sealed class ProjectMember
{
    public long ProjectId { get; set; }
    public long EmployeeId { get; set; }
    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
}
