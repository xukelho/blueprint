using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class NotificationEndpoints
{
    private const int DefaultPageSize = 30;
    private const int MaximumPageSize = 100;

    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var notifications = endpoints.MapGroup("/api/notifications").WithTags("Notifications").RequireAuthorization();
        notifications.MapGet("/", List);
        notifications.MapGet("/summary", Summary);
        notifications.MapPut("/{id:long}/read", MarkRead);
        notifications.MapPut("/read-all", MarkAllRead);
        return endpoints;
    }

    private static async Task<IResult> List(long? beforeId, int? limit, bool? unreadOnly, ClaimsPrincipal principal, BlueprintDbContext db, CancellationToken ct)
    {
        if (!TryUserId(principal, out var userId)) return TypedResults.Unauthorized();
        var pageSize = Math.Clamp(limit ?? DefaultPageSize, 1, MaximumPageSize);
        var query = db.UserNotifications.AsNoTracking().Where(item => item.RecipientUserId == userId);
        if (beforeId is long cursor) query = query.Where(item => item.Id < cursor);
        if (unreadOnly == true) query = query.Where(item => item.ReadAt == null);
        var rows = await query.OrderByDescending(item => item.Id).Take(pageSize + 1)
            .Select(item => new NotificationResponse(
                item.Id, item.ProjectEvent!.Type, item.ProjectEvent.ProjectId, item.ProjectEvent.ProjectTitle,
                item.ProjectEvent.ActorDisplayName, item.ProjectEvent.Summary, item.CreatedAt, item.ReadAt,
                new NotificationTargetResponse(item.ProjectEvent.TargetKind, item.ProjectEvent.ProjectId,
                    item.ProjectEvent.DocumentId, item.ProjectEvent.ConversationId, item.ProjectEvent.MessageId)))
            .ToArrayAsync(ct);
        return TypedResults.Ok(new NotificationPageResponse(rows.Take(pageSize).ToArray(), rows.Length > pageSize));
    }

    private static async Task<IResult> Summary(ClaimsPrincipal principal, BlueprintDbContext db, TimeProvider timeProvider, CancellationToken ct)
    {
        if (!TryUserId(principal, out var userId)) return TypedResults.Unauthorized();
        var unread = await db.UserNotifications.CountAsync(item => item.RecipientUserId == userId && item.ReadAt == null, ct);
        var email = await db.Clients.AsNoTracking().Where(item => item.UserId == userId && item.User!.IsActive)
            .Select(item => item.Email).SingleOrDefaultAsync(ct);
        var invitations = email is null ? 0 : await db.ClientInvitations.CountAsync(item => item.Email == email && item.Company!.IsActive &&
            item.SentAt > timeProvider.GetUtcNow() - ClientInvitationExpiry.Lifetime, ct);
        return TypedResults.Ok(new NotificationSummaryResponse(unread, invitations, unread + invitations));
    }

    private static async Task<IResult> MarkRead(long id, ClaimsPrincipal principal, BlueprintDbContext db, TimeProvider timeProvider, CancellationToken ct)
    {
        if (!TryUserId(principal, out var userId)) return TypedResults.Unauthorized();
        var notification = await db.UserNotifications.SingleOrDefaultAsync(item => item.Id == id && item.RecipientUserId == userId, ct);
        if (notification is null) return TypedResults.NotFound();
        if (notification.ReadAt is null) { notification.ReadAt = timeProvider.GetUtcNow(); await db.SaveChangesAsync(ct); }
        return TypedResults.NoContent();
    }

    private static async Task<IResult> MarkAllRead(ClaimsPrincipal principal, BlueprintDbContext db, TimeProvider timeProvider, CancellationToken ct)
    {
        if (!TryUserId(principal, out var userId)) return TypedResults.Unauthorized();
        await db.UserNotifications.Where(item => item.RecipientUserId == userId && item.ReadAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.ReadAt, timeProvider.GetUtcNow()), ct);
        return TypedResults.NoContent();
    }

    private static bool TryUserId(ClaimsPrincipal principal, out long userId) =>
        long.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}
