using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class ProjectMessageEndpoints
{
    private const int DefaultPageSize = 50;
    private const int MaximumPageSize = 100;

    public static IEndpointRouteBuilder MapProjectMessageEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var messages = endpoints.MapGroup("/api/projects/{projectId:long}/messages")
            .WithTags("Project messages")
            .RequireAuthorization();
        messages.MapGet("/", List);
        messages.MapPost("/", Create);
        return endpoints;
    }

    private static async Task<IResult> List(
        long projectId,
        long? beforeId,
        long? afterId,
        int? limit,
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        CancellationToken ct)
    {
        if (beforeId is not null && afterId is not null)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["cursor"] = ["Use either beforeId or afterId, not both."] });

        if (!TryGetUserId(principal, out var userId) || !await CanAccessProject(projectId, principal, db, ct))
            return TypedResults.NotFound();

        var pageSize = Math.Clamp(limit ?? DefaultPageSize, 1, MaximumPageSize);
        var query = db.ProjectMessages.AsNoTracking().Where(message => message.ProjectId == projectId);
        ProjectMessage[] selected;
        bool hasMore;

        if (afterId is long after)
        {
            var candidates = await query.Where(message => message.Id > after).OrderBy(message => message.Id).Take(pageSize + 1).ToArrayAsync(ct);
            hasMore = candidates.Length > pageSize;
            selected = candidates.Take(pageSize).ToArray();
        }
        else
        {
            if (beforeId is long before) query = query.Where(message => message.Id < before);
            var candidates = await query.OrderByDescending(message => message.Id).Take(pageSize + 1).ToArrayAsync(ct);
            hasMore = candidates.Length > pageSize;
            selected = candidates.Take(pageSize).Reverse().ToArray();
        }

        return TypedResults.Ok(new ProjectMessagePageResponse(
            selected.Select(message => ToResponse(message, userId)).ToArray(),
            hasMore));
    }

    private static async Task<IResult> Create(
        long projectId,
        CreateProjectMessageRequest? request,
        ClaimsPrincipal principal,
        BlueprintDbContext db,
        IProjectNotificationService notifications,
        CancellationToken ct)
    {
        if (!TryGetUserId(principal, out var userId)) return TypedResults.NotFound();
        var visibleProjects = await VisibleProjects(principal, db, ct);
        var project = await visibleProjects.SingleOrDefaultAsync(candidate => candidate.Id == projectId, ct);
        if (project is null) return TypedResults.NotFound();

        var body = request?.Body?.Trim();
        if (string.IsNullOrWhiteSpace(body) || body.Length > 4000)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["body"] = ["Message text is required and cannot exceed 4000 characters."] });
        if (project.IsArchived)
            return TypedResults.Conflict(new AdministrationErrorResponse("Archived projects are read-only."));

        var authorDisplayName = await CurrentDisplayName(userId, db, ct);
        if (authorDisplayName is null) return TypedResults.NotFound();

        var message = new ProjectMessage
        {
            ProjectId = projectId,
            AuthorUserId = userId,
            AuthorDisplayName = authorDisplayName,
            Body = body,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.ProjectMessages.Add(message);
        await db.SaveChangesAsync(ct);
        await notifications.AddAsync(new ProjectNotificationCommand(
            projectId, userId, ProjectEventTypes.GlobalMessageCreated,
            "adicionou uma mensagem à conversa geral.", NotificationTargetKinds.GlobalMessage,
            $"project-message:{message.Id}", MessageId: message.Id), ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Created($"/api/projects/{projectId}/messages/{message.Id}", ToResponse(message, userId));
    }

    private static async Task<bool> CanAccessProject(long projectId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var visibleProjects = await VisibleProjects(principal, db, ct);
        return await visibleProjects.AnyAsync(project => project.Id == projectId, ct);
    }

    private static async Task<IQueryable<Project>> VisibleProjects(ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await Access.ForUser(principal, db, ct);
        if (access is not null) return ProjectEndpoints.VisibleProjects(access, db);
        var clientId = await ProjectEndpoints.CurrentClientId(principal, db, ct);
        return clientId is long id ? ProjectEndpoints.VisibleClientProjects(id, db) : db.Projects.Where(_ => false);
    }

    private static async Task<string?> CurrentDisplayName(long userId, BlueprintDbContext db, CancellationToken ct)
    {
        var employeeName = await db.Employees.AsNoTracking().Where(employee => employee.UserId == userId && employee.User!.IsActive)
            .Select(employee => employee.DisplayName).SingleOrDefaultAsync(ct);
        if (employeeName is not null) return employeeName;
        return await db.Clients.AsNoTracking().Where(client => client.UserId == userId && client.User!.IsActive)
            .Select(client => client.DisplayName).SingleOrDefaultAsync(ct);
    }

    private static ProjectMessageResponse ToResponse(ProjectMessage message, long userId) =>
        new(message.Id, message.AuthorDisplayName, message.Body, message.CreatedAt, message.AuthorUserId == userId);

    private static bool TryGetUserId(ClaimsPrincipal principal, out long userId) =>
        long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}
