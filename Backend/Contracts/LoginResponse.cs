namespace Blueprint.Api.Contracts;

public sealed record LoginResponse(string Status, string? Role = null);
