using System.Text.Json;
using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Services;

public sealed record ProjectNotificationCommand(
    long ProjectId,
    long ActorUserId,
    string Type,
    string Summary,
    string TargetKind,
    string DeduplicationKey,
    Guid? DocumentId = null,
    long? ConversationId = null,
    long? MessageId = null,
    object? Context = null,
    IReadOnlyCollection<long>? AdditionalRecipientUserIds = null);

public interface IProjectNotificationService
{
    Task<bool> AddAsync(ProjectNotificationCommand command, CancellationToken cancellationToken = default);
    Task<long[]> ParticipantUserIdsAsync(long projectId, CancellationToken cancellationToken = default);
}

public sealed class ProjectNotificationService(BlueprintDbContext db, TimeProvider timeProvider) : IProjectNotificationService
{
    public async Task<long[]> ParticipantUserIdsAsync(long projectId, CancellationToken cancellationToken = default)
    {
        var employeeUsers = db.ProjectMembers
            .Where(member => member.ProjectId == projectId && member.Employee!.User!.IsActive)
            .Select(member => member.Employee!.UserId);
        var clientUsers = db.ProjectClients
            .Where(member => member.ProjectId == projectId && member.Client!.User!.IsActive &&
                member.Client.CompanyClients.Any(company => company.CompanyId == member.Project!.CompanyId))
            .Select(member => member.Client!.UserId);
        return await employeeUsers.Union(clientUsers).ToArrayAsync(cancellationToken);
    }

    public async Task<bool> AddAsync(ProjectNotificationCommand command, CancellationToken cancellationToken = default)
    {
        if (db.ProjectEvents.Local.Any(item => item.DeduplicationKey == command.DeduplicationKey) ||
            await db.ProjectEvents.AnyAsync(item => item.DeduplicationKey == command.DeduplicationKey, cancellationToken))
            return false;

        var project = await db.Projects.AsNoTracking().Where(item => item.Id == command.ProjectId)
            .Select(item => new { item.Id, item.Title }).SingleAsync(cancellationToken);
        var actor = await db.Users.AsNoTracking().Where(item => item.Id == command.ActorUserId)
            .Select(item => item.Employee != null ? item.Employee.DisplayName : item.Client != null ? item.Client.DisplayName : item.Username)
            .SingleAsync(cancellationToken);
        var recipients = (await ParticipantUserIdsAsync(command.ProjectId, cancellationToken))
            .Concat(command.AdditionalRecipientUserIds ?? [])
            .Where(id => id != command.ActorUserId)
            .Distinct()
            .ToArray();
        if (command.AdditionalRecipientUserIds is { Count: > 0 })
        {
            var active = await db.Users.AsNoTracking().Where(item => recipients.Contains(item.Id) && item.IsActive)
                .Select(item => item.Id).ToArrayAsync(cancellationToken);
            recipients = active;
        }

        var now = timeProvider.GetUtcNow();
        var projectEvent = new ProjectEvent
        {
            ProjectId = project.Id,
            ActorUserId = command.ActorUserId,
            ActorDisplayName = actor,
            ProjectTitle = project.Title,
            Type = command.Type,
            Summary = command.Summary,
            TargetKind = command.TargetKind,
            DocumentId = command.DocumentId,
            ConversationId = command.ConversationId,
            MessageId = command.MessageId,
            ContextJson = JsonSerializer.Serialize(command.Context ?? new { }),
            DeduplicationKey = command.DeduplicationKey,
            OccurredAt = now
        };
        foreach (var recipient in recipients)
            projectEvent.Notifications.Add(new UserNotification { RecipientUserId = recipient, CreatedAt = now });
        db.ProjectEvents.Add(projectEvent);
        return true;
    }
}
