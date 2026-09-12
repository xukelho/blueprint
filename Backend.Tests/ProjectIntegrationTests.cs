using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class ProjectIntegrationTests(PostgreSqlApiFixture fixture)
    : IClassFixture<PostgreSqlApiFixture>
{
    [Fact]
    public async Task ProjectDocumentEndpointsEnforceLifecycleVisibilityAndArchivedReadOnlyAccess()
    {
        var owner = await CreateOwnerAsync();
        var suffix = Guid.NewGuid().ToString("N");
        await LoginAsync("admin", "admin");
        var client = await CreateClientAsync($"files.client.{suffix}", [owner.CompanyId]);
        await LoginAsync(owner.Username);

        using var projectResponse = await fixture.Client.PostAsJsonAsync("/api/projects/", new
        {
            title = "Project files",
            code = $"FILES-{suffix[..6]}",
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientIds = new[] { client.Id },
            employeeIds = Array.Empty<long>(),
            phaseCodes = new[] { "feasibility-studies", "execution-project" },
            currentPhaseIndex = 0
        });
        Assert.Equal(HttpStatusCode.Created, projectResponse.StatusCode);
        var project = await projectResponse.Content.ReadFromJsonAsync<JsonElement>();
        var projectId = project.GetProperty("id").GetInt64();
        var firstPhaseId = project.GetProperty("phases")[0].GetProperty("id").GetInt64();
        var secondPhaseId = project.GetProperty("phases")[1].GetProperty("id").GetInt64();
        var originalBytes = "original project document"u8.ToArray();

        using var pendingResponse = await fixture.Client.PostAsJsonAsync(
            $"/api/projects/{projectId}/phases/{firstPhaseId}/documents/uploads",
            new { fileName = "drawing.txt", contentType = "text/plain", length = originalBytes.Length });
        Assert.Equal(HttpStatusCode.Created, pendingResponse.StatusCode);
        var pending = await pendingResponse.Content.ReadFromJsonAsync<JsonElement>();
        var documentId = pending.GetProperty("documentId").GetGuid();
        await UploadAsync(pending.GetProperty("upload"), originalBytes);

        using var completed = await fixture.Client.PostAsync($"/api/projects/{projectId}/documents/{documentId}/complete", null);
        Assert.Equal(HttpStatusCode.OK, completed.StatusCode);
        using var completedAgain = await fixture.Client.PostAsync($"/api/projects/{projectId}/documents/{documentId}/complete", null);
        Assert.Equal(HttpStatusCode.OK, completedAgain.StatusCode);

        var ownerDocuments = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{projectId}/documents");
        Assert.Single(ownerDocuments!);
        Assert.Equal("drawing.txt", ownerDocuments![0].GetProperty("fileName").GetString());
        Assert.Equal("Available", ownerDocuments[0].GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(ownerDocuments[0].GetProperty("createdByDisplayName").GetString()));

        using var conversationResponse = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/part-conversations", new
        {
            documentId, targetKey = "area:0,1,2,3", targetKind = "area", targetLabel = "Área detetada 1",
            title = "Rever cozinha", anchorX = 12.5, anchorY = 8.25
        });
        Assert.Equal(HttpStatusCode.Created, conversationResponse.StatusCode);
        var conversation = await conversationResponse.Content.ReadFromJsonAsync<JsonElement>();
        var conversationId = conversation.GetProperty("id").GetInt64();
        using var conversationMessageResponse = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/part-conversations/{conversationId}/messages", new { body = "Confirmar esta área." });
        Assert.Equal(HttpStatusCode.Created, conversationMessageResponse.StatusCode);
        Assert.True((await conversationMessageResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("isOwn").GetBoolean());
        var drawingConversations = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{projectId}/part-conversations?documentId={documentId}");
        Assert.Single(drawingConversations!);
        Assert.Equal(1, drawingConversations![0].GetProperty("messageCount").GetInt32());

        using var moved = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/documents/{documentId}/phase", new { targetPhaseId = secondPhaseId });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal(secondPhaseId, (await moved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("phaseId").GetInt64());

        var replacementBytes = "replacement project document"u8.ToArray();
        using var replacementResponse = await fixture.Client.PostAsJsonAsync(
            $"/api/projects/{projectId}/documents/{documentId}/replacements",
            new { fileName = "drawing-v2.txt", contentType = "text/plain", length = replacementBytes.Length });
        Assert.Equal(HttpStatusCode.Created, replacementResponse.StatusCode);
        var replacement = await replacementResponse.Content.ReadFromJsonAsync<JsonElement>();
        var replacementId = replacement.GetProperty("storedObjectId").GetGuid();
        await UploadAsync(replacement.GetProperty("upload"), replacementBytes);
        using var replaced = await fixture.Client.PostAsync($"/api/projects/{projectId}/documents/{documentId}/replacements/{replacementId}/complete", null);
        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        using var replacedAgain = await fixture.Client.PostAsync($"/api/projects/{projectId}/documents/{documentId}/replacements/{replacementId}/complete", null);
        Assert.Equal(HttpStatusCode.OK, replacedAgain.StatusCode);

        await LoginAsync(client.Username);
        var notifications = await fixture.Client.GetFromJsonAsync<JsonElement>("/api/notifications");
        var notificationItems = notifications.GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal(6, notificationItems.Length);
        Assert.Equal(1, notificationItems.Count(item => item.GetProperty("type").GetString() == "document.uploaded"));
        Assert.Equal(1, notificationItems.Count(item => item.GetProperty("type").GetString() == "document.replaced"));
        Assert.Equal(1, notificationItems.Count(item => item.GetProperty("type").GetString() == "project.part_conversation_created"));
        Assert.Equal(1, notificationItems.Count(item => item.GetProperty("type").GetString() == "project.part_message_created"));
        Assert.DoesNotContain(notificationItems, item => item.GetRawText().Contains("Confirmar esta", StringComparison.Ordinal));
        var notificationId = notificationItems[0].GetProperty("id").GetInt64();
        using var markedRead = await fixture.Client.PutAsync($"/api/notifications/{notificationId}/read", null);
        Assert.Equal(HttpStatusCode.NoContent, markedRead.StatusCode);
        var notificationSummary = await fixture.Client.GetFromJsonAsync<JsonElement>("/api/notifications/summary");
        Assert.Equal(5, notificationSummary.GetProperty("unreadCount").GetInt32());
        var projectUnreadCounts = notificationSummary.GetProperty("projectUnreadCounts").EnumerateArray().ToArray();
        Assert.Single(projectUnreadCounts);
        Assert.Equal(projectId, projectUnreadCounts[0].GetProperty("projectId").GetInt64());
        Assert.Equal(5, projectUnreadCounts[0].GetProperty("unreadCount").GetInt32());
        var projectNotifications = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/notifications?unreadOnly=true&projectId={projectId}&limit=2");
        Assert.Equal(2, projectNotifications.GetProperty("items").GetArrayLength());
        Assert.True(projectNotifications.GetProperty("hasMore").GetBoolean());
        var otherProjectNotifications = await fixture.Client.GetFromJsonAsync<JsonElement>("/api/notifications?unreadOnly=true&projectId=999999");
        Assert.Equal(0, otherProjectNotifications.GetProperty("items").GetArrayLength());
        var clientDrawingMessages = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{projectId}/part-conversations/{conversationId}/messages");
        Assert.Single(clientDrawingMessages!);
        Assert.False(clientDrawingMessages![0].GetProperty("isOwn").GetBoolean());
        var clientDocuments = await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{projectId}/documents");
        Assert.Single(clientDocuments!);
        Assert.Equal("drawing-v2.txt", clientDocuments![0].GetProperty("fileName").GetString());
        using var clientContent = await fixture.Client.GetAsync($"/api/projects/{projectId}/documents/{documentId}/content");
        Assert.Equal(HttpStatusCode.OK, clientContent.StatusCode);
        Assert.Equal("text/plain", clientContent.Content.Headers.ContentType?.MediaType);
        Assert.Equal(replacementBytes, await clientContent.Content.ReadAsByteArrayAsync());
        using var clientDownload = await fixture.Client.PostAsync($"/api/projects/{projectId}/documents/{documentId}/download", null);
        Assert.Equal(HttpStatusCode.OK, clientDownload.StatusCode);
        var downloadGrant = await clientDownload.Content.ReadFromJsonAsync<JsonElement>();
        using var storage = new HttpClient();
        Assert.Equal(replacementBytes, await storage.GetByteArrayAsync(downloadGrant.GetProperty("url").GetString()));
        using var clientMutation = await fixture.Client.DeleteAsync($"/api/projects/{projectId}/documents/{documentId}");
        Assert.Equal(HttpStatusCode.NotFound, clientMutation.StatusCode);

        await LoginAsync(owner.Username);
        var ownerNotificationSummary = await fixture.Client.GetFromJsonAsync<JsonElement>("/api/notifications/summary");
        Assert.Equal(0, ownerNotificationSummary.GetProperty("unreadCount").GetInt32());
        using var archived = await fixture.Client.PostAsync($"/api/projects/{projectId}/archive", null);
        Assert.Equal(HttpStatusCode.NoContent, archived.StatusCode);
        Assert.Single((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{projectId}/documents"))!);
        using var archivedMutation = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/documents/{documentId}/phase", new { targetPhaseId = firstPhaseId });
        Assert.Equal(HttpStatusCode.Conflict, archivedMutation.StatusCode);

        using var reactivated = await fixture.Client.PostAsync($"/api/projects/{projectId}/reactivate", null);
        Assert.Equal(HttpStatusCode.NoContent, reactivated.StatusCode);
        using var removedEmptyPhase = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/phases/{firstPhaseId}/remove", new { mode = "emptyOnly", targetPhaseId = (long?)null });
        Assert.Equal(HttpStatusCode.NoContent, removedEmptyPhase.StatusCode);
        using var deleted = await fixture.Client.DeleteAsync($"/api/projects/{projectId}/documents/{documentId}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var deletedAgain = await fixture.Client.DeleteAsync($"/api/projects/{projectId}/documents/{documentId}");
        Assert.Equal(HttpStatusCode.NoContent, deletedAgain.StatusCode);
        Assert.Empty((await fixture.Client.GetFromJsonAsync<JsonElement[]>($"/api/projects/{projectId}/documents"))!);
    }

    [Fact]
    public async Task OwnerCanAssignRemoveAndConcurrentlyAssociateMultipleClients()
    {
        var owner = await CreateOwnerAsync();
        var suffix = Guid.NewGuid().ToString("N");
        await LoginAsync("admin", "admin");
        var firstClient = await CreateClientAsync($"assignment.first.{suffix}", [owner.CompanyId]);
        var secondClient = await CreateClientAsync($"assignment.second.{suffix}", [owner.CompanyId]);
        var code = $"ASSIGN-{suffix[..6]}";
        await LoginAsync(owner.Username);
        using var createResponse = await fixture.Client.PostAsJsonAsync("/api/projects/", new
        {
            title = code,
            code,
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientIds = new[] { firstClient.Id, secondClient.Id },
            employeeIds = Array.Empty<long>(),
            phaseCodes = Array.Empty<string>(),
            currentPhaseIndex = (int?)null
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var projectId = (await createResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64();

        var created = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}");
        Assert.Equal(new[] { firstClient.Id, secondClient.Id }, created.GetProperty("clients").EnumerateArray().Select(client => client.GetProperty("id").GetInt64()).Order().ToArray());
        Assert.Equal(new[] { firstClient.Id, secondClient.Id }, await ProjectClientIdsAsync(projectId));

        using var updatedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}", new
        {
            title = code,
            code,
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientIds = new[] { firstClient.Id, secondClient.Id }
        });
        Assert.Equal(HttpStatusCode.OK, updatedResponse.StatusCode);
        var updated = await updatedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(new[] { firstClient.Id, secondClient.Id }, updated.GetProperty("clients").EnumerateArray().Select(client => client.GetProperty("id").GetInt64()).Order().ToArray());
        Assert.Equal(new[] { firstClient.Id, secondClient.Id }, await ProjectClientIdsAsync(projectId));

        using var clearedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}", new
        {
            title = code,
            code,
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientIds = Array.Empty<long>()
        });
        Assert.Equal(HttpStatusCode.OK, clearedResponse.StatusCode);
        var cleared = await clearedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Empty(cleared.GetProperty("clients").EnumerateArray());

        var associations = await Task.WhenAll(
            fixture.Client.PutAsync($"/api/clients/{firstClient.Id}/projects/{projectId}", null),
            fixture.Client.PutAsync($"/api/clients/{secondClient.Id}/projects/{projectId}", null));
        Assert.All(associations, response => Assert.Equal(HttpStatusCode.NoContent, response.StatusCode));
        var associatedClientIds = await ProjectClientIdsAsync(projectId);
        Assert.Equal(new[] { firstClient.Id, secondClient.Id }, associatedClientIds);

        using var removed = await fixture.Client.DeleteAsync($"/api/clients/{firstClient.Id}/projects/{projectId}");
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.Equal(new[] { secondClient.Id }, await ProjectClientIdsAsync(projectId));

        var detail = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}");
        Assert.Equal(new[] { secondClient.Id }, detail.GetProperty("clients").EnumerateArray().Select(client => client.GetProperty("id").GetInt64()).ToArray());
    }

    [Fact]
    public async Task ClientSeesOnlyOwnProjectsAcrossActiveCompanyMembershipsAndCannotEdit()
    {
        var firstOwner = await CreateOwnerAsync();
        var secondOwner = await CreateOwnerAsync();
        var suffix = Guid.NewGuid().ToString("N");
        await LoginAsync("admin", "admin");
        var client = await CreateClientAsync($"projects.client.{suffix}", [firstOwner.CompanyId, secondOwner.CompanyId]);
        var otherClient = await CreateClientAsync($"projects.other.{suffix}", [firstOwner.CompanyId]);
        var firstProject = await CreateProjectAsync(firstOwner.Username, client.Id, $"OWN-1-{suffix[..6]}");
        var secondProject = await CreateProjectAsync(secondOwner.Username, client.Id, $"OWN-2-{suffix[..6]}");
        var otherProject = await CreateProjectAsync(firstOwner.Username, otherClient.Id, $"OTHER-{suffix[..6]}");

        await LoginAsync(client.Username);
        var projects = await fixture.Client.GetFromJsonAsync<JsonElement[]>("/api/projects/");
        Assert.Equal(2, projects!.Length);
        Assert.Equal(new[] { firstOwner.CompanyId, secondOwner.CompanyId }.Order().ToArray(), projects.Select(item => item.GetProperty("companyId").GetInt64()).Order().ToArray());
        Assert.All(projects, item => Assert.False(string.IsNullOrWhiteSpace(item.GetProperty("companyName").GetString())));

        var detail = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{secondProject}");
        Assert.Equal(secondOwner.CompanyId, detail.GetProperty("companyId").GetInt64());
        Assert.False(detail.GetProperty("canEditTimeline").GetBoolean());
        using var crossClient = await fixture.Client.GetAsync($"/api/projects/{otherProject}");
        Assert.Equal(HttpStatusCode.NotFound, crossClient.StatusCode);
        using var update = await fixture.Client.PutAsJsonAsync($"/api/projects/{firstProject}", new { title = "Denied", code = "DENIED", address = "", googleMapsUrl = (string?)null, clientIds = new[] { client.Id } });
        Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
        using var timeline = await fixture.Client.PutAsJsonAsync($"/api/projects/{firstProject}/phases", new { phaseCodes = Array.Empty<string>(), currentPhaseIndex = (int?)null });
        Assert.Equal(HttpStatusCode.NotFound, timeline.StatusCode);

        await SetCompanyActiveAsync(secondOwner.CompanyId, false);
        var activeProjects = await fixture.Client.GetFromJsonAsync<JsonElement[]>("/api/projects/");
        Assert.Single(activeProjects!);
        Assert.Equal(firstProject, activeProjects![0].GetProperty("id").GetInt64());
        using var inactiveDetail = await fixture.Client.GetAsync($"/api/projects/{secondProject}");
        Assert.Equal(HttpStatusCode.NotFound, inactiveDetail.StatusCode);
    }

    [Fact]
    public async Task OwnerCanPersistAndClearAnOptionalGoogleMapsUrl()
    {
        var owner = await CreateOwnerAsync();
        await LoginAsync(owner.Username);

        using var createdResponse = await fixture.Client.PostAsJsonAsync(
            "/api/projects/",
            new
            {
                title = "Casa do Vale",
                code = $"GM-{Guid.NewGuid():N}"[..12],
                address = "",
                phase = "",
                googleMapsUrl = " https://www.google.com/maps/search/?api=1&query=38.72,-9.14 ",
                clientIds = Array.Empty<long>(),
                employeeIds = Array.Empty<long>()
            });
        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var created = await createdResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("https://www.google.com/maps/search/?api=1&query=38.72,-9.14", created.GetProperty("googleMapsUrl").GetString());

        var projectId = created.GetProperty("id").GetInt64();
        using var updatedResponse = await fixture.Client.PutAsJsonAsync(
            $"/api/projects/{projectId}",
            new
            {
                title = "Casa do Vale",
                code = created.GetProperty("code").GetString(),
                address = "",
                phase = "",
                googleMapsUrl = "   ",
                clientIds = Array.Empty<long>()
            });
        Assert.Equal(HttpStatusCode.OK, updatedResponse.StatusCode);
        var updated = await updatedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("googleMapsUrl").ValueKind);

        using var invalidResponse = await fixture.Client.PutAsJsonAsync(
            $"/api/projects/{projectId}",
            new
            {
                title = "Casa do Vale",
                code = created.GetProperty("code").GetString(),
                address = "",
                phase = "",
                googleMapsUrl = "https://example.test/not-google-maps",
                clientIds = Array.Empty<long>()
            });
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        var invalid = await invalidResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(invalid.GetProperty("errors").TryGetProperty("googleMapsUrl", out _));
    }

    [Fact]
    public async Task OwnerCanCreateAndReplaceAnOptionalTimeline()
    {
        var owner = await CreateOwnerAsync();
        await LoginAsync(owner.Username);

        using var createdResponse = await fixture.Client.PostAsJsonAsync(
            "/api/projects/",
            new
            {
                title = "Casa com Timeline",
                code = $"TL-{Guid.NewGuid():N}"[..12],
                address = "",
                googleMapsUrl = (string?)null,
                clientIds = Array.Empty<long>(),
                employeeIds = Array.Empty<long>(),
                phaseCodes = new[] { "feasibility-studies", "topographic-survey" },
                currentPhaseIndex = 1
            });
        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var created = await createdResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, created.GetProperty("phases").GetArrayLength());
        Assert.True(created.GetProperty("phases")[1].GetProperty("isCurrent").GetBoolean());
        var feasibilityId = created.GetProperty("phases")[0].GetProperty("id").GetInt64();
        var surveyId = created.GetProperty("phases")[1].GetProperty("id").GetInt64();

        var projectId = created.GetProperty("id").GetInt64();
        using var invalidResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/phases", new { phaseCodes = new[] { "feasibility-studies" }, currentPhaseIndex = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);

        using var repeatedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/phases", new { phaseCodes = new[] { "feasibility-studies", "topographic-survey", "feasibility-studies" }, currentPhaseIndex = 2 });
        Assert.Equal(HttpStatusCode.OK, repeatedResponse.StatusCode);
        var repeated = await repeatedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, repeated.GetProperty("phases").GetArrayLength());
        Assert.True(repeated.GetProperty("phases")[2].GetProperty("isCurrent").GetBoolean());
        Assert.Equal(feasibilityId, repeated.GetProperty("phases")[0].GetProperty("id").GetInt64());
        Assert.Equal(surveyId, repeated.GetProperty("phases")[1].GetProperty("id").GetInt64());

        using var reorderedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/phases", new { phaseCodes = new[] { "topographic-survey", "feasibility-studies", "feasibility-studies" }, currentPhaseIndex = 0 });
        Assert.Equal(HttpStatusCode.OK, reorderedResponse.StatusCode);
        var reordered = await reorderedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(surveyId, reordered.GetProperty("phases")[0].GetProperty("id").GetInt64());
        Assert.Equal(feasibilityId, reordered.GetProperty("phases")[1].GetProperty("id").GetInt64());

        using var clearedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/phases", new { phaseCodes = Array.Empty<string>(), currentPhaseIndex = (int?)null });
        Assert.Equal(HttpStatusCode.OK, clearedResponse.StatusCode);
        var cleared = await clearedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, cleared.GetProperty("phases").GetArrayLength());
    }

    [Fact]
    public async Task ProjectChatPersistsForAllParticipantsAndArchivedProjectsAreReadOnly()
    {
        var owner = await CreateOwnerAsync();
        var suffix = Guid.NewGuid().ToString("N");
        await LoginAsync("admin", "admin");
        var client = await CreateClientAsync($"chat.client.{suffix}", [owner.CompanyId]);
        var unrelatedClient = await CreateClientAsync($"chat.other.{suffix}", [owner.CompanyId]);
        var architect = await CreateEmployeeAsync(owner.CompanyId, $"chat.architect.{suffix}", "Beatriz");

        await LoginAsync(owner.Username);
        using var projectResponse = await fixture.Client.PostAsJsonAsync("/api/projects/", new
        {
            title = "Project chat",
            code = $"CHAT-{suffix[..6]}",
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientIds = new[] { client.Id },
            employeeIds = new[] { architect.Id },
            phaseCodes = Array.Empty<string>(),
            currentPhaseIndex = (int?)null
        });
        Assert.Equal(HttpStatusCode.Created, projectResponse.StatusCode);
        var projectId = (await projectResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64();

        using var firstResponse = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/messages", new { body = "  Primeira mensagem  " });
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
        var first = await firstResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Primeira mensagem", first.GetProperty("body").GetString());
        Assert.Equal("Ana", first.GetProperty("authorDisplayName").GetString());
        Assert.True(first.GetProperty("isOwn").GetBoolean());

        await LoginAsync(architect.Username);
        var architectPage = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}/messages");
        Assert.Single(architectPage.GetProperty("items").EnumerateArray());
        Assert.False(architectPage.GetProperty("items")[0].GetProperty("isOwn").GetBoolean());
        using var secondResponse = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/messages", new { body = "Segunda mensagem" });
        Assert.Equal(HttpStatusCode.Created, secondResponse.StatusCode);
        var second = await secondResponse.Content.ReadFromJsonAsync<JsonElement>();

        await LoginAsync(client.Username);
        using var thirdResponse = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/messages", new { body = "Mensagem do cliente" });
        Assert.Equal(HttpStatusCode.Created, thirdResponse.StatusCode);
        var third = await thirdResponse.Content.ReadFromJsonAsync<JsonElement>();
        var latestPage = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}/messages?limit=1");
        Assert.True(latestPage.GetProperty("hasMore").GetBoolean());
        Assert.Equal(third.GetProperty("id").GetInt64(), latestPage.GetProperty("items")[0].GetProperty("id").GetInt64());
        var olderPage = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}/messages?beforeId={third.GetProperty("id").GetInt64()}&limit=1");
        Assert.Equal(second.GetProperty("id").GetInt64(), olderPage.GetProperty("items")[0].GetProperty("id").GetInt64());
        var incrementalPage = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}/messages?afterId={first.GetProperty("id").GetInt64()}");
        Assert.Equal(2, incrementalPage.GetProperty("items").GetArrayLength());

        await LoginAsync(unrelatedClient.Username);
        using var denied = await fixture.Client.GetAsync($"/api/projects/{projectId}/messages");
        Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);

        await LoginAsync(owner.Username);
        using var blank = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/messages", new { body = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, blank.StatusCode);
        using var archived = await fixture.Client.PostAsync($"/api/projects/{projectId}/archive", null);
        Assert.Equal(HttpStatusCode.NoContent, archived.StatusCode);

        await LoginAsync(client.Username);
        using var readable = await fixture.Client.GetAsync($"/api/projects/{projectId}/messages");
        Assert.Equal(HttpStatusCode.OK, readable.StatusCode);
        using var blocked = await fixture.Client.PostAsJsonAsync($"/api/projects/{projectId}/messages", new { body = "Não enviar" });
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
    }

    private async Task<(string Username, long CompanyId, long UserId)> CreateOwnerAsync()
    {
        await LoginAsync("admin", "admin");
        var suffix = Guid.NewGuid().ToString("N");
        using var companyResponse = await fixture.Client.PostAsJsonAsync(
            "/api/admin/companies",
            new
            {
                name = $"Atelier {suffix[..6]}",
                legalName = "Atelier de Teste, Lda.",
                nif = suffix[..9],
                email = $"{suffix}@example.test",
                phoneNumber = "210000000",
                address = "Portugal"
            });
        Assert.Equal(HttpStatusCode.Created, companyResponse.StatusCode);
        var company = await companyResponse.Content.ReadFromJsonAsync<JsonElement>();
        var companyId = company.GetProperty("id").GetInt64();
        var username = $"owner.{suffix}";
        using var employeeResponse = await fixture.Client.PostAsJsonAsync(
            "/api/admin/employees",
            new
            {
                username,
                password = "secret",
                roleIds = new[] { 3, 4 },
                companyId,
                displayName = "Ana",
                fullName = "Ana Martins",
                nif = suffix[..9],
                email = $"{username}@example.test",
                phoneNumber = "920000000",
                address = "Lisboa"
            });
        Assert.Equal(HttpStatusCode.Created, employeeResponse.StatusCode);
        var employee = await employeeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userId = employee.GetProperty("userId").GetInt64();

        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE company_employees SET company_role = 'owner' WHERE company_id = @companyId; INSERT INTO user_roles (user_id, role_id) VALUES (@userId, 5);";
        command.Parameters.AddWithValue("companyId", companyId);
        command.Parameters.AddWithValue("userId", userId);
        await command.ExecuteNonQueryAsync();
        return (username, companyId, userId);
    }

    private async Task<(long Id, string Username)> CreateClientAsync(string username, long[] companyIds)
    {
        using var response = await fixture.Client.PostAsJsonAsync("/api/admin/clients", new
        {
            username,
            password = "secret",
            companyIds,
            displayName = username,
            fullName = username,
            nif = Guid.NewGuid().ToString("N")[..9],
            email = $"{username}@example.test",
            phoneNumber = "930000000",
            address = "Lisboa"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return ((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64(), username);
    }

    private async Task<(long Id, string Username)> CreateEmployeeAsync(long companyId, string username, string displayName)
    {
        using var response = await fixture.Client.PostAsJsonAsync("/api/admin/employees", new
        {
            username,
            password = "secret",
            roleIds = new[] { 3, 4 },
            companyId,
            displayName,
            fullName = displayName,
            nif = Guid.NewGuid().ToString("N")[..9],
            email = $"{username}@example.test",
            phoneNumber = "920000001",
            address = "Lisboa"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return ((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64(), username);
    }

    private async Task<long> CreateProjectAsync(string ownerUsername, long clientId, string code)
    {
        await LoginAsync(ownerUsername);
        using var response = await fixture.Client.PostAsJsonAsync("/api/projects/", new
        {
            title = code,
            code,
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientIds = new[] { clientId },
            employeeIds = Array.Empty<long>(),
            phaseCodes = Array.Empty<string>(),
            currentPhaseIndex = (int?)null
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var project = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(project.TryGetProperty("companyName", out _));
        return project.GetProperty("id").GetInt64();
    }

    private async Task SetCompanyActiveAsync(long companyId, bool active)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE companies SET is_active = @active WHERE id = @companyId";
        command.Parameters.AddWithValue("companyId", companyId);
        command.Parameters.AddWithValue("active", active);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<long[]> ProjectClientIdsAsync(long projectId)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT client_id FROM project_clients WHERE project_id = @projectId ORDER BY client_id";
        command.Parameters.AddWithValue("projectId", projectId);
        var clientIds = new List<long>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) clientIds.Add(reader.GetInt64(0));
        return clientIds.ToArray();
    }

    private async Task LoginAsync(string username, string password = "secret")
    {
        using var response = await fixture.Client.PostAsJsonAsync("/api/auth/login", new { username, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task UploadAsync(JsonElement grant, byte[] bytes)
    {
        using var storage = new HttpClient();
        using var content = new ByteArrayContent(bytes);
        foreach (var header in grant.GetProperty("requiredHeaders").EnumerateObject())
        {
            if (header.Name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
                content.Headers.ContentType = new MediaTypeHeaderValue(header.Value.GetString()!);
            else
                content.Headers.TryAddWithoutValidation(header.Name, header.Value.GetString());
        }
        using var response = await storage.PutAsync(grant.GetProperty("url").GetString(), content);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
