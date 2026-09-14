using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.IntegrationTests;

public sealed class StorageQuotaServiceTests
{
    [Fact]
    public async Task UsageSeparatesOccupiedAndReservedAndIncludesEmptyProjects()
    {
        await using var db = CreateDb();
        var now = DateTimeOffset.UtcNow;
        db.StorageConfigurations.Add(new StorageConfiguration { BaseLimitBytes = 5_000_000_000, UpdatedAt = now });
        db.Companies.Add(new Company { Id = 1, Name = "Atelier", LegalName = "Atelier", Nif = "1", Email = "a@b.pt", PhoneNumber = "1", Address = "A", IsActive = true, CreatedAt = now, UpdatedAt = now });
        db.CompanyStorageAllocations.Add(new CompanyStorageAllocation { CompanyId = 1, AdminExtraBytes = 1_000_000_000, UpdatedAt = now });
        db.Projects.AddRange(
            new Project { Id = 10, CompanyId = 1, Title = "Used", Code = "U", Address = "", CreatedAt = now, UpdatedAt = now },
            new Project { Id = 11, CompanyId = 1, Title = "Empty", Code = "E", Address = "", IsArchived = true, CreatedAt = now, UpdatedAt = now });
        db.StoredObjects.AddRange(
            Object(10, StoredObjectStatus.Available, 2_000_000_000, now),
            Object(10, StoredObjectStatus.PendingUpload, 500_000_000, now));
        await db.SaveChangesAsync();

        var usage = await new StorageQuotaService(db, TimeProvider.System).GetUsageAsync(1);

        Assert.Equal(6_000_000_000, usage.LimitBytes);
        Assert.Equal(2_000_000_000, usage.UsedBytes);
        Assert.Equal(500_000_000, usage.ReservedBytes);
        Assert.Equal(3_500_000_000, usage.AvailableBytes);
        Assert.Equal([10L, 11L], usage.Projects.Select(item => item.ProjectId));
    }

    [Fact]
    public async Task WarningsJumpToHighestDeduplicateAndResetForActiveOwnersOnly()
    {
        await using var db = CreateDb();
        var now = DateTimeOffset.UtcNow;
        var user = new User { Id = 7, Username = "owner", Password = "x", IsActive = true, CreatedAt = now, UpdatedAt = now };
        var employee = new Employee { Id = 8, UserId = 7, DisplayName = "Ana", FullName = "Ana", User = user };
        var colleagueUser = new User { Id = 9, Username = "employee", Password = "x", IsActive = true, CreatedAt = now, UpdatedAt = now };
        var colleague = new Employee { Id = 10, UserId = 9, DisplayName = "Bruno", FullName = "Bruno", User = colleagueUser };
        db.Users.AddRange(user, colleagueUser); db.Employees.AddRange(employee, colleague);
        db.Companies.Add(new Company { Id = 1, Name = "Atelier", LegalName = "Atelier", Nif = "1", Email = "a@b.pt", PhoneNumber = "1", Address = "A", IsActive = true, CreatedAt = now, UpdatedAt = now });
        db.CompanyEmployees.AddRange(
            new CompanyEmployee { CompanyId = 1, EmployeeId = 8, CompanyRole = CompanyRoles.Owner },
            new CompanyEmployee { CompanyId = 1, EmployeeId = 10, CompanyRole = CompanyRoles.Employee });
        db.StorageConfigurations.Add(new StorageConfiguration { BaseLimitBytes = 1_000_000_000, UpdatedAt = now });
        db.CompanyStorageAllocations.Add(new CompanyStorageAllocation { CompanyId = 1, UpdatedAt = now });
        db.Projects.Add(new Project { Id = 10, CompanyId = 1, Title = "P", Code = "P", Address = "", CreatedAt = now, UpdatedAt = now });
        var stored = Object(10, StoredObjectStatus.PendingUpload, 1_000_000_000, now);
        db.StoredObjects.Add(stored);
        await db.SaveChangesAsync();
        var service = new StorageQuotaService(db, TimeProvider.System);

        await service.EvaluateWarningAsync(1, 7); await db.SaveChangesAsync();
        await service.EvaluateWarningAsync(1, 7); await db.SaveChangesAsync();
        Assert.Equal(100, (await db.CompanyStorageAllocations.FindAsync(1L))!.WarningLevel);
        Assert.Single(await db.UserNotifications.Where(item => item.RecipientUserId == 7).ToArrayAsync());
        Assert.Empty(await db.UserNotifications.Where(item => item.RecipientUserId == 9).ToArrayAsync());

        stored.QuotaChargeBytes = 850_000_000;
        await db.SaveChangesAsync(); await service.ResetWarningAsync(1); await db.SaveChangesAsync();
        Assert.Equal(80, (await db.CompanyStorageAllocations.FindAsync(1L))!.WarningLevel);
        stored.QuotaChargeBytes = 950_000_000;
        await db.SaveChangesAsync(); await service.EvaluateWarningAsync(1, 7); await db.SaveChangesAsync();
        Assert.Equal(2, await db.UserNotifications.CountAsync(item => item.RecipientUserId == 7));

        stored.QuotaChargeBytes = 700_000_000;
        await db.SaveChangesAsync(); await service.ResetWarningAsync(1); await db.SaveChangesAsync();
        Assert.Equal(0, (await db.CompanyStorageAllocations.FindAsync(1L))!.WarningLevel);
        stored.QuotaChargeBytes = 850_000_000;
        await db.SaveChangesAsync(); await service.EvaluateWarningAsync(1, 7); await db.SaveChangesAsync();
        Assert.Equal(3, await db.UserNotifications.CountAsync(item => item.RecipientUserId == 7));
    }

    private static StoredObject Object(long projectId, StoredObjectStatus status, long charge, DateTimeOffset now) => new()
    {
        Id = Guid.NewGuid(), ProjectId = projectId, ObjectKey = Guid.NewGuid().ToString("N"), FileName = "x", ContentType = "application/octet-stream",
        ExpectedLength = charge, QuotaChargeBytes = charge, Status = status, UploadExpiresAt = now.AddHours(1), CreatedAt = now, UpdatedAt = now
    };

    private static BlueprintDbContext CreateDb() => new(new DbContextOptionsBuilder<BlueprintDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
