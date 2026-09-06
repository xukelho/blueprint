namespace Blueprint.Api.Data;

public sealed class Project
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public required string Title { get; set; }
    public required string Code { get; set; }
    public required string Address { get; set; }
    public string? GoogleMapsUrl { get; set; }
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public long CreatedBy { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public long UpdatedBy { get; set; }
    public Company? Company { get; set; }
    public ICollection<ProjectClient> ProjectClients { get; set; } = [];
    public ICollection<ProjectMember> Members { get; set; } = [];
    public ICollection<ProjectPhase> Phases { get; set; } = [];
    public ICollection<ProjectDocument> Documents { get; set; } = [];
    public ICollection<ProjectMessage> Messages { get; set; } = [];
    public ICollection<ProjectPartConversation> PartConversations { get; set; } = [];
    public ICollection<StoredObject> StoredObjects { get; set; } = [];
}

public sealed class ProjectPartConversation
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public Guid DocumentId { get; set; }
    public required string TargetKey { get; set; }
    public required string TargetKind { get; set; }
    public required string TargetLabel { get; set; }
    public required string Title { get; set; }
    public double AnchorX { get; set; }
    public double AnchorY { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public long CreatedBy { get; set; }
    public Project? Project { get; set; }
    public ProjectDocument? Document { get; set; }
    public ICollection<ProjectPartConversationMessage> Messages { get; set; } = [];
}

public sealed class ProjectPartConversationMessage
{
    public long Id { get; set; }
    public long ConversationId { get; set; }
    public long AuthorUserId { get; set; }
    public required string AuthorDisplayName { get; set; }
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public ProjectPartConversation? Conversation { get; set; }
    public User? AuthorUser { get; set; }
}

public sealed class ProjectMessage
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long AuthorUserId { get; set; }
    public required string AuthorDisplayName { get; set; }
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Project? Project { get; set; }
    public User? AuthorUser { get; set; }
}

public sealed class ProjectClient
{
    public long ProjectId { get; set; }
    public long ClientId { get; set; }
    public Project? Project { get; set; }
    public Client? Client { get; set; }
}

public sealed class ProjectPhase
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public required string PhaseCode { get; set; }
    public int Position { get; set; }
    public bool IsCurrent { get; set; }
    public Project? Project { get; set; }
    public ICollection<ProjectDocument> Documents { get; set; } = [];
}

public sealed class ProjectMember
{
    public long ProjectId { get; set; }
    public long EmployeeId { get; set; }
    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
}
