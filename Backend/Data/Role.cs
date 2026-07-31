namespace Blueprint.Api.Data;

public sealed class Role
{
    public long Id { get; set; }

    public required string Name { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = [];
}

public static class RoleIds
{
    public const long PlatformAdmin = 1;
    public const long Client = 2;
    public const long Employee = 3;
    public const long Architect = 4;
    public const long CompanyOwner = 5;
}
