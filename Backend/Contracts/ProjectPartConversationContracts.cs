namespace Blueprint.Api.Contracts;

public sealed record ProjectPartConversationResponse(long Id, Guid DocumentId, string TargetKey, string TargetKind,
    string TargetLabel, string Title, double AnchorX, double AnchorY, DateTimeOffset CreatedAt, int MessageCount);
public sealed record ProjectPartConversationMessageResponse(long Id, string AuthorDisplayName, string Body, DateTimeOffset CreatedAt, bool IsOwn);
public sealed record CreateProjectPartConversationRequest(Guid DocumentId, string? TargetKey, string? TargetKind, string? TargetLabel,
    string? Title, double AnchorX, double AnchorY);
public sealed record CreateProjectPartConversationMessageRequest(string? Body);
