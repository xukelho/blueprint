namespace Blueprint.Api.Data;

public sealed class ProjectEvent
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long ActorUserId { get; set; }
    public required string ActorDisplayName { get; set; }
    public required string ProjectTitle { get; set; }
    public required string Type { get; set; }
    public required string Summary { get; set; }
    public int TemplateVersion { get; set; } = 1;
    public required string TargetKind { get; set; }
    public Guid? DocumentId { get; set; }
    public long? ConversationId { get; set; }
    public long? MessageId { get; set; }
    public required string ContextJson { get; set; }
    public required string DeduplicationKey { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public Project? Project { get; set; }
    public ICollection<UserNotification> Notifications { get; set; } = [];
}

public sealed class UserNotification
{
    public long Id { get; set; }
    public long ProjectEventId { get; set; }
    public long RecipientUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
    public ProjectEvent? ProjectEvent { get; set; }
    public User? RecipientUser { get; set; }
}

public static class ProjectEventTypes
{
    public const string ProjectCreated = "project.created";
    public const string ParticipantsChanged = "project.participants_changed";
    public const string TimelineChanged = "project.timeline_changed";
    public const string ProjectArchived = "project.archived";
    public const string ProjectReactivated = "project.reactivated";
    public const string DocumentUploaded = "document.uploaded";
    public const string DocumentReplaced = "document.replaced";
    public const string DocumentMoved = "document.moved";
    public const string DocumentDeleted = "document.deleted";
    public const string GlobalMessageCreated = "project.global_message_created";
    public const string PartConversationCreated = "project.part_conversation_created";
    public const string PartMessageCreated = "project.part_message_created";
}

public static class NotificationTargetKinds
{
    public const string Project = "project";
    public const string Timeline = "timeline";
    public const string Document = "document";
    public const string GlobalMessage = "globalMessage";
    public const string PartConversation = "partConversation";
}
