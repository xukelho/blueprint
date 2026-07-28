namespace Blueprint.Api.Data;

public sealed class UserRole
{
    public long Id { get; set; }

    public required string Role { get; set; }

    public ICollection<User> Users { get; set; } = [];
}

public static class UserRoleIds
{
    public const long PlatformAdmin = 1;
    public const long Client = 2;
    public const long Company = 3;
    public const long Architect = 4;
}
