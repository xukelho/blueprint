namespace Blueprint.Api.Contracts;

public sealed record ProjectDocumentResponse(
    Guid Id,
    long PhaseId,
    string FileName,
    string ContentType,
    long Length,
    string Status,
    long CreatedBy,
    string CreatedByDisplayName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UploadedAt,
    DocumentPreviewResponse? Preview = null);

public sealed record CreateDocumentUploadRequest(string FileName, string ContentType, long Length);
public sealed record UploadGrantResponse(Uri Url, DateTimeOffset ExpiresAt, IReadOnlyDictionary<string, string> RequiredHeaders);
public sealed record PendingDocumentUploadResponse(Guid DocumentId, Guid StoredObjectId, UploadGrantResponse Upload);
public sealed record CompleteDocumentUploadResponse(ProjectDocumentResponse Document);
public sealed record DownloadGrantResponse(Uri Url, DateTimeOffset ExpiresAt);
public sealed record MoveDocumentRequest(long TargetPhaseId);
public sealed record CreateReplacementUploadRequest(string FileName, string ContentType, long Length);
public sealed record PendingReplacementUploadResponse(Guid StoredObjectId, UploadGrantResponse Upload);
public sealed record RemoveProjectPhaseRequest(string Mode, long? TargetPhaseId);
