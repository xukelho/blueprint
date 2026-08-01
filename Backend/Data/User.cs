namespace Blueprint.Api.Data;

public sealed class User
{
    public long Id { get; set; }

    public required string Username { get; set; }

    public required string Password { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public long CreatedBy { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long UpdatedBy { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset? DeactivatedAt { get; set; }

    public long? DeactivatedBy { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = [];

    public Client? Client { get; set; }

    public Employee? Employee { get; set; }
}
