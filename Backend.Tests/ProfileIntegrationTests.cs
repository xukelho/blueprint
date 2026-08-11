using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Blueprint.Api.IntegrationTests;

public sealed class ProfileIntegrationTests(
    PostgreSqlApiFixture fixture)
    : IClassFixture<PostgreSqlApiFixture>
{
    [Fact]
    public async Task ProfileRequiresSessionAndLogoutRevokesIt()
    {
        using var anonymous = new HttpClient
        {
            BaseAddress = fixture.Client.BaseAddress
        };
        using var unauthorized = await anonymous.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);

        using var login = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "admin", password = "admin" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Contains(
            login.Headers.GetValues("Set-Cookie"),
            value => value.Contains("blueprint.session=", StringComparison.Ordinal));

        using var noAdminProfile = await fixture.Client.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.NotFound, noAdminProfile.StatusCode);

        using var logout = await fixture.Client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.OK, logout.StatusCode);
        using var afterLogout = await fixture.Client.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);
    }

    [Fact]
    public async Task ClientCanEditOwnProfileWithoutChangingItsBaseRole()
    {
        var companyId = await CreateCompanyAsync("Profile Client Company");
        await CreateClientAsync("profile.client", companyId);
        await CreateClientAsync("profile.client.conflict", null);
        await LoginAsync("profile.client");

        var profile = await fixture.Client.GetFromJsonAsync<JsonElement>("/api/profile");
        Assert.Equal("client", profile.GetProperty("profileType").GetString());
        Assert.Equal("profile.client", profile.GetProperty("username").GetString());
        Assert.Equal(
            ["client"],
            profile.GetProperty("roles").EnumerateArray()
                .Select(candidate => candidate.GetString()));

        using var update = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload(
                username: "profile.client.updated",
                companyId: companyId,
                displayName: "Marta Atualizada"));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Contains(
            update.Headers.GetValues("Set-Cookie"),
            value => value.Contains("blueprint.session=", StringComparison.Ordinal));
        var updated = await update.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("profile.client.updated", updated.GetProperty("username").GetString());
        Assert.Equal("Marta Atualizada", updated.GetProperty("displayName").GetString());
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("companyId").ValueKind);
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("companyName").ValueKind);
        Assert.Equal(companyId, updated.GetProperty("availableCompanies")[0].GetProperty("id").GetInt64());
        Assert.Equal(
            ["client"],
            updated.GetProperty("roles").EnumerateArray()
                .Select(candidate => candidate.GetString()));

        using var architectAttempt = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload("profile.client.updated", companyId, isArchitect: true));
        Assert.Equal(HttpStatusCode.BadRequest, architectAttempt.StatusCode);

        using var conflict = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload("profile.client.conflict", companyId));
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);

        using var ignoredCompany = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload("profile.client.updated", long.MaxValue));
        Assert.Equal(HttpStatusCode.OK, ignoredCompany.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await ignoredCompany.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("companyId").ValueKind);

        using var clearCompany = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload("profile.client.updated", null));
        Assert.Equal(HttpStatusCode.OK, clearCompany.StatusCode);
        var cleared = await clearCompany.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("companyId").ValueKind);
        Assert.Equal(
            ["client"],
            cleared.GetProperty("roles").EnumerateArray()
                .Select(candidate => candidate.GetString()));
    }

    [Fact]
    public async Task EmployeeCanChangeCompanyAndToggleOnlyArchitectRole()
    {
        var firstCompanyId = await CreateCompanyAsync("Profile Employee One");
        var secondCompanyId = await CreateCompanyAsync("Profile Employee Two");
        await CreateEmployeeAsync("profile.employee", firstCompanyId);
        await LoginAsync("profile.employee");

        using var update = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload(
                "profile.employee",
                secondCompanyId,
                displayName: "Ana Atualizada",
                isArchitect: false));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(secondCompanyId, updated.GetProperty("companyId").GetInt64());
        Assert.Equal(
            ["employee"],
            updated.GetProperty("roles").EnumerateArray()
                .Select(candidate => candidate.GetString()));
        using var addArchitect = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload("profile.employee", secondCompanyId, isArchitect: true));
        Assert.Equal(HttpStatusCode.OK, addArchitect.StatusCode);
        var architect = await addArchitect.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            ["employee", "architect"],
            architect.GetProperty("roles").EnumerateArray()
                .Select(candidate => candidate.GetString()));

        using var missingCompany = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload("profile.employee", null, isArchitect: true));
        Assert.Equal(HttpStatusCode.BadRequest, missingCompany.StatusCode);

        using var invalid = await fixture.Client.PutAsJsonAsync(
            "/api/profile",
            ProfilePayload(" ", secondCompanyId));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var invalidBody = await invalid.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(invalidBody.GetProperty("errors").TryGetProperty("username", out _));
    }

    private async Task LoginAsync(string username)
    {
        using var login = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username, password = "secret" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    private async Task<long> CreateCompanyAsync(string name)
    {
        using var response = await fixture.Client.PostAsJsonAsync(
            "/api/admin/companies",
            new
            {
                name,
                legalName = $"{name}, Lda.",
                nif = Guid.NewGuid().ToString("N")[..9],
                email = $"{Guid.NewGuid():N}@example.test",
                phoneNumber = "210000000",
                address = "Portugal"
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetInt64();
    }

    private async Task CreateClientAsync(string username, long? companyId)
    {
        using var response = await fixture.Client.PostAsJsonAsync(
            "/api/admin/clients",
            new
            {
                username,
                password = "secret",
                companyIds = companyId is long id ? new[] { id } : Array.Empty<long>(),
                displayName = "Marta",
                fullName = "Marta Silva",
                nif = "123456789",
                email = $"{username}@example.test",
                phoneNumber = "910000000",
                address = "Lisboa"
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task CreateEmployeeAsync(string username, long companyId)
    {
        using var response = await fixture.Client.PostAsJsonAsync(
            "/api/admin/employees",
            new
            {
                username,
                password = "secret",
                roleIds = new[] { 3, 4 },
                companyId,
                displayName = "Ana",
                fullName = "Ana Martins",
                nif = "987654321",
                email = $"{username}@example.test",
                phoneNumber = "920000000",
                address = "Porto"
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static object ProfilePayload(
        string username,
        long? companyId,
        string displayName = "Perfil Atualizado",
        bool isArchitect = false) =>
        new
        {
            username,
            displayName,
            fullName = "Perfil Completo",
            nif = "111222333",
            email = "profile.updated@example.test",
            phoneNumber = "930000000",
            address = "Coimbra",
            companyId,
            isArchitect
        };
}
