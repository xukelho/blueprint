using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class ProjectIntegrationTests(PostgreSqlApiFixture fixture)
    : IClassFixture<PostgreSqlApiFixture>
{
    [Fact]
    public async Task OwnerCanReplaceClearAndConcurrentlyAssociateOneClientWhileSchemaAllowsMany()
    {
        var owner = await CreateOwnerAsync();
        var suffix = Guid.NewGuid().ToString("N");
        await LoginAsync("admin", "admin");
        var firstClient = await CreateClientAsync($"assignment.first.{suffix}", [owner.CompanyId]);
        var secondClient = await CreateClientAsync($"assignment.second.{suffix}", [owner.CompanyId]);
        var code = $"ASSIGN-{suffix[..6]}";
        var projectId = await CreateProjectAsync(owner.Username, firstClient.Id, code);

        var created = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}");
        Assert.Equal(firstClient.Id, created.GetProperty("client").GetProperty("id").GetInt64());
        Assert.Equal(new[] { firstClient.Id }, await ProjectClientIdsAsync(projectId));

        using var replacedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}", new
        {
            title = code,
            code,
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientId = (long?)secondClient.Id
        });
        Assert.Equal(HttpStatusCode.OK, replacedResponse.StatusCode);
        var replaced = await replacedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(secondClient.Id, replaced.GetProperty("client").GetProperty("id").GetInt64());
        Assert.Equal(new[] { secondClient.Id }, await ProjectClientIdsAsync(projectId));

        using var clearedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}", new
        {
            title = code,
            code,
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientId = (long?)null
        });
        Assert.Equal(HttpStatusCode.OK, clearedResponse.StatusCode);
        var cleared = await clearedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("client").ValueKind);

        var associations = await Task.WhenAll(
            fixture.Client.PutAsync($"/api/clients/{firstClient.Id}/projects/{projectId}", null),
            fixture.Client.PutAsync($"/api/clients/{secondClient.Id}/projects/{projectId}", null));
        Assert.Single(associations, response => response.StatusCode == HttpStatusCode.NoContent);
        Assert.Single(associations, response => response.StatusCode == HttpStatusCode.NotFound);
        var associatedClientIds = await ProjectClientIdsAsync(projectId);
        Assert.Single(associatedClientIds);

        using var removed = await fixture.Client.DeleteAsync($"/api/clients/{associatedClientIds[0]}/projects/{projectId}");
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
        Assert.Empty(await ProjectClientIdsAsync(projectId));

        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO project_clients (project_id, client_id) VALUES (@projectId, @firstClientId), (@projectId, @secondClientId)";
        command.Parameters.AddWithValue("projectId", projectId);
        command.Parameters.AddWithValue("firstClientId", firstClient.Id);
        command.Parameters.AddWithValue("secondClientId", secondClient.Id);
        await command.ExecuteNonQueryAsync();
        Assert.Equal(new[] { firstClient.Id, secondClient.Id }, await ProjectClientIdsAsync(projectId));

        await using var cleanup = connection.CreateCommand();
        cleanup.CommandText = "DELETE FROM project_clients WHERE project_id = @projectId";
        cleanup.Parameters.AddWithValue("projectId", projectId);
        await cleanup.ExecuteNonQueryAsync();
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
        using var update = await fixture.Client.PutAsJsonAsync($"/api/projects/{firstProject}", new { title = "Denied", code = "DENIED", address = "", googleMapsUrl = (string?)null, clientId = client.Id });
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
                clientId = (long?)null,
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
                clientId = (long?)null
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
                clientId = (long?)null
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
                clientId = (long?)null,
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

    private async Task<long> CreateProjectAsync(string ownerUsername, long clientId, string code)
    {
        await LoginAsync(ownerUsername);
        using var response = await fixture.Client.PostAsJsonAsync("/api/projects/", new
        {
            title = code,
            code,
            address = "Lisboa",
            googleMapsUrl = (string?)null,
            clientId,
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
}
