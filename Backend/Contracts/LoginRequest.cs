using System.ComponentModel.DataAnnotations;

namespace Blueprint.Api.Contracts;

public sealed record LoginRequest(
    [property: Required, MaxLength(256)] string Username,
    [property: Required, MaxLength(1024)] string Password);
