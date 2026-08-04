namespace Blueprint.Api.Contracts;

public sealed record AdministrationErrorResponse(string Error);

public sealed record RoleResponse(long Id, string Name);

public sealed record CreateUserRequest(
    string Username,
    string Password);

public sealed record UpdateUserRequest(
    string Username,
    string? Password,
    IReadOnlyList<long> RoleIds);

public sealed record UserResponse(
    long Id,
    string Username,
    IReadOnlyList<RoleResponse> Roles,
    DateTimeOffset CreatedAt,
    long CreatedBy,
    DateTimeOffset UpdatedAt,
    long UpdatedBy);

public sealed record CreateEmployeeRequest(
    string Username,
    string Password,
    IReadOnlyList<long> RoleIds,
    long CompanyId,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record UpdateEmployeeRequest(
    long CompanyId,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record EmployeeResponse(
    long Id,
    long UserId,
    long CompanyId,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record CreateClientRequest(
    string Username,
    string Password,
    IReadOnlyList<long> CompanyIds,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record UpdateClientRequest(
    IReadOnlyList<long> CompanyIds,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record ClientResponse(
    long Id,
    long UserId,
    IReadOnlyList<long> CompanyIds,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record CreateCompanyRequest(
    string Name,
    string LegalName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address,
    string? Website);

public sealed record UpdateCompanyRequest(
    string Name,
    string LegalName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address,
    string? Website);

public sealed record CompanyResponse(
    long Id,
    string Name,
    string LegalName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address,
    string? Website,
    bool IsActive,
    DateTimeOffset CreatedAt,
    long CreatedBy,
    DateTimeOffset UpdatedAt,
    long UpdatedBy);
