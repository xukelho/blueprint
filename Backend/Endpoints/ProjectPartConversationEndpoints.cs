using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class ProjectPartConversationEndpoints
{
    public static IEndpointRouteBuilder MapProjectPartConversationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var conversations = endpoints.MapGroup("/api/projects/{projectId:long}/part-conversations")
            .WithTags("Project part conversations").RequireAuthorization();
        conversations.MapGet("/", List);
        conversations.MapPost("/", Create);
        conversations.MapGet("/{conversationId:long}/messages", ListMessages);
        conversations.MapPost("/{conversationId:long}/messages", CreateMessage);
        return endpoints;
    }

    private static async Task<IResult> List(long projectId, Guid? documentId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await ProjectDocumentAccessService.FindAccessAsync(projectId, principal, db, ct);
        if (access is null) return TypedResults.NotFound();
        var query = ReadableConversations(projectId, access, db);
        if (documentId is Guid id) query = query.Where(item => item.DocumentId == id);
        var items = await query.OrderBy(item => item.Id).Select(item => new ProjectPartConversationResponse(
            item.Id, item.DocumentId, item.TargetKey, item.TargetKind, item.TargetLabel, item.Title,
            item.AnchorX, item.AnchorY, item.CreatedAt, item.Messages.Count)).ToArrayAsync(ct);
        return TypedResults.Ok(items);
    }

    private static async Task<IResult> Create(long projectId, CreateProjectPartConversationRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await ProjectDocumentAccessService.FindAccessAsync(projectId, principal, db, ct);
        if (access is null) return TypedResults.NotFound();
        var userId = access.UserId;
        if (request is null || !double.IsFinite(request.AnchorX) || !double.IsFinite(request.AnchorY) ||
            string.IsNullOrWhiteSpace(request.TargetKey) || string.IsNullOrWhiteSpace(request.TargetKind) || string.IsNullOrWhiteSpace(request.TargetLabel))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["target"] = ["A valid drawing target is required."] });
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var document = await ProjectDocumentAccessService.LockAsync(db, request.DocumentId, ct);
        if (document is null || document.ProjectId != projectId || !ProjectDocumentAccessService.CanRead(document, access))
            return TypedResults.NotFound();
        if (access.IsArchived) return TypedResults.Conflict(new AdministrationErrorResponse("Archived projects are read-only."));
        if (await db.ProjectPartConversations.AnyAsync(item => item.DocumentId == request.DocumentId && item.TargetKey == request.TargetKey.Trim(), ct))
            return TypedResults.Conflict(new AdministrationErrorResponse("This drawing target already has a conversation."));

        var title = string.IsNullOrWhiteSpace(request.Title) ? request.TargetLabel.Trim() : request.Title.Trim();
        if (title.Length > 256 || request.TargetKey.Trim().Length > 256 || request.TargetKind.Trim().Length > 32 || request.TargetLabel.Trim().Length > 256)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["title"] = ["Conversation details are too long."] });
        var conversation = new ProjectPartConversation
        {
            ProjectId = projectId, DocumentId = request.DocumentId, TargetKey = request.TargetKey.Trim(),
            TargetKind = request.TargetKind.Trim(), TargetLabel = request.TargetLabel.Trim(), Title = title,
            AnchorX = request.AnchorX, AnchorY = request.AnchorY, CreatedAt = DateTimeOffset.UtcNow, CreatedBy = userId
        };
        db.ProjectPartConversations.Add(conversation);
        await db.SaveChangesAsync(ct);
        await notifications.AddAsync(new ProjectNotificationCommand(
            projectId, userId, ProjectEventTypes.PartConversationCreated,
            $"iniciou a conversa «{conversation.Title}».", NotificationTargetKinds.PartConversation,
            $"part-conversation:{conversation.Id}", conversation.DocumentId, conversation.Id,
            Context: new { conversation.Title, conversation.TargetLabel },
            Audience: AudienceFor(document)), ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Created($"/api/projects/{projectId}/part-conversations/{conversation.Id}", ToResponse(conversation, 0));
    }

    private static async Task<IResult> ListMessages(long projectId, long conversationId, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        var access = await ProjectDocumentAccessService.FindAccessAsync(projectId, principal, db, ct);
        if (access is null || !await ReadableConversations(projectId, access, db).AnyAsync(item => item.Id == conversationId, ct))
            return TypedResults.NotFound();
        var userId = access.UserId;
        var messages = await db.ProjectPartConversationMessages.AsNoTracking().Where(item => item.ConversationId == conversationId)
            .OrderBy(item => item.Id).Select(item => new ProjectPartConversationMessageResponse(item.Id, item.AuthorDisplayName, item.Body, item.CreatedAt, item.AuthorUserId == userId)).ToArrayAsync(ct);
        return TypedResults.Ok(messages);
    }

    private static async Task<IResult> CreateMessage(long projectId, long conversationId, CreateProjectPartConversationMessageRequest? request, ClaimsPrincipal principal, BlueprintDbContext db, IProjectNotificationService notifications, CancellationToken ct)
    {
        var access = await ProjectDocumentAccessService.FindAccessAsync(projectId, principal, db, ct);
        if (access is null) return TypedResults.NotFound();
        var conversation = await db.ProjectPartConversations.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == conversationId && item.ProjectId == projectId, ct);
        if (conversation is null) return TypedResults.NotFound();
        var userId = access.UserId;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var document = await ProjectDocumentAccessService.LockAsync(db, conversation.DocumentId, ct);
        if (document is null || document.ProjectId != projectId || !ProjectDocumentAccessService.CanRead(document, access))
            return TypedResults.NotFound();
        if (access.IsArchived) return TypedResults.Conflict(new AdministrationErrorResponse("Archived projects are read-only."));
        var body = request?.Body?.Trim();
        if (string.IsNullOrWhiteSpace(body) || body.Length > 4000)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["body"] = ["Message text is required and cannot exceed 4000 characters."] });
        var displayName = await CurrentDisplayName(userId, db, ct);
        if (displayName is null) return TypedResults.NotFound();
        var message = new ProjectPartConversationMessage { ConversationId = conversationId, AuthorUserId = userId, AuthorDisplayName = displayName, Body = body, CreatedAt = DateTimeOffset.UtcNow };
        db.ProjectPartConversationMessages.Add(message);
        await db.SaveChangesAsync(ct);
        await notifications.AddAsync(new ProjectNotificationCommand(
            projectId, userId, ProjectEventTypes.PartMessageCreated,
            $"adicionou uma mensagem à conversa «{conversation.Title}».", NotificationTargetKinds.PartConversation,
            $"part-message:{message.Id}", conversation.DocumentId, conversationId, message.Id,
            new { conversation.Title }, Audience: AudienceFor(document)), ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Created($"/api/projects/{projectId}/part-conversations/{conversationId}/messages/{message.Id}", ToMessageResponse(message, userId));
    }

    private static ProjectPartConversationResponse ToResponse(ProjectPartConversation item, int count) =>
        new(item.Id, item.DocumentId, item.TargetKey, item.TargetKind, item.TargetLabel, item.Title, item.AnchorX, item.AnchorY, item.CreatedAt, count);
    private static ProjectPartConversationMessageResponse ToMessageResponse(ProjectPartConversationMessage item, long userId) =>
        new(item.Id, item.AuthorDisplayName, item.Body, item.CreatedAt, item.AuthorUserId == userId);
    private static IQueryable<ProjectPartConversation> ReadableConversations(long projectId, ProjectFileAccess access, BlueprintDbContext db) =>
        db.ProjectPartConversations.AsNoTracking().Where(item => item.ProjectId == projectId &&
            item.Document!.ProjectId == projectId && !item.Document.IsDeleted &&
            (access.IsProfessional || item.Document.IsVisible && item.Document.StoredObject!.Status == StoredObjectStatus.Available));

    private static ProjectNotificationAudience AudienceFor(ProjectDocument document) =>
        document.IsVisible ? ProjectNotificationAudience.AllParticipants : ProjectNotificationAudience.EmployeesOnly;

    private static async Task<string?> CurrentDisplayName(long userId, BlueprintDbContext db, CancellationToken ct)
    {
        var employee = await db.Employees.AsNoTracking().Where(item => item.UserId == userId && item.User!.IsActive).Select(item => item.DisplayName).SingleOrDefaultAsync(ct);
        return employee ?? await db.Clients.AsNoTracking().Where(item => item.UserId == userId && item.User!.IsActive).Select(item => item.DisplayName).SingleOrDefaultAsync(ct);
    }
}
