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
}
