using System.Net;
using System.Net.Http.Json;
using Blueprint.Api.Data;
using Blueprint.Api.Services;
using Blueprint.Api.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed partial class ProjectIntegrationTests
{
    [Theory]
    [InlineData("same")]
    [InlineData("opposite")]
    [InlineData("delete")]
    [InlineData("replace")]
    [InlineData("conversation")]
    [InlineData("message")]
    [InlineData("client-message")]
    [InlineData("client-conversation")]
    public async Task DocumentRowLockSerializesVisibilityAndCompetingMutations(string operation)
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        var conversation = await CreateVisibilityConversationAsync(s, document);
        var replacement = operation == "replace" ? await PrepareVisibilityReplacementAsync(s, document) : Guid.Empty;
        var firstValue = operation is "same" or "opposite";
        if (!firstValue) await SetVisibilityAsync(s, document, true);
        await using var db = VisibilityDb();
        await db.Database.OpenConnectionAsync();
        var firstPid = ((NpgsqlConnection)db.Database.GetDbConnection()).ProcessID;
        var gate = new GatedNotifications(new ProjectNotificationService(db, TimeProvider.System));
        var files = VisibilityFiles(db, gate);
        var first = files.SetVisibilityAsync(document, firstValue, s.OwnerId);
        await gate.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        if (operation.StartsWith("client-")) await LoginAsync(s.Clients[0]);
        Task<HttpResponseMessage>? second = null;
        try
        {
            second = operation switch
            {
                "same" => fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true }),
                "opposite" => fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = false }),
                "delete" => fixture.Client.DeleteAsync($"/api/projects/{s.ProjectId}/documents/{document}"),
                "replace" => fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/documents/{document}/replacements/{replacement}/complete", null),
                "conversation" or "client-conversation" => fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/part-conversations", new { documentId = document, targetKey = "race", targetKind = "area", targetLabel = "Area", title = "Race", anchorX = 1, anchorY = 2 }),
                _ => fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/part-conversations/{conversation}/messages", new { body = "Race message" })
            };
            // Observe PostgreSQL's lock dependency, not elapsed time, before releasing the first transaction.
            await WaitForBlockedTransactionAsync(firstPid);
            Assert.False(second.IsCompleted);
        }
        finally
        {
            gate.Release.TrySetResult();
            await first.WaitAsync(TimeSpan.FromSeconds(10));
        }
        using var result = await second!.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(operation switch { "client-message" or "client-conversation" => HttpStatusCode.NotFound, "delete" => HttpStatusCode.NoContent, "conversation" or "message" => HttpStatusCode.Created, _ => HttpStatusCode.OK }, result.StatusCode);
        await using var verify = VisibilityDb();
        var final = await verify.ProjectDocuments.SingleAsync(x => x.Id == document);
        Assert.Equal(operation == "same", final.IsVisible);
        Assert.Equal(operation == "delete", final.IsDeleted);
        if (operation == "replace") Assert.Equal(replacement, final.StoredObjectId);
        var transitions = await verify.ProjectEvents.Where(x => x.DocumentId == document && (x.Type == "document.added" || x.Type == "document.removed")).OrderBy(x => x.Id).ToArrayAsync();
        Assert.Equal(operation == "same" ? new[] { "document.added" } : new[] { "document.added", "document.removed" }, transitions.Select(x => x.Type));
        if (operation.StartsWith("client-"))
        {
            Assert.Equal(1, await verify.ProjectPartConversations.CountAsync(x => x.DocumentId == document));
            Assert.Equal(0, await verify.ProjectPartConversationMessages.CountAsync(x => x.ConversationId == conversation));
        }
        else if (!firstValue)
        {
            var type = operation switch { "delete" => "document.deleted", "replace" => "document.replaced", "conversation" => "project.part_conversation_created", _ => "project.part_message_created" };
            var activity = await verify.ProjectEvents.Include(x => x.Notifications).Where(x => x.DocumentId == document && x.Type == type).OrderByDescending(x => x.Id).FirstAsync();
            var employee = await verify.Employees.Where(x => x.Id == s.ArchitectId).Select(x => x.UserId).SingleAsync();
            Assert.Equal(new[] { employee }, activity.Notifications.Select(x => x.RecipientUserId));
        }
    }

    [Fact]
    public async Task VisibilityReloadsStaleTrackedStateAndDoesNotTouchObjectStoreOrQuota()
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        await using var stale = VisibilityDb();
        var tracked = await stale.ProjectDocuments.Include(x => x.StoredObject).SingleAsync(x => x.Id == document);
        Assert.False(tracked.IsVisible);
        await SetVisibilityAsync(s, document, true);
        // A stale false entity must not turn the hide into a no-op.
        var files = VisibilityFiles(stale, new ProjectNotificationService(stale, TimeProvider.System));
        await files.SetVisibilityAsync(document, false, s.OwnerId);
        await using var verify = VisibilityDb();
        Assert.False((await verify.ProjectDocuments.SingleAsync(x => x.Id == document)).IsVisible);
        Assert.Equal(2, await verify.ProjectEvents.CountAsync(x => x.DocumentId == document && (x.Type == "document.added" || x.Type == "document.removed")));
    }

    [Fact]
    public async Task NotificationInsertFailureRollsBackVisibilityAuditEventAndRecipients()
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        await using var db = VisibilityDb();
        var before = await db.ProjectDocuments.AsNoTracking().SingleAsync(x => x.Id == document);
        var events = await db.ProjectEvents.CountAsync(x => x.DocumentId == document);
        var recipients = await db.UserNotifications.CountAsync(x => x.ProjectEvent!.DocumentId == document);
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        // The trigger fails the actual recipient INSERT after EF starts persisting this transaction.
        await using (var setup = connection.CreateCommand())
        {
            setup.CommandText = """
                CREATE FUNCTION visibility_test_reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'injected notification persistence failure'; END; $$;
                CREATE TRIGGER visibility_test_reject_notification BEFORE INSERT ON user_notifications
                FOR EACH ROW EXECUTE FUNCTION visibility_test_reject_notification();
                """;
            await setup.ExecuteNonQueryAsync();
        }
        try
        {
            var files = VisibilityFiles(db, new ProjectNotificationService(db, TimeProvider.System));
            var error = await Assert.ThrowsAsync<DbUpdateException>(() => files.SetVisibilityAsync(document, true, s.OwnerId));
            Assert.Contains("injected notification persistence failure", error.InnerException!.Message);
        }
        finally
        {
            await using var cleanup = new NpgsqlCommand("DROP TRIGGER visibility_test_reject_notification ON user_notifications; DROP FUNCTION visibility_test_reject_notification();", connection);
            await cleanup.ExecuteNonQueryAsync();
        }
        await using var verify = VisibilityDb();
        var after = await verify.ProjectDocuments.AsNoTracking().SingleAsync(x => x.Id == document);
        Assert.False(after.IsVisible);
        Assert.Equal(before.UpdatedAt, after.UpdatedAt);
        Assert.Equal(before.UpdatedBy, after.UpdatedBy);
        Assert.Equal(events, await verify.ProjectEvents.CountAsync(x => x.DocumentId == document));
        Assert.Equal(recipients, await verify.UserNotifications.CountAsync(x => x.ProjectEvent!.DocumentId == document));
        await SetVisibilityAsync(s, document, true);
    }

    private static FileService VisibilityFiles(BlueprintDbContext db, IProjectNotificationService notifications) =>
        // Null external dependencies deliberately make any unexpected storage/quota operation fail.
        new(db, null!, Options.Create(new ObjectStorageOptions
        {
            Endpoint = "http://unused.test", Region = "test", Bucket = "test", AccessKey = "unused", SecretKey = "unused"
        }), TimeProvider.System, notifications, null!);

    private async Task WaitForBlockedTransactionAsync(int blockerPid)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync(timeout.Token);
        await using var query = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE @pid = ANY(pg_blocking_pids(pid)))", connection);
        query.Parameters.AddWithValue("pid", blockerPid);
        while (!(bool)(await query.ExecuteScalarAsync(timeout.Token))!)
            await Task.Delay(10, timeout.Token);
    }

    private sealed class GatedNotifications(IProjectNotificationService inner) : IProjectNotificationService
    {
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async Task<bool> AddAsync(ProjectNotificationCommand command, CancellationToken cancellationToken = default)
        {
            var result = await inner.AddAsync(command, cancellationToken);
            Entered.TrySetResult();
            await Release.Task.WaitAsync(TimeSpan.FromSeconds(20), cancellationToken);
            return result;
        }
        public Task<long[]> ParticipantUserIdsAsync(long projectId, CancellationToken cancellationToken = default) => inner.ParticipantUserIdsAsync(projectId, cancellationToken);
    }
}
