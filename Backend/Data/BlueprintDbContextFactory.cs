using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Blueprint.Api.Data;

public sealed class BlueprintDbContextFactory
    : IDesignTimeDbContextFactory<BlueprintDbContext>
{
    public BlueprintDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable(
                "ConnectionStrings__DefaultConnection") ??
            "Host=localhost;Port=5837;Database=blueprint;Username=blueprint;Password=blueprint_dev_password";

        var options = new DbContextOptionsBuilder<BlueprintDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new BlueprintDbContext(options);
    }
}
