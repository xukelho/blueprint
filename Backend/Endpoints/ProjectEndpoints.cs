using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
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
        projects.MapGet("/members", ListCompanyMembers);
        return endpoints;
    }

    private static async Task<IResult> List(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null) return TypedResults.NotFound();
        var query = db.Projects.AsNoTracking().Where(x => x.CompanyId == access.CompanyId);
        if (!access.IsOwner) query = query.Where(x => x.Members.Any(m => m.EmployeeId == access.EmployeeId));
        var items = await query.OrderBy(x => x.IsArchived).ThenBy(x => x.Title).Select(x => new ProjectSummaryResponse(x.Id, x.Title, x.Code, x.Address, x.GoogleMapsUrl, x.Phases.Where(phase => phase.IsCurrent).Select(phase => phase.PhaseCode).FirstOrDefault(), x.IsArchived, x.Client == null ? null : new ProjectClientResponse(x.Client.Id, x.Client.DisplayName), x.Members.OrderBy(m => m.Employee!.DisplayName).Select(m => new ProjectMemberResponse(m.EmployeeId, m.Employee!.DisplayName, m.Employee.Email ?? string.Empty)).ToArray())).ToArrayAsync(ct);
        return TypedResults.Ok(items);
    }

    private static async Task<IResult> Get(long id, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null) return TypedResults.NotFound();
        var project = await VisibleProjects(access, db).Include(x => x.Client).Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id, ct);
        return project is null ? TypedResults.NotFound() : TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> Create(CreateProjectRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var errors = Validate(request?.Title, request?.Code, request?.Address, request?.GoogleMapsUrl);
        var phaseCodes = request?.PhaseCodes ?? [];
        ValidatePhases(phaseCodes, request?.CurrentPhaseIndex, errors);
        if (request is null) errors["request"] = ["A JSON request body is required."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        if (!await ValidClient(request!.ClientId, access.CompanyId, db, ct) || !await ValidEmployees(request.EmployeeIds, access.CompanyId, db, ct)) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["association"] = ["The selected client or members do not belong to this company."] });
        if (await db.Projects.AnyAsync(x => x.CompanyId == access.CompanyId && x.Code == request.Code.Trim(), ct)) return TypedResults.Conflict(new AdministrationErrorResponse("A project with this code already exists."));
        var now = DateTimeOffset.UtcNow;
        var project = new Project { CompanyId = access.CompanyId, ClientId = request.ClientId, Title = request.Title.Trim(), Code = request.Code.Trim(), Address = request.Address.Trim(), GoogleMapsUrl = NormalizeGoogleMapsUrl(request.GoogleMapsUrl), CreatedAt = now, UpdatedAt = now, CreatedBy = access.UserId, UpdatedBy = access.UserId };
        project.Members = request.EmployeeIds.Distinct().Select(id => new ProjectMember { EmployeeId = id }).ToList();
        project.Phases = BuildPhases(phaseCodes, request.CurrentPhaseIndex);
        db.Projects.Add(project); await db.SaveChangesAsync(ct);
        await db.Entry(project).Reference(x => x.Client).LoadAsync(ct); await db.Entry(project).Collection(x => x.Members).Query().Include(x => x.Employee).LoadAsync(ct); await db.Entry(project).Collection(x => x.Phases).LoadAsync(ct);
        return TypedResults.Created($"/api/projects/{project.Id}", ToResponse(project, access));
    }

    private static async Task<IResult> Update(long id, UpdateProjectRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var errors = Validate(request?.Title, request?.Code, request?.Address, request?.GoogleMapsUrl); if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        var project = await db.Projects.Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.Client).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct);
        if (project is null) return TypedResults.NotFound();
        if (!await ValidClient(request!.ClientId, access.CompanyId, db, ct)) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["clientId"] = ["The selected client does not belong to this company."] });
        if (await db.Projects.AnyAsync(x => x.Id != id && x.CompanyId == access.CompanyId && x.Code == request.Code.Trim(), ct)) return TypedResults.Conflict(new AdministrationErrorResponse("A project with this code already exists."));
        project.Title = request.Title.Trim(); project.Code = request.Code.Trim(); project.Address = request.Address.Trim(); project.GoogleMapsUrl = NormalizeGoogleMapsUrl(request.GoogleMapsUrl); project.ClientId = request.ClientId; project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId;
        await db.SaveChangesAsync(ct); await db.Entry(project).Reference(x => x.Client).LoadAsync(ct); return TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> UpdateMembers(long id, UpdateProjectMembersRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        if (request?.EmployeeIds is null || !await ValidEmployees(request.EmployeeIds, access.CompanyId, db, ct)) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["employeeIds"] = ["Select valid company members."] });
        var project = await db.Projects.Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.Client).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct); if (project is null) return TypedResults.NotFound();
        project.Members.Clear(); foreach (var employeeId in request.EmployeeIds.Distinct()) project.Members.Add(new ProjectMember { ProjectId = project.Id, EmployeeId = employeeId });
        project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId; await db.SaveChangesAsync(ct); await db.Entry(project).Collection(x => x.Members).Query().Include(x => x.Employee).LoadAsync(ct); return TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> UpdatePhases(long id, UpdateProjectPhasesRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is null) return TypedResults.NotFound();
        var errors = new Dictionary<string, string[]>();
        var phaseCodes = request?.PhaseCodes ?? [];
        ValidatePhases(phaseCodes, request?.CurrentPhaseIndex, errors);
        if (request is null) errors["request"] = ["A JSON request body is required."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        var project = await db.Projects.Include(x => x.Client).Include(x => x.Members).ThenInclude(x => x.Employee).Include(x => x.Phases).SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct);
        if (project is null || !CanEditTimeline(project, access)) return TypedResults.NotFound();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        project.Phases.Clear();
        await db.SaveChangesAsync(ct);
        foreach (var phase in BuildPhases(phaseCodes, request!.CurrentPhaseIndex)) project.Phases.Add(phase);
        project.UpdatedAt = DateTimeOffset.UtcNow;
        project.UpdatedBy = access.UserId;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(ToResponse(project, access));
    }

    private static async Task<IResult> Archive(long id, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var project = await db.Projects.SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct); if (project is null) return TypedResults.NotFound();
        project.IsArchived = true; project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId; await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }

    private static async Task<IResult> ListCompanyMembers(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var members = await db.CompanyEmployees.AsNoTracking().Where(x => x.CompanyId == access.CompanyId && x.IsArchitect && x.Employee!.User!.IsActive).OrderBy(x => x.Employee!.DisplayName).Select(x => new ProjectMemberResponse(x.EmployeeId, x.Employee!.DisplayName, x.Employee.Email ?? string.Empty)).ToArrayAsync(ct); return TypedResults.Ok(members);
    }

    internal static IQueryable<Project> VisibleProjects(Access access, BlueprintDbContext db) => db.Projects.Where(x => x.CompanyId == access.CompanyId && (access.IsOwner || x.Members.Any(m => m.EmployeeId == access.EmployeeId)));
    private static ProjectResponse ToResponse(Project x, Access access) => new(x.Id, x.Title, x.Code, x.Address, x.GoogleMapsUrl, x.IsArchived, x.Client is null ? null : new ProjectClientResponse(x.Client.Id, x.Client.DisplayName), x.Members.OrderBy(m => m.Employee!.DisplayName).Select(m => new ProjectMemberResponse(m.EmployeeId, m.Employee!.DisplayName, m.Employee.Email ?? string.Empty)).ToArray(), x.Phases.OrderBy(phase => phase.Position).Select(phase => new ProjectPhaseResponse(phase.Id, phase.PhaseCode, ProjectPhaseCatalog.Labels[phase.PhaseCode], phase.Position, phase.IsCurrent)).ToArray(), CanEditTimeline(x, access));
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
    private static async Task<bool> ValidClient(long? id, long companyId, BlueprintDbContext db, CancellationToken ct) => id is null || await db.CompanyClients.AnyAsync(x => x.ClientId == id && x.CompanyId == companyId, ct);
    private static async Task<bool> ValidEmployees(IReadOnlyList<long>? ids, long companyId, BlueprintDbContext db, CancellationToken ct) { if (ids is null || ids.Count != ids.Distinct().Count()) return false; return await db.CompanyEmployees.CountAsync(x => x.CompanyId == companyId && x.IsArchitect && x.Employee!.User!.IsActive && ids.Contains(x.EmployeeId), ct) == ids.Count; }
}

internal sealed record Access(long UserId, long EmployeeId, long CompanyId, bool IsOwner)
{
    internal static async Task<Access?> ForUser(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        if (!long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return null;
        return await db.CompanyEmployees.AsNoTracking().Where(x => x.Employee!.UserId == userId && x.Employee.User!.IsActive && x.Company!.IsActive).Select(x => new Access(userId, x.EmployeeId, x.CompanyId, x.CompanyRole == CompanyRoles.Owner)).SingleOrDefaultAsync(ct);
    }
}
