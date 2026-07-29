namespace Blueprint.Api.Contracts;

public sealed record ProfileCompanyOption(long Id, string Name);

public sealed record CurrentProfileResponse(
    string ProfileType,
    long UserId,
    string Username,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address,
    long? CompanyId,
    string? CompanyName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<ProfileCompanyOption> AvailableCompanies);

public sealed record UpdateCurrentProfileRequest(
    string Username,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address,
    long? CompanyId,
    bool IsArchitect);
