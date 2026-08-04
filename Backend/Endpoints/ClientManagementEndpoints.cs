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
        var results = await db.CompanyClients.AsNoTracking()
            .Where(membership => membership.CompanyId == access.CompanyId)
            .OrderBy(membership => membership.Client!.DisplayName)
            .Select(membership => new ClientListItemResponse(
                membership.ClientId,
                membership.Client!.DisplayName,
                membership.Client.Email,
                membership.Client.ProjectClients.Count(projectClient => projectClient.Project!.CompanyId == access.CompanyId)))
            .ToArrayAsync(ct);
        return TypedResults.Ok(results);
    }

    private static async Task<IResult> Get(long id, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null) return TypedResults.NotFound();
        var membership = await db.CompanyClients.AsNoTracking()
            .Include(value => value.Client)
            .SingleOrDefaultAsync(value => value.ClientId == id && value.CompanyId == access.CompanyId, ct);
        if (membership?.Client is null) return TypedResults.NotFound();
        var client = membership.Client;
        var projects = await ProjectEndpoints.VisibleProjects(access, db).Where(x => x.ProjectClients.Any(projectClient => projectClient.ClientId == id)).OrderBy(x => x.Title).Select(x => new ClientProjectResponse(x.Id, x.Title, x.Code, x.Phases.Where(phase => phase.IsCurrent).Select(phase => phase.PhaseCode).FirstOrDefault(), x.IsArchived)).ToArrayAsync(ct);
        return TypedResults.Ok(new ClientDetailResponse(client.Id, client.DisplayName, client.FullName, client.Nif, client.Email, client.PhoneNumber, client.Address, membership.InternalNotes, projects, access.IsOwner));
    }

    private static async Task<IResult> UpdateNotes(long id, UpdateClientNotesRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null) return TypedResults.NotFound();
        if (request is null || request.InternalNotes is null || request.InternalNotes.Length > 4000) return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["internalNotes"] = ["Internal notes must contain at most 4000 characters."] });
        var membership = await db.CompanyClients.SingleOrDefaultAsync(
            value => value.ClientId == id && value.CompanyId == access.CompanyId, ct);
        if (membership is null) return TypedResults.NotFound();
        membership.InternalNotes = request.InternalNotes.Trim(); await db.SaveChangesAsync(ct); return TypedResults.NoContent();
    }

    private static async Task<IResult> AssociateProject(long id, long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        if (!await db.CompanyClients.AnyAsync(x => x.ClientId == id && x.CompanyId == access.CompanyId, ct)) return TypedResults.NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await ProjectEndpoints.LockProject(projectId, access.CompanyId, db, ct)) return TypedResults.NotFound();
        var project = await db.Projects.Include(candidate => candidate.ProjectClients).SingleOrDefaultAsync(candidate => candidate.Id == projectId && candidate.CompanyId == access.CompanyId, ct);
        if (project is null || project.ProjectClients.Count != 0) return TypedResults.NotFound();
        ProjectEndpoints.ReplaceClient(project, id); project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId; await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return TypedResults.NoContent();
    }

    private static async Task<IResult> RemoveProject(long id, long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct); if (access is null || !access.IsOwner) return TypedResults.NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await ProjectEndpoints.LockProject(projectId, access.CompanyId, db, ct)) return TypedResults.NotFound();
        var project = await db.Projects.Include(candidate => candidate.ProjectClients).SingleOrDefaultAsync(candidate => candidate.Id == projectId && candidate.CompanyId == access.CompanyId, ct);
        if (project is null || !ProjectEndpoints.RemoveClient(project, id)) return TypedResults.NotFound();
        project.UpdatedAt = DateTimeOffset.UtcNow; project.UpdatedBy = access.UserId; await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return TypedResults.NoContent();
    }
}
