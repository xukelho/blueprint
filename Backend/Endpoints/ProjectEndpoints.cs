using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class ProjectEndpoints
{
    public static IEndpointRouteBuilder MapProjectEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var projects = endpoints.MapGroup("/api/projects").WithTags("Projects").RequireAuthorization();
        projects.MapGet("/", List);
        projects.MapPost("/", Create);
        projects.MapGet("/{id:long}", Get);
        projects.MapPut("/{id:long}", Update);
        projects.MapPut("/{id:long}/members", UpdateMembers);
        projects.MapPut("/{id:long}/phases", UpdatePhases);
        projects.MapPost("/{id:long}/archive", Archive);
        projects.MapPost("/{id:long}/reactivate", Reactivate);
        projects.MapGet("/members", ListCompanyMembers);
        return endpoints;
    }

    private static async Task<IResult> List(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        IQueryable<Project> query;
        if (access is not null)
        {
            query = VisibleProjects(access, db).AsNoTracking();
        }
        else
        {
            var clientId = await CurrentClientId(principal, db, ct);
            if (clientId is null) return TypedResults.NotFound();
            query = VisibleClientProjects(clientId.Value, db).AsNoTracking();
        }
        var items = await query.OrderBy(x => x.Company!.Name).ThenBy(x => x.IsArchived).ThenBy(x => x.Title).Select(x => new ProjectSummaryResponse(x.Id, x.CompanyId, x.Company!.Name, x.Title, x.Code, x.Address, x.GoogleMapsUrl, x.Phases.Where(phase => phase.IsCurrent).Select(phase => phase.PhaseCode).FirstOrDefault(), x.IsArchived, x.ProjectClients.OrderBy(projectClient => projectClient.Client!.DisplayName).ThenBy(projectClient => projectClient.ClientId).Select(projectClient => new ProjectClientResponse(projectClient.ClientId, projectClient.Client!.DisplayName)).ToArray(), x.Members.OrderBy(m => m.Employee!.DisplayName).Select(m => new ProjectMemberResponse(m.EmployeeId, m.Employee!.DisplayName, m.Employee.Email ?? string.Empty)).ToArray())).ToArrayAsync(ct);
        return TypedResults.Ok(items);
    }

    private static async Task<IResult> Get(long id, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        IQueryable<Project> query;
        if (access is not null)
        {
            query = VisibleProjects(access, db);
        }
        else
        {
            var clientId = await CurrentClientId(principal, db, ct);
            if (clientId is null) return TypedResults.NotFound();
            query = VisibleClientProjects(clientId.Value, db);
        }
        var project = await query.Include(x => x.Company).Include(x => x.ProjectClients).ThenInclude(x => x.Client).Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id, ct);
        return project is null ? TypedResults.NotFound() : TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> Create(CreateProjectRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var errors = Validate(request?.Title, request?.Code, request?.Address, request?.GoogleMapsUrl);
        var phaseCodes = request?.PhaseCodes ?? [];
        ValidatePhases(phaseCodes, request?.CurrentPhaseIndex, errors);
        if (request is null) errors["request"] = ["A JSON request body is required."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        if (!await ValidClients(request!.ClientIds, access.CompanyId, db, ct) || !await ValidEmployees(request.EmployeeIds, access.CompanyId, db, ct)) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["association"] = ["The selected clients or members do not belong to this company."] });
        if (await db.Projects.AnyAsync(x => x.CompanyId == access.CompanyId && x.Code == request.Code.Trim(), ct)) return TypedResults.Conflict(new AdministrationErrorResponse("A project with this code already exists."));
        var now = DateTimeOffset.UtcNow;
        var project = new Project { CompanyId = access.CompanyId, Title = request.Title.Trim(), Code = request.Code.Trim(), Address = request.Address.Trim(), GoogleMapsUrl = NormalizeGoogleMapsUrl(request.GoogleMapsUrl), CreatedAt = now, UpdatedAt = now, CreatedBy = access.UserId, UpdatedBy = access.UserId };
        ReplaceClients(project, request.ClientIds);
        project.Members = request.EmployeeIds.Distinct().Select(id => new ProjectMember { EmployeeId = id }).ToList();
        project.Phases = BuildPhases(phaseCodes, request.CurrentPhaseIndex);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.Projects.Add(project); await db.SaveChangesAsync(ct);
        await notifications.AddAsync(new ProjectNotificationCommand(
            project.Id, access.UserId, ProjectEventTypes.ProjectCreated, "criou o projeto.",
            NotificationTargetKinds.Project, $"project-created:{project.Id}"), ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await db.Entry(project).Reference(x => x.Company).LoadAsync(ct); await db.Entry(project).Collection(x => x.ProjectClients).Query().Include(x => x.Client).LoadAsync(ct); await db.Entry(project).Collection(x => x.Members).Query().Include(x => x.Employee).LoadAsync(ct); await db.Entry(project).Collection(x => x.Phases).LoadAsync(ct);
        return TypedResults.Created($"/api/projects/{project.Id}", ToResponse(project, access));
    }

    private static async Task<IResult> Update(long id, UpdateProjectRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var errors = Validate(request?.Title, request?.Code, request?.Address, request?.GoogleMapsUrl); if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await LockProject(id, access.CompanyId, db, ct)) return TypedResults.NotFound();
        var project = await db.Projects.Include(x => x.Company).Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.ProjectClients).ThenInclude(x => x.Client).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct);
        if (project is null) return TypedResults.NotFound();
        if (!await ValidClients(request!.ClientIds, access.CompanyId, db, ct)) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["clientIds"] = ["Select valid company clients."] });
        if (await db.Projects.AnyAsync(x => x.Id != id && x.CompanyId == access.CompanyId && x.Code == request.Code.Trim(), ct)) return TypedResults.Conflict(new AdministrationErrorResponse("A project with this code already exists."));
        var previousClientIds = project.ProjectClients.Select(item => item.ClientId).ToHashSet();
        var selectedClientIds = request.ClientIds.ToHashSet();
        var addedClientIds = selectedClientIds.Except(previousClientIds).ToArray();
        var removedClientIds = previousClientIds.Except(selectedClientIds).ToArray();
        var removedUserIds = await ClientUserIds(removedClientIds, db, ct);
        project.Title = request.Title.Trim(); project.Code = request.Code.Trim(); project.Address = request.Address.Trim(); project.GoogleMapsUrl = NormalizeGoogleMapsUrl(request.GoogleMapsUrl); ReplaceClients(project, request.ClientIds); project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId;
        await db.SaveChangesAsync(ct);
        if (addedClientIds.Length != 0 || removedClientIds.Length != 0)
        {
            await notifications.AddAsync(new ProjectNotificationCommand(
                id, access.UserId, ProjectEventTypes.ParticipantsChanged,
                ParticipantSummary(addedClientIds.Length, removedClientIds.Length), NotificationTargetKinds.Project,
                $"participants-clients:{id}:{project.UpdatedAt.UtcTicks}", Context: new { added = addedClientIds.Length, removed = removedClientIds.Length },
                AdditionalRecipientUserIds: removedUserIds), ct);
            await db.SaveChangesAsync(ct);
        }
        await db.Entry(project).Collection(x => x.ProjectClients).Query().Include(x => x.Client).LoadAsync(ct); await transaction.CommitAsync(ct); return TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> UpdateMembers(long id, UpdateProjectMembersRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        if (request?.EmployeeIds is null || !await ValidEmployees(request.EmployeeIds, access.CompanyId, db, ct)) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["employeeIds"] = ["Select valid company members."] });
        var project = await db.Projects.Include(x => x.Company).Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.ProjectClients).ThenInclude(x => x.Client).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct); if (project is null) return TypedResults.NotFound();
        var previousIds = project.Members.Select(item => item.EmployeeId).ToHashSet();
        var selectedIds = request.EmployeeIds.ToHashSet();
        var addedIds = selectedIds.Except(previousIds).ToArray();
        var removedIds = previousIds.Except(selectedIds).ToArray();
        if (addedIds.Length == 0 && removedIds.Length == 0) return TypedResults.Ok(ToResponse(project, access));
        var removedUserIds = await EmployeeUserIds(removedIds, db, ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        project.Members.Clear(); foreach (var employeeId in request.EmployeeIds.Distinct()) project.Members.Add(new ProjectMember { ProjectId = project.Id, EmployeeId = employeeId });
        project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId; await db.SaveChangesAsync(ct);
        await notifications.AddAsync(new ProjectNotificationCommand(
            id, access.UserId, ProjectEventTypes.ParticipantsChanged,
            ParticipantSummary(addedIds.Length, removedIds.Length), NotificationTargetKinds.Project,
            $"participants-employees:{id}:{project.UpdatedAt.UtcTicks}", Context: new { added = addedIds.Length, removed = removedIds.Length },
            AdditionalRecipientUserIds: removedUserIds), ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await db.Entry(project).Collection(x => x.Members).Query().Include(x => x.Employee).LoadAsync(ct); return TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> UpdatePhases(long id, UpdateProjectPhasesRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, ProjectPhaseService phaseService, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null) return TypedResults.NotFound();
        var errors = new Dictionary<string, string[]>();
        var phaseCodes = request?.PhaseCodes ?? [];
        ValidatePhases(phaseCodes, request?.CurrentPhaseIndex, errors);
        if (request is null) errors["request"] = ["A JSON request body is required."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var project = await db.Projects.Include(x => x.Company).Include(x => x.ProjectClients).ThenInclude(x => x.Client).Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct);
        if (project is null || !CanEditTimeline(project, access)) return TypedResults.NotFound();

        var current = project.Phases.OrderBy(item => item.Position).Select(item => (item.PhaseCode, item.IsCurrent)).ToArray();
        var desired = phaseCodes.Select((code, index) => (code, index == request!.CurrentPhaseIndex)).ToArray();
        if (current.SequenceEqual(desired)) return TypedResults.Ok(ToResponse(project, access));

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        project.UpdatedAt = DateTimeOffset.UtcNow;
        project.UpdatedBy = access.UserId;
        try
        {
            await phaseService.ReconcileAsync(project, phaseCodes, request!.CurrentPhaseIndex, ct);
        }
        catch (PhaseHasDocumentsException exception)
        {
            return TypedResults.Conflict(new AdministrationErrorResponse(exception.Message));
        }
        await notifications.AddAsync(new ProjectNotificationCommand(
            id, access.UserId, ProjectEventTypes.TimelineChanged, "alterou a timeline do projeto.",
            NotificationTargetKinds.Timeline, $"timeline:{id}:{project.UpdatedAt.UtcTicks}"), ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> Archive(long id, ClaimsPrincipal principal, BlueprintDbContext db, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var project = await db.Projects.SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct); if (project is null) return TypedResults.NotFound();
        if (project.IsArchived) return TypedResults.NoContent();
        project.IsArchived = true; project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId;
        await notifications.AddAsync(new ProjectNotificationCommand(id, access.UserId, ProjectEventTypes.ProjectArchived,
            "arquivou o projeto.", NotificationTargetKinds.Project, $"project-archived:{id}:{project.UpdatedAt.UtcTicks}"), ct);
        await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }

    private static async Task<IResult> Reactivate(long id, ClaimsPrincipal principal, BlueprintDbContext db, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var project = await db.Projects.SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct); if (project is null) return TypedResults.NotFound();
        if (!project.IsArchived) return TypedResults.NoContent();
        project.IsArchived = false; project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId;
        await notifications.AddAsync(new ProjectNotificationCommand(id, access.UserId, ProjectEventTypes.ProjectReactivated,
            "reativou o projeto.", NotificationTargetKinds.Project, $"project-reactivated:{id}:{project.UpdatedAt.UtcTicks}"), ct);
        await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }

    private static async Task<IResult> ListCompanyMembers(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var members = await db.CompanyEmployees.AsNoTracking().Where(x => x.CompanyId == access.CompanyId && x.IsArchitect && x.Employee!.User!.IsActive).OrderBy(x => x.Employee!.DisplayName).Select(x => new ProjectMemberResponse(x.EmployeeId, x.Employee!.DisplayName, x.Employee.Email ?? string.Empty)).ToArrayAsync(ct); return TypedResults.Ok(members);
    }

    internal static IQueryable<Project> VisibleProjects(Access access, BlueprintDbContext db) => db.Projects.Where(x => x.CompanyId == access.CompanyId && (access.IsOwner || x.Members.Any(m => m.EmployeeId == access.EmployeeId)));
    internal static IQueryable<Project> VisibleClientProjects(long clientId, BlueprintDbContext db) =>
        db.Projects.Where(project => project.Company!.IsActive &&
            project.ProjectClients.Any(projectClient => projectClient.ClientId == clientId && projectClient.Client!.CompanyClients.Any(membership => membership.CompanyId == project.CompanyId)));
    internal static async Task<long?> CurrentClientId(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        if (!principal.IsInRole("client") || !long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return null;
        return await db.Clients.AsNoTracking().Where(client => client.UserId == userId && client.User!.IsActive).Select(client => (long?)client.Id).SingleOrDefaultAsync(ct);
    }
    private static ProjectResponse ToResponse(Project x, Access? access) => new(x.Id, x.CompanyId, x.Company!.Name, x.Title, x.Code, x.Address, x.GoogleMapsUrl, x.IsArchived, x.ProjectClients.OrderBy(projectClient => projectClient.Client!.DisplayName).ThenBy(projectClient => projectClient.ClientId).Select(projectClient => new ProjectClientResponse(projectClient.ClientId, projectClient.Client!.DisplayName)).ToArray(), x.Members.OrderBy(m => m.Employee!.DisplayName).Select(m => new ProjectMemberResponse(m.EmployeeId, m.Employee!.DisplayName, m.Employee.Email ?? string.Empty)).ToArray(), x.Phases.OrderBy(phase => phase.Position).Select(phase => new ProjectPhaseResponse(phase.Id, phase.PhaseCode, ProjectPhaseCatalog.Labels[phase.PhaseCode], phase.Position, phase.IsCurrent)).ToArray(), access is not null && CanEditTimeline(x, access));
    internal static void ReplaceClients(Project project, IReadOnlyCollection<long> clientIds)
    {
        var selectedClientIds = clientIds.ToHashSet();
        foreach (var projectClient in project.ProjectClients.Where(projectClient => !selectedClientIds.Contains(projectClient.ClientId)).ToArray())
        {
            project.ProjectClients.Remove(projectClient);
        }
        var existingClientIds = project.ProjectClients.Select(projectClient => projectClient.ClientId).ToHashSet();
        foreach (var clientId in selectedClientIds.Where(clientId => !existingClientIds.Contains(clientId)))
        {
            project.ProjectClients.Add(new ProjectClient { ProjectId = project.Id, ClientId = clientId });
        }
    }
    internal static bool RemoveClient(Project project, long clientId)
    {
        var projectClient = project.ProjectClients.SingleOrDefault(candidate => candidate.ClientId == clientId);
        if (projectClient is null) return false;
        project.ProjectClients.Remove(projectClient);
        return true;
    }
    internal static async Task<bool> LockProject(long projectId, long companyId, BlueprintDbContext db, CancellationToken ct) =>
        await db.Database.SqlQuery<long>($"SELECT id AS \"Value\" FROM projects WHERE id = {projectId} AND company_id = {companyId} FOR UPDATE").SingleOrDefaultAsync(ct) != 0;
    private static bool CanEditTimeline(Project project, Access access) => access.IsOwner || project.Members.Any(member => member.EmployeeId == access.EmployeeId);
    private static List<ProjectPhase> BuildPhases(IReadOnlyList<string> phaseCodes, int? currentPhaseIndex) => phaseCodes.Select((code, position) => new ProjectPhase { PhaseCode = code, Position = position, IsCurrent = position == currentPhaseIndex }).ToList();
    private static void ValidatePhases(IReadOnlyList<string> phaseCodes, int? currentPhaseIndex, Dictionary<string, string[]> errors)
    {
        if (phaseCodes.Any(code => !ProjectPhaseCatalog.Labels.ContainsKey(code))) errors["phaseCodes"] = ["Select valid project phases."];
        if (currentPhaseIndex is < 0 || currentPhaseIndex >= phaseCodes.Count) errors["currentPhaseIndex"] = ["The current phase must belong to the project timeline."];
    }
    private static Dictionary<string, string[]> Validate(string? title, string? code, string? address, string? googleMapsUrl)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(title) || title.Length > 256) errors["title"] = ["This field is required or too long."];
        if (string.IsNullOrWhiteSpace(code) || code.Length > 64) errors["code"] = ["This field is required or too long."];
        if (address?.Length > 1024) errors["address"] = ["This field is too long."];
        if (!IsValidGoogleMapsUrl(googleMapsUrl)) errors["googleMapsUrl"] = ["Provide a valid HTTPS Google Maps URL."];
        return errors;
    }

    private static string? NormalizeGoogleMapsUrl(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool IsValidGoogleMapsUrl(string? value)
    {
        var normalized = NormalizeGoogleMapsUrl(value);
        if (normalized is null) return true;
        if (normalized.Length > 2048 || !Uri.TryCreate(normalized, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return false;
        var host = uri.Host.ToLowerInvariant();
        return host is "maps.app.goo.gl" or "goo.gl" || host == "google.com" || host.EndsWith(".google.com", StringComparison.Ordinal);
    }
    private static async Task<bool> ValidClients(IReadOnlyList<long>? ids, long companyId, BlueprintDbContext db, CancellationToken ct)
    {
        if (ids is null || ids.Count != ids.Distinct().Count()) return false;
        return await db.CompanyClients.CountAsync(x => x.CompanyId == companyId && ids.Contains(x.ClientId), ct) == ids.Count;
    }
    private static async Task<bool> ValidEmployees(IReadOnlyList<long>? ids, long companyId, BlueprintDbContext db, CancellationToken ct) { if (ids is null || ids.Count != ids.Distinct().Count()) return false; return await db.CompanyEmployees.CountAsync(x => x.CompanyId == companyId && x.IsArchitect && x.Employee!.User!.IsActive && ids.Contains(x.EmployeeId), ct) == ids.Count; }
    private static Task<long[]> ClientUserIds(IEnumerable<long> ids, BlueprintDbContext db, CancellationToken ct) =>
        db.Clients.AsNoTracking().Where(item => ids.Contains(item.Id)).Select(item => item.UserId).ToArrayAsync(ct);
    private static Task<long[]> EmployeeUserIds(IEnumerable<long> ids, BlueprintDbContext db, CancellationToken ct) =>
        db.Employees.AsNoTracking().Where(item => ids.Contains(item.Id)).Select(item => item.UserId).ToArrayAsync(ct);
    private static string ParticipantSummary(int added, int removed) => (added, removed) switch
    {
        (> 0, > 0) => $"alterou os participantes do projeto: {added} adicionados e {removed} removidos.",
        (> 0, _) => $"adicionou {added} participantes ao projeto.",
        _ => $"removeu {removed} participantes do projeto."
    };
}

internal sealed record Access(long UserId, long EmployeeId, long CompanyId, bool IsOwner)
{
    internal static async Task<Access?> ForUser(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        if (!long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return null;
        return await db.CompanyEmployees.AsNoTracking().Where(x => x.Employee!.UserId == userId && x.Employee.User!.IsActive && x.Company!.IsActive).Select(x => new Access(userId, x.EmployeeId, x.CompanyId, x.CompanyRole == CompanyRoles.Owner)).SingleOrDefaultAsync(ct);
    }
}
