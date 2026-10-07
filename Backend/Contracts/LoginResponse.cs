namespace Blueprint.Api.Contracts;

public sealed record LoginResponse(
    string Status,
    IReadOnlyList<string>? Roles = null,
    string Environment = "production");
