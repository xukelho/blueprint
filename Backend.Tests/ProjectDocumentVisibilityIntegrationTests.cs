using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.IntegrationTests;

public sealed partial class ProjectIntegrationTests
{
    [Fact]
    public async Task DrawingPreviewRemainsAvailableToEmployeesAndFollowsSharedClientVisibility()
    {
        var s = await VisibilityScenarioAsync();
        var bytes = Encoding.UTF8.GetBytes("0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWalls\n10\n0\n20\n0\n11\n120\n21\n80\n0\nENDSEC\n0\nEOF\n");
        using var upload = await fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/phases/{s.PhaseId}/documents/uploads", new { fileName = "plan.dxf", contentType = "application/dxf", length = bytes.Length });
        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        var pending = await upload.Content.ReadFromJsonAsync<JsonElement>();
        var document = pending.GetProperty("documentId").GetGuid();
        await UploadAsync(pending.GetProperty("upload"), bytes);
        using var completed = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/documents/{document}/complete", null);
        Assert.Equal(HttpStatusCode.OK, completed.StatusCode);
        var route = $"/api/projects/{s.ProjectId}/documents/{document}/drawing";
        foreach (var employee in new[] { s.Owner, s.Architect })
        {
            await LoginAsync(employee);
            using var preview = await fixture.Client.GetAsync(route);
            Assert.Equal(HttpStatusCode.OK, preview.StatusCode);
        }
        foreach (var visible in new[] { false, true, false })
        {
            await LoginAsync(s.Owner);
            await SetVisibilityAsync(s, document, visible);
            foreach (var client in s.Clients)
            {
                await LoginAsync(client);
                using var preview = await fixture.Client.GetAsync(route);
                Assert.Equal(visible ? HttpStatusCode.OK : HttpStatusCode.NotFound, preview.StatusCode);
            }
        }
    }

