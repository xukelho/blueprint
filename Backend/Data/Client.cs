namespace Blueprint.Api.Data;

public sealed class Client : IUserProfile
{
    public long Id { get; set; }

    public long UserId { get; set; }

    public required string DisplayName { get; set; }

    public required string FullName { get; set; }

    public required string Nif { get; set; }

    public required string Email { get; set; }

    public required string PhoneNumber { get; set; }

    public required string Address { get; set; }

    public User? User { get; set; }
}
