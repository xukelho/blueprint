namespace Blueprint.Api.Contracts;

public sealed record AdministrationErrorResponse(string Error);

public sealed record CreateUserRequest(
    long RoleId,
    string Username,
    string Password);

public sealed record UpdateUserRequest(
    long RoleId,
    string Username,
    string? Password);

public sealed record UserResponse(
    long Id,
    long RoleId,
    string Role,
    string Username,
    DateTimeOffset CreatedAt,
    long CreatedBy,
    DateTimeOffset UpdatedAt,
    long UpdatedBy);

public sealed record CreateProfileRequest(
    long UserId,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record UpdateProfileRequest(
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);

public sealed record ProfileResponse(
    long Id,
    long UserId,
    string DisplayName,
    string FullName,
    string Nif,
    string Email,
    string PhoneNumber,
    string Address);
