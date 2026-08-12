namespace Blueprint.Api.Data;

public enum StoredObjectStatus
{
    PendingUpload,
    Available,
    DeletionPending,
    Deleted
}

public sealed class StoredObject
{
    public Guid Id { get; set; }
    public long ProjectId { get; set; }
    public required string ObjectKey { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long ExpectedLength { get; set; }
    public long? VerifiedLength { get; set; }
    public string? ETag { get; set; }
    public StoredObjectStatus Status { get; set; }
    public DateTimeOffset UploadExpiresAt { get; set; }
    public DateTimeOffset? UploadedAt { get; set; }
    public DateTimeOffset? DeletionRequestedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public int MaintenanceAttempts { get; set; }
    public DateTimeOffset? RetryAfter { get; set; }
    public string? LastStorageError { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public long CreatedBy { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long UpdatedBy { get; set; }
    public Project? Project { get; set; }
    public ICollection<ProjectDocument> Documents { get; set; } = [];
}

public sealed class ProjectDocument
{
    public Guid Id { get; set; }
    public long ProjectId { get; set; }
    public long PhaseId { get; set; }
    public Guid StoredObjectId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public long CreatedBy { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long UpdatedBy { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public long? DeletedBy { get; set; }
    public Project? Project { get; set; }
    public ProjectPhase? Phase { get; set; }
    public StoredObject? StoredObject { get; set; }
}
