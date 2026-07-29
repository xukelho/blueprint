using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Data;

public static class DatabaseInitializer
{
    private const string InitialAdminUsername = "admin";
    private const string InitialAdminPassword = "admin";

    public static async Task InitializeAsync(
        IServiceProvider services,
        CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BlueprintDbContext>();

        await dbContext.Database.MigrateAsync(cancellationToken);

        if (await dbContext.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var admin = new User
        {
            Username = InitialAdminUsername,
            Password = string.Empty,
            CreatedAt = now,
            CreatedBy = AuditActors.System,
            UpdatedAt = now,
            UpdatedBy = AuditActors.System
        };

        admin.Password = new PasswordHasher<User>()
            .HashPassword(admin, InitialAdminPassword);

        dbContext.Users.Add(admin);
        admin.UserRoles.Add(new UserRole
        {
            RoleId = RoleIds.PlatformAdmin
        });
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
