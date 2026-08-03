namespace Blueprint.Api.Data;

public sealed class Employee
{
    public long Id { get; set; }

    public long UserId { get; set; }

    public required string DisplayName { get; set; }

    public required string FullName { get; set; }

    public string? Nif { get; set; }

    public string? Email { get; set; }

    public string? PhoneNumber { get; set; }

    public string? Address { get; set; }

    public User? User { get; set; }

    public CompanyEmployee? CompanyEmployee { get; set; }

    public ICollection<ProjectMember> ProjectMemberships { get; set; } = [];
}
