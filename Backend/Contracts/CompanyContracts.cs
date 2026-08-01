namespace Blueprint.Api.Contracts;

public sealed record UpdateCurrentCompanyRequest(
    string Name,
    string LegalName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address,
    string? Website);

public sealed record CompanyMemberResponse(long EmployeeId, long UserId, string Username, string DisplayName, string FullName, string CompanyRole, bool IsArchitect);
public sealed record CreateCompanyMemberRequest(string Username, string Password, string DisplayName, string FullName, string CompanyRole, bool IsArchitect);
public sealed record UpdateCompanyMemberRequest(string CompanyRole, bool IsArchitect);
