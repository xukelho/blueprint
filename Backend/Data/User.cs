namespace Blueprint.Api.Data;

public sealed class User
{
    public long Id { get; set; }

    public long RoleId { get; set; }

    public required string Username { get; set; }

    public required string Password { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public long CreatedBy { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long UpdatedBy { get; set; }

    public UserRole? Role { get; set; }

    public Client? Client { get; set; }

    public Company? Company { get; set; }

    public Architect? Architect { get; set; }
}
