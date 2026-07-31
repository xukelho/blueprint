namespace Blueprint.Api.Data;

public sealed class CompanyEmployee
{
    public long CompanyId { get; set; }
    public long EmployeeId { get; set; }
    public required string CompanyRole { get; set; }
    public bool IsArchitect { get; set; }
    public Company? Company { get; set; }
    public Employee? Employee { get; set; }
}

public static class CompanyRoles
{
    public const string Owner = "owner";
    public const string Employee = "employee";
}
