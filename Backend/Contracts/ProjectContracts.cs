namespace Blueprint.Api.Contracts;

public sealed record ProjectClientResponse(long Id, string DisplayName);
public sealed record ProjectMemberResponse(long EmployeeId, string DisplayName, string Email);
public sealed record ProjectPhaseResponse(long Id, string Code, string Label, int Position, bool IsCurrent);
public sealed record ProjectSummaryResponse(long Id, long CompanyId, string CompanyName, string Title, string Code, string Address, string? GoogleMapsUrl, string? CurrentPhaseCode, bool IsArchived, ProjectClientResponse? Client, IReadOnlyList<ProjectMemberResponse> Members);
public sealed record ProjectResponse(long Id, long CompanyId, string CompanyName, string Title, string Code, string Address, string? GoogleMapsUrl, bool IsArchived, ProjectClientResponse? Client, IReadOnlyList<ProjectMemberResponse> Members, IReadOnlyList<ProjectPhaseResponse> Phases, bool CanEditTimeline);
public sealed record CreateProjectRequest(string Title, string Code, string Address, string? GoogleMapsUrl, long? ClientId, IReadOnlyList<long> EmployeeIds, IReadOnlyList<string>? PhaseCodes, int? CurrentPhaseIndex);
public sealed record UpdateProjectRequest(string Title, string Code, string Address, string? GoogleMapsUrl, long? ClientId);
public sealed record UpdateProjectMembersRequest(IReadOnlyList<long> EmployeeIds);
public sealed record UpdateProjectPhasesRequest(IReadOnlyList<string>? PhaseCodes, int? CurrentPhaseIndex);
public sealed record ClientListItemResponse(long Id, string DisplayName, string Email, int ProjectCount);
public sealed record ClientProjectResponse(long Id, string Title, string Code, string? CurrentPhaseCode, bool IsArchived);
public sealed record ClientDetailResponse(long Id, string DisplayName, string FullName, string Nif, string Email, string PhoneNumber, string Address, string InternalNotes, IReadOnlyList<ClientProjectResponse> Projects, bool CanManageProjects);
public sealed record UpdateClientNotesRequest(string InternalNotes);
public sealed record CreateClientInvitationRequest(string Email);
public sealed record ClientInvitationResponse(long Id, string Email, DateTimeOffset SentAt, DateTimeOffset ExpiresAt);
public sealed record ReceivedClientInvitationResponse(long Id, long CompanyId, string CompanyName, DateTimeOffset SentAt, DateTimeOffset ExpiresAt);
