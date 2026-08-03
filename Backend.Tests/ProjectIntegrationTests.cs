using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class ProjectIntegrationTests(PostgreSqlApiFixture fixture)
    : IClassFixture<PostgreSqlApiFixture>
{
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

        var projectId = created.GetProperty("id").GetInt64();
        using var invalidResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/phases", new { phaseCodes = new[] { "feasibility-studies" }, currentPhaseIndex = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);

        using var repeatedResponse = await fixture.Client.PutAsJsonAsync($"/api/projects/{projectId}/phases", new { phaseCodes = new[] { "feasibility-studies", "topographic-survey", "feasibility-studies" }, currentPhaseIndex = 2 });
        Assert.Equal(HttpStatusCode.OK, repeatedResponse.StatusCode);
        var repeated = await repeatedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, repeated.GetProperty("phases").GetArrayLength());
        Assert.True(repeated.GetProperty("phases")[2].GetProperty("isCurrent").GetBoolean());

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

    private async Task LoginAsync(string username, string password = "secret")
    {
        using var response = await fixture.Client.PostAsJsonAsync("/api/auth/login", new { username, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
