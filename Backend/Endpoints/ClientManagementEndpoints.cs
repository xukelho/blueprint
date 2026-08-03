using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class ClientManagementEndpoints
{
    public static IEndpointRouteBuilder MapClientManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var clients = endpoints.MapGroup("/api/clients").WithTags("Clients").RequireAuthorization();
        clients.MapGet("/", List);
        clients.MapGet("/{id:long}", Get);
        clients.MapPut("/{id:long}/notes", UpdateNotes);
        clients.MapPut("/{id:long}/projects/{projectId:long}", AssociateProject);
        clients.MapDelete("/{id:long}/projects/{projectId:long}", RemoveProject);
        return endpoints;
    }

    private static async Task<IResult> List(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null) return TypedResults.NotFound();
        var clients = db.Clients.AsNoTracking().Where(x => x.CompanyId == access.CompanyId);
        if (!access.IsOwner) clients = clients.Where(x => x.Projects.Any(p => p.Members.Any(m => m.EmployeeId == access.EmployeeId)));
        var results = await clients.OrderBy(x => x.DisplayName).Select(x => new ClientListItemResponse(x.Id, x.DisplayName, x.Email, x.Projects.Count)).ToArrayAsync(ct);
        return TypedResults.Ok(results);
    }

    private static async Task<IResult> Get(long id, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null) return TypedResults.NotFound();
        var client = await db.Clients.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId && (access.IsOwner || x.Projects.Any(p => p.Members.Any(m => m.EmployeeId == access.EmployeeId))), ct);
        if (client is null) return TypedResults.NotFound();
        var projects = await ProjectEndpoints.VisibleProjects(access, db).Where(x => x.ClientId == id).OrderBy(x => x.Title).Select(x => new ClientProjectResponse(x.Id, x.Title, x.Code, x.Phases.Where(phase => phase.IsCurrent).Select(phase => phase.PhaseCode).FirstOrDefault(), x.IsArchived)).ToArrayAsync(ct);
        return TypedResults.Ok(new ClientDetailResponse(client.Id, client.DisplayName, client.FullName, client.Nif, client.Email, client.PhoneNumber, client.Address, client.InternalNotes, projects, access.IsOwner));
    }

    private static async Task<IResult> UpdateNotes(long id, UpdateClientNotesRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null) return TypedResults.NotFound();
        if (request is null || request.InternalNotes is null || request.InternalNotes.Length > 4000) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["internalNotes"] = ["Internal notes must contain at most 4000 characters."] });
        var client = await db.Clients.SingleOrDefaultAsync(x => x.Id == id && x.CompanyId == access.CompanyId && (access.IsOwner || x.Projects.Any(p => p.Members.Any(m => m.EmployeeId == access.EmployeeId))), ct);
        if (client is null) return TypedResults.NotFound();
        client.InternalNotes = request.InternalNotes.Trim(); await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }

    private static async Task<IResult> AssociateProject(long id, long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        if (!await db.Clients.AnyAsync(x => x.Id == id && x.CompanyId == access.CompanyId, ct)) return TypedResults.NotFound();
        var project = await db.Projects.SingleOrDefaultAsync(x => x.Id == projectId && x.CompanyId == access.CompanyId && x.ClientId == null, ct); if (project is null) return TypedResults.NotFound();
        project.ClientId = id; project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId; await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }

    private static async Task<IResult> RemoveProject(long id, long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        var project = await db.Projects.SingleOrDefaultAsync(x => x.Id == projectId && x.CompanyId == access.CompanyId && x.ClientId == id, ct); if (project is null) return TypedResults.NotFound();
        project.ClientId = null; project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId; await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }
}
