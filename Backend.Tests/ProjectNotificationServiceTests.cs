using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.IntegrationTests;

public sealed class ProjectNotificationServiceTests
{
    [Fact]
    public async Task FanoutUsesOnlyActiveExplicitParticipantsAndAdditionalRemovedUsers()
    {
        await using var db = new BlueprintDbContext(new DbContextOptionsBuilder<BlueprintDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var now = DateTimeOffset.Parse("2026-09-11T10:00:00Z");
        var actor = User(1, "Actor");
        var assigned = User(2, "Assigned");
        var clientUser = User(3, "Client");
        var unassignedOwner = User(4, "Owner");
        var inactive = User(5, "Inactive", false);
        var removed = User(6, "Removed");
        var company = new Company { Id = 10, Name = "Studio", LegalName = "Studio", Nif = "1", Email = "s@example.test", PhoneNumber = "1", Address = "A", IsActive = true, CreatedAt = now, UpdatedAt = now };
        var actorEmployee = Employee(11, actor, "Actor");
        var assignedEmployee = Employee(12, assigned, "Assigned");
        var ownerEmployee = Employee(14, unassignedOwner, "Owner");
        var inactiveEmployee = Employee(15, inactive, "Inactive");
        var client = new Client { Id = 13, User = clientUser, UserId = clientUser.Id, DisplayName = "Client", FullName = "Client", Nif = "3", Email = "c@example.test", PhoneNumber = "3", Address = "C" };
        company.CompanyEmployees.Add(new CompanyEmployee { Employee = actorEmployee, EmployeeId = actorEmployee.Id, CompanyRole = CompanyRoles.Employee, IsArchitect = true });
        company.CompanyEmployees.Add(new CompanyEmployee { Employee = assignedEmployee, EmployeeId = assignedEmployee.Id, CompanyRole = CompanyRoles.Employee, IsArchitect = true });
        company.CompanyEmployees.Add(new CompanyEmployee { Employee = ownerEmployee, EmployeeId = ownerEmployee.Id, CompanyRole = CompanyRoles.Owner, IsArchitect = true });
        company.CompanyEmployees.Add(new CompanyEmployee { Employee = inactiveEmployee, EmployeeId = inactiveEmployee.Id, CompanyRole = CompanyRoles.Employee, IsArchitect = true });
        company.CompanyClients.Add(new CompanyClient { Client = client, ClientId = client.Id });
        var project = new Project { Id = 20, Company = company, CompanyId = company.Id, Title = "Project", Code = "P", Address = "A", CreatedAt = now, UpdatedAt = now, CreatedBy = actor.Id, UpdatedBy = actor.Id };
        project.Members.Add(new ProjectMember { Employee = actorEmployee, EmployeeId = actorEmployee.Id });
        project.Members.Add(new ProjectMember { Employee = assignedEmployee, EmployeeId = assignedEmployee.Id });
        project.Members.Add(new ProjectMember { Employee = inactiveEmployee, EmployeeId = inactiveEmployee.Id });
        project.ProjectClients.Add(new ProjectClient { Client = client, ClientId = client.Id });
        db.AddRange(actor, assigned, clientUser, unassignedOwner, inactive, removed, company, project);
        await db.SaveChangesAsync();

        var service = new ProjectNotificationService(db, new FixedTimeProvider(now));
        var command = new ProjectNotificationCommand(project.Id, actor.Id, ProjectEventTypes.GlobalMessageCreated,
            "adicionou uma mensagem.", NotificationTargetKinds.GlobalMessage, "message:1", MessageId: 1,
            AdditionalRecipientUserIds: [removed.Id]);
        Assert.True(await service.AddAsync(command));
        await db.SaveChangesAsync();

        var recipients = await db.UserNotifications.Select(item => item.RecipientUserId).OrderBy(id => id).ToArrayAsync();
        Assert.Equal(new[] { assigned.Id, clientUser.Id, removed.Id }, recipients);
        Assert.False(await service.AddAsync(command));
        Assert.DoesNotContain(unassignedOwner.Id, recipients);
        Assert.DoesNotContain(actor.Id, recipients);
        Assert.DoesNotContain(inactive.Id, recipients);
    }

    private static User User(long id, string name, bool active = true) => new()
    {
        Id = id, Username = name.ToLowerInvariant(), Password = "x", IsActive = active,
        CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
    };

    private static Employee Employee(long id, User user, string name) => new()
    {
        Id = id, User = user, UserId = user.Id, DisplayName = name, FullName = name
    };

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