    [Fact]
    public async Task DualRoleAccessIsProfessionalOnlyInTheAssignedProjectAndCrossProjectIdsStayIsolated()
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        var conversation = await CreateVisibilityConversationAsync(s, document);
        await AddVisibilityMessageAsync(s, conversation, "Private history");
        await using var db = VisibilityDb();
        var employee = await db.Employees.SingleAsync(x => x.Id == s.ArchitectId);
        var dualClient = new Client { UserId = employee.UserId, DisplayName = "Dual", FullName = "Dual", Nif = Guid.NewGuid().ToString("N")[..9], Email = "dual@example.test", PhoneNumber = "1", Address = "Lisboa" };
        db.Clients.Add(dualClient);
        await db.SaveChangesAsync();
        db.CompanyClients.Add(new CompanyClient { CompanyId = s.CompanyId, ClientId = dualClient.Id });
        db.ProjectClients.Add(new ProjectClient { ProjectId = s.ProjectId, ClientId = dualClient.Id });
        db.UserRoles.Add(new UserRole { UserId = employee.UserId, RoleId = RoleIds.Client });
        await db.SaveChangesAsync();
        var secondProject = await CreateProjectAsync(s.Owner, dualClient.Id, $"DUAL-{Guid.NewGuid():N}"[..14]);
        await LoginAsync(s.Architect);
        Assert.Single((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/documents"))!);
        Assert.Single((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/part-conversations/{conversation}/messages"))!);
        await AddVisibilityMessageAsync(s, conversation, "Dual employee message");
        await SetVisibilityAsync(s, document, true);
        await SetVisibilityAsync(s, document, false);
        foreach (var route in new[] { $"documents/{document}/content", $"documents/{document}/drawing", $"part-conversations/{conversation}/messages" })
        {
            using var response = await fixture.Client.GetAsync($"/api/projects/{secondProject}/{route}");
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
        using (var response = await fixture.Client.PostAsync($"/api/projects/{secondProject}/documents/{document}/download", null))
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using (var response = await fixture.Client.PutAsJsonAsync($"/api/projects/{secondProject}/documents/{document}/visibility", new { isVisible = true }))
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using (var response = await fixture.Client.PostAsJsonAsync($"/api/projects/{secondProject}/part-conversations/{conversation}/messages", new { body = "Denied" }))
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using (var response = await fixture.Client.PostAsJsonAsync($"/api/projects/{secondProject}/part-conversations", new { documentId = document, targetKey = "cross", targetKind = "area", targetLabel = "Area", title = "Denied", anchorX = 1, anchorY = 2 }))
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        // Keep the global architect/client roles, but remove this project's professional assignment.
        await db.ProjectMembers.Where(x => x.ProjectId == s.ProjectId && x.EmployeeId == s.ArchitectId).ExecuteDeleteAsync();
        await AssertHiddenAsync(s, document, conversation);
        using var denied = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true });
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
    }

    [Theory]
    [InlineData(StoredObjectStatus.PendingUpload, false)]
    [InlineData(StoredObjectStatus.DeletionPending, false)]
    [InlineData(StoredObjectStatus.Deleted, false)]
    [InlineData(StoredObjectStatus.Available, true)]
    public async Task VisibilityNeverBypassesDocumentOrObjectLifecycle(StoredObjectStatus status, bool deleted)
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        var conversation = await CreateVisibilityConversationAsync(s, document);
        await using var db = VisibilityDb();
        await db.ProjectDocuments.Where(x => x.Id == document).ExecuteUpdateAsync(x => x.SetProperty(d => d.IsVisible, true).SetProperty(d => d.IsDeleted, deleted));
        await db.StoredObjects.Where(x => x.Documents.Any(d => d.Id == document)).ExecuteUpdateAsync(x => x.SetProperty(o => o.Status, status));
        await LoginAsync(s.Clients[0]);
        await AssertHiddenAsync(s, document, conversation);
        await LoginAsync(s.Owner);
        using var mutation = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = false });
        Assert.Equal(deleted ? HttpStatusCode.NotFound : HttpStatusCode.Conflict, mutation.StatusCode);
    }

    [Fact]
    public async Task VisibilityProtectsEveryClientRouteAndRestoresFullDiscussionHistory()
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        var conversation = await CreateVisibilityConversationAsync(s, document);
        await AddVisibilityMessageAsync(s, conversation, "Before publication");
        foreach (var username in s.Clients)
        {
            await LoginAsync(username);
            await AssertHiddenAsync(s, document, conversation);
            using var denied = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true });
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        }

        // The assigned architect is not the uploader and still has full professional access.
        await LoginAsync(s.Architect);
        Assert.Single((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/documents"))!);
        Assert.Single((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/part-conversations/{conversation}/messages"))!);
        using (var content = await fixture.Client.GetAsync($"/api/projects/{s.ProjectId}/documents/{document}/content"))
            Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        await SetVisibilityAsync(s, document, true);
        string? oldGrant = null;
        foreach (var username in s.Clients)
        {
            await LoginAsync(username);
            var documents = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/documents");
            Assert.True(Assert.Single(documents!).GetProperty("isVisible").GetBoolean());
            var discussions = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/part-conversations");
            Assert.Equal(1, Assert.Single(discussions!).GetProperty("messageCount").GetInt32());
            using var grant = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/documents/{document}/download", null);
            Assert.Equal(HttpStatusCode.OK, grant.StatusCode);
            oldGrant = (await grant.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("url").GetString();
            using var content = await fixture.Client.GetAsync($"/api/projects/{s.ProjectId}/documents/{document}/content");
            Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        }
        await AddVisibilityMessageAsync(s, conversation, "Client message");
        await LoginAsync(s.Owner);
        await using var beforeDb = VisibilityDb();
        var before = await beforeDb.StoredObjects.AsNoTracking().SingleAsync(x => x.Documents.Any(d => d.Id == document));
        await SetVisibilityAsync(s, document, false);
        await AddVisibilityMessageAsync(s, conversation, "Hidden employee message");
        foreach (var username in s.Clients)
        {
            await LoginAsync(username);
            await AssertHiddenAsync(s, document, conversation);
        }
        using (var storage = new HttpClient())
            Assert.Equal("visibility bytes", await storage.GetStringAsync(oldGrant));
        await using var afterDb = VisibilityDb();
        var after = await afterDb.StoredObjects.AsNoTracking().SingleAsync(x => x.Id == before.Id);
        Assert.Equal(before.ObjectKey, after.ObjectKey);
        Assert.Equal(before.QuotaChargeBytes, after.QuotaChargeBytes);
        Assert.Equal(before.Status, after.Status);
        Assert.Equal(before.UpdatedAt, after.UpdatedAt);
        await LoginAsync(s.Owner);
        await SetVisibilityAsync(s, document, true);
        foreach (var username in s.Clients)
        {
            await LoginAsync(username);
            var messages = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/part-conversations/{conversation}/messages");
            Assert.Equal(new[] { "Before publication", "Client message", "Hidden employee message" }, messages!.Select(x => x.GetProperty("body").GetString()));
            var discussions = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/part-conversations?documentId={document}");
            Assert.Equal(3, Assert.Single(discussions!).GetProperty("messageCount").GetInt32());
        }
    }

    [Fact]
    public async Task VisibilityValidatesBodiesLifecycleTenancyAndInactivePrincipals()
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        foreach (var json in new[] { "{}", "null", "{\"isVisible\":null}", "{\"isVisible\":\"true\"}", "{" })
        {
            using var response = await fixture.Client.PutAsync(VisibilityUrl(s, document), new StringContent(json, Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        using (var missing = await fixture.Client.PutAsync(VisibilityUrl(s, document), null))
            Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        using (var anonymous = new HttpClient { BaseAddress = fixture.Client.BaseAddress })
        using (var response = await anonymous.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true }))
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var otherOwner = await CreateOwnerAsync();
        foreach (var username in new[] { s.UnassignedEmployee, s.UnassignedClient, otherOwner.Username })
        {
            await LoginAsync(username);
            using var denied = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true });
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
            using var content = await fixture.Client.GetAsync($"/api/projects/{s.ProjectId}/documents/{document}/content");
            Assert.Equal(HttpStatusCode.NotFound, content.StatusCode);
        }
        await LoginAsync(s.Owner);
        var pending = await UploadVisibilityDocumentAsync(s, complete: false);
        using (var unavailable = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, pending), new { isVisible = true }))
            Assert.Equal(HttpStatusCode.Conflict, unavailable.StatusCode);
        using (var wrongProject = await fixture.Client.PutAsJsonAsync($"/api/projects/{s.ProjectId + 99999}/documents/{document}/visibility", new { isVisible = true }))
            Assert.Equal(HttpStatusCode.NotFound, wrongProject.StatusCode);
        using (var missing = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, Guid.NewGuid()), new { isVisible = true }))
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        using (var archived = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/archive", null))
            Assert.Equal(HttpStatusCode.NoContent, archived.StatusCode);
        using (var denied = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true }))
        {
            Assert.Equal(HttpStatusCode.Conflict, denied.StatusCode);
            Assert.Equal("Archived projects are read-only.", (await denied.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString());
        }
        using (var reactivated = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/reactivate", null))
            Assert.Equal(HttpStatusCode.NoContent, reactivated.StatusCode);
        await SetCompanyActiveAsync(s.CompanyId, false);
        using (var inactive = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true }))
            Assert.Equal(HttpStatusCode.NotFound, inactive.StatusCode);
        await SetCompanyActiveAsync(s.CompanyId, true);
        await using (var db = VisibilityDb())
            await db.Users.Where(x => x.Id == s.OwnerId).ExecuteUpdateAsync(x => x.SetProperty(u => u.IsActive, false));
        using (var inactive = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true }))
            Assert.Contains(inactive.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.NotFound });
        await using (var db = VisibilityDb())
            await db.Users.Where(x => x.Id == s.OwnerId).ExecuteUpdateAsync(x => x.SetProperty(u => u.IsActive, true));
        await LoginAsync(s.Owner);
        using (var deleted = await fixture.Client.DeleteAsync($"/api/projects/{s.ProjectId}/documents/{document}"))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using (var denied = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = true }))
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DocumentActivityUsesVisibilityAudienceAndMoveReplacementPreserveFlag(bool visible)
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        if (visible) await SetVisibilityAsync(s, document, true);
        var conversation = await CreateVisibilityConversationAsync(s, document);
        await AddVisibilityMessageAsync(s, conversation, "Activity");
        using (var moved = await fixture.Client.PutAsJsonAsync($"/api/projects/{s.ProjectId}/documents/{document}/phase", new { targetPhaseId = s.SecondPhase }))
        {
            Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
            Assert.Equal(visible, (await moved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("isVisible").GetBoolean());
        }
        var replacement = await PrepareVisibilityReplacementAsync(s, document);
        using (var replaced = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/documents/{document}/replacements/{replacement}/complete", null))
        {
            Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
            Assert.Equal(visible, (await replaced.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("document").GetProperty("isVisible").GetBoolean());
        }
        using (var repeated = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/documents/{document}/replacements/{replacement}/complete", null))
            Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
        using (var deleted = await fixture.Client.DeleteAsync($"/api/projects/{s.ProjectId}/documents/{document}"))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using (var repeated = await fixture.Client.DeleteAsync($"/api/projects/{s.ProjectId}/documents/{document}"))
            Assert.Equal(HttpStatusCode.NoContent, repeated.StatusCode);
        await using var db = VisibilityDb();
        var events = await db.ProjectEvents.Include(x => x.Notifications).Where(x => x.DocumentId == document).ToArrayAsync();
        var summaries = new Dictionary<string, string>
        {
            ["document.uploaded"] = "adicionou o ficheiro «visibility.txt».",
            ["document.moved"] = "moveu um ficheiro para outra fase.",
            ["document.replaced"] = "substituiu o ficheiro por «replacement.txt».",
            ["document.deleted"] = "eliminou o ficheiro «replacement.txt».",
            ["project.part_conversation_created"] = "iniciou a conversa «History».",
            ["project.part_message_created"] = "adicionou uma mensagem à conversa «History»."
        };
        var employeeId = await db.Employees.Where(x => x.Id == s.ArchitectId).Select(x => x.UserId).SingleAsync();
        var clientIds = await db.Clients.Where(x => s.ClientIds.Contains(x.Id)).Select(x => x.UserId).Order().ToArrayAsync();
        foreach (var type in new[] { "document.uploaded", "document.moved", "document.replaced", "document.deleted", "project.part_conversation_created", "project.part_message_created" })
        {
            var activity = Assert.Single(events, x => x.Type == type);
            Assert.Equal(summaries[type], activity.Summary);
            var expected = visible && type != "document.uploaded" ? clientIds.Append(employeeId).Order().ToArray() : [employeeId];
            Assert.Equal(expected, activity.Notifications.Select(x => x.RecipientUserId).Order().ToArray());
        }
    }

    [Fact]
    public async Task RepeatedTransitionsHaveUniqueEventsNoOpAuditAndHistoricalNotifications()
    {
        var s = await VisibilityScenarioAsync();
        var document = await UploadVisibilityDocumentAsync(s);
        await using var db = VisibilityDb();
        var original = await db.ProjectDocuments.AsNoTracking().SingleAsync(x => x.Id == document);
        await SetVisibilityAsync(s, document, false);
        var unchanged = await db.ProjectDocuments.AsNoTracking().SingleAsync(x => x.Id == document);
        Assert.Equal(original.UpdatedAt, unchanged.UpdatedAt);
        Assert.Equal(original.UpdatedBy, unchanged.UpdatedBy);
        await SetVisibilityAsync(s, document, true);
        var published = await db.ProjectDocuments.AsNoTracking().SingleAsync(x => x.Id == document);
        await LoginAsync(s.Architect);
        await SetVisibilityAsync(s, document, true);
        unchanged = await db.ProjectDocuments.AsNoTracking().SingleAsync(x => x.Id == document);
        Assert.Equal(published.UpdatedAt, unchanged.UpdatedAt);
        Assert.Equal(published.UpdatedBy, unchanged.UpdatedBy);
        await SetVisibilityAsync(s, document, false);
        await SetVisibilityAsync(s, document, true);
        var transitions = await db.ProjectEvents.Include(x => x.Notifications).Where(x => x.DocumentId == document && (x.Type == "document.added" || x.Type == "document.removed")).OrderBy(x => x.Id).ToArrayAsync();
        var clientUserIds = await db.Clients.Where(x => s.ClientIds.Contains(x.Id)).Select(x => x.UserId).Order().ToArrayAsync();
        Assert.Equal(new[] { "document.added", "document.removed", "document.added" }, transitions.Select(x => x.Type));
        Assert.Equal(3, transitions.Select(x => x.DeduplicationKey).Distinct().Count());
        foreach (var transition in transitions)
        {
            Assert.Equal("document", transition.TargetKind);
            Assert.Equal(clientUserIds, transition.Notifications.Select(x => x.RecipientUserId).Order().ToArray());
            Assert.Equal(transition.Type == "document.added" ? "adicionou o ficheiro «visibility.txt»." : "removeu o ficheiro «visibility.txt».", transition.Summary);
        }
        // Existing deliveries survive hide and new publications never replay suppressed history.
        Assert.Equal(6, transitions.Sum(x => x.Notifications.Count));
        await db.ProjectClients.Where(x => x.ProjectId == s.ProjectId).ExecuteDeleteAsync();
        await SetVisibilityAsync(s, document, false);
        var empty = await db.ProjectEvents.Include(x => x.Notifications).Where(x => x.DocumentId == document).OrderByDescending(x => x.Id).FirstAsync();
        Assert.Equal("document.removed", empty.Type);
        Assert.Empty(empty.Notifications);
        Assert.Equal(6, await db.UserNotifications.CountAsync(x => x.ProjectEvent!.DocumentId == document && (x.ProjectEvent.Type == "document.added" || x.ProjectEvent.Type == "document.removed")));
    }

    private sealed record VisibilityScenario(long ProjectId, long PhaseId, long SecondPhase, string Owner, long OwnerId, long CompanyId,
        string Architect, long ArchitectId, string[] Clients, long[] ClientIds, string UnassignedEmployee, string UnassignedClient);

    private async Task<VisibilityScenario> VisibilityScenarioAsync()
    {
        var owner = await CreateOwnerAsync();
        await LoginAsync("admin", "admin");
        var suffix = Guid.NewGuid().ToString("N");
        var first = await CreateClientAsync($"v.first.{suffix}", [owner.CompanyId]);
        var second = await CreateClientAsync($"v.second.{suffix}", [owner.CompanyId]);
        var unassigned = await CreateClientAsync($"v.other.{suffix}", [owner.CompanyId]);
        var architect = await CreateEmployeeAsync(owner.CompanyId, $"v.architect.{suffix}", "Architect");
        var outsider = await CreateEmployeeAsync(owner.CompanyId, $"v.outsider.{suffix}", "Outsider");
        await using var db = VisibilityDb();
        var ownerEmployeeId = await db.Employees.Where(x => x.UserId == owner.UserId).Select(x => x.Id).SingleAsync();
        await LoginAsync(owner.Username);
        using var response = await fixture.Client.PostAsJsonAsync("/api/projects/", new
        {
            title = "Visibility", code = $"V-{suffix[..8]}", address = "Lisboa", clientIds = new[] { first.Id, second.Id },
            employeeIds = new[] { architect.Id, ownerEmployeeId }, phaseCodes = new[] { "feasibility-studies", "execution-project" }, currentPhaseIndex = 0
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var project = await response.Content.ReadFromJsonAsync<JsonElement>();
        return new(project.GetProperty("id").GetInt64(), project.GetProperty("phases")[0].GetProperty("id").GetInt64(), project.GetProperty("phases")[1].GetProperty("id").GetInt64(),
            owner.Username, owner.UserId, owner.CompanyId, architect.Username, architect.Id, [first.Username, second.Username], [first.Id, second.Id], outsider.Username, unassigned.Username);
    }

    private async Task<Guid> UploadVisibilityDocumentAsync(VisibilityScenario s, bool complete = true)
    {
        var bytes = "visibility bytes"u8.ToArray();
        using var response = await fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/phases/{s.PhaseId}/documents/uploads", new { fileName = "visibility.txt", contentType = "text/plain", length = bytes.Length });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var pending = await response.Content.ReadFromJsonAsync<JsonElement>();
        var id = pending.GetProperty("documentId").GetGuid();
        if (complete)
        {
            await UploadAsync(pending.GetProperty("upload"), bytes);
            using var completed = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/documents/{id}/complete", null);
            Assert.Equal(HttpStatusCode.OK, completed.StatusCode);
            Assert.False((await completed.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("document").GetProperty("isVisible").GetBoolean());
        }
        return id;
    }

    private async Task<Guid> PrepareVisibilityReplacementAsync(VisibilityScenario s, Guid document)
    {
        var bytes = "replacement visibility bytes"u8.ToArray();
        using var response = await fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/documents/{document}/replacements", new { fileName = "replacement.txt", contentType = "text/plain", length = bytes.Length });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var pending = await response.Content.ReadFromJsonAsync<JsonElement>();
        await UploadAsync(pending.GetProperty("upload"), bytes);
        return pending.GetProperty("storedObjectId").GetGuid();
    }

    private async Task<long> CreateVisibilityConversationAsync(VisibilityScenario s, Guid document)
    {
        using var response = await fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/part-conversations", new { documentId = document, targetKey = Guid.NewGuid().ToString(), targetKind = "area", targetLabel = "Area", title = "History", anchorX = 1, anchorY = 2 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64();
    }

    private async Task AddVisibilityMessageAsync(VisibilityScenario s, long conversation, string body)
    {
        using var response = await fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/part-conversations/{conversation}/messages", new { body });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task AssertHiddenAsync(VisibilityScenario s, Guid document, long conversation)
    {
        Assert.Empty((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/documents"))!);
        Assert.Empty((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/part-conversations"))!);
        Assert.Empty((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{s.ProjectId}/part-conversations?documentId={document}"))!);
        foreach (var route in new[] { $"documents/{document}/content", $"documents/{document}/drawing", $"part-conversations/{conversation}/messages" })
        {
            using var response = await fixture.Client.GetAsync($"/api/projects/{s.ProjectId}/{route}");
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
        using var download = await fixture.Client.PostAsync($"/api/projects/{s.ProjectId}/documents/{document}/download", null);
        Assert.Equal(HttpStatusCode.NotFound, download.StatusCode);
        using var create = await fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/part-conversations", new { documentId = document, targetKey = "area", targetKind = "area", targetLabel = "Area", title = "Blocked", anchorX = 1, anchorY = 2 });
        Assert.Equal(HttpStatusCode.NotFound, create.StatusCode);
        using var message = await fixture.Client.PostAsJsonAsync($"/api/projects/{s.ProjectId}/part-conversations/{conversation}/messages", new { body = "Blocked" });
        Assert.Equal(HttpStatusCode.NotFound, message.StatusCode);
    }

    private static string VisibilityUrl(VisibilityScenario s, Guid document) => $"/api/projects/{s.ProjectId}/documents/{document}/visibility";
    private async Task SetVisibilityAsync(VisibilityScenario s, Guid document, bool value)
    {
        using var response = await fixture.Client.PutAsJsonAsync(VisibilityUrl(s, document), new { isVisible = value });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(value, (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("isVisible").GetBoolean());
    }
    private BlueprintDbContext VisibilityDb() => new(new DbContextOptionsBuilder<BlueprintDbContext>().UseNpgsql(fixture.ConnectionString).Options);
}

