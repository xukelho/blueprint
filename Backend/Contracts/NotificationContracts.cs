namespace Blueprint.Api.Contracts;

public sealed record NotificationTargetResponse(
    string Kind,
    long ProjectId,
    Guid? DocumentId,
    long? ConversationId,
    long? MessageId);

public sealed record NotificationResponse(
    long Id,
    string Type,
    long ProjectId,
    string ProjectTitle,
    string ActorDisplayName,
    string Summary,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt,
    NotificationTargetResponse Target);

public sealed record NotificationPageResponse(IReadOnlyList<NotificationResponse> Items, bool HasMore);
public sealed record NotificationSummaryResponse(int UnreadCount, int PendingInvitationCount, int Total);
