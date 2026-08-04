using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class CompanyIntegrationTests(
    PostgreSqlApiFixture fixture)
    : IClassFixture<PostgreSqlApiFixture>
{
    [Fact]
    public async Task CompanyRequiresAnAuthenticatedEmployee()
    {
        using var anonymous = new HttpClient { BaseAddress = fixture.Client.BaseAddress };
        using var unauthorized = await anonymous.GetAsync("/api/company");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);

        await CreateClientAsync("company.client");
        await LoginAsync("company.client");
        using var forbidden = await fixture.Client.GetAsync("/api/company");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task EmployeeReadsAndUpdatesOnlyTheirActiveCompany()
    {
        var companyId = await CreateCompanyAsync("Current Company");
        await CreateEmployeeAsync("company.employee", companyId);
        await LoginAsync("company.employee");

        await PromoteToOwnerAsync("company.employee");
        var company = await fixture.Client.GetFromJsonAsync<JsonElement>("/api/company");
        Assert.Equal(companyId, company.GetProperty("id").GetInt64());
        Assert.Equal(JsonValueKind.Null, company.GetProperty("website").ValueKind);

        using var update = await fixture.Client.PutAsJsonAsync(
            "/api/company",
            CompanyPayload("Current Company Updated", " atelier.example "));
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Current Company Updated", updated.GetProperty("name").GetString());
        Assert.Equal("atelier.example", updated.GetProperty("website").GetString());

        using var invalid = await fixture.Client.PutAsJsonAsync(
            "/api/company",
            CompanyPayload(" "));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var invalidBody = await invalid.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(invalidBody.GetProperty("errors").TryGetProperty("name", out _));

        using var deactivate = await fixture.Client.DeleteAsync(
            $"/api/admin/companies/{companyId}");
        Assert.Equal(HttpStatusCode.NoContent, deactivate.StatusCode);
        using var inactive = await fixture.Client.GetAsync("/api/company");
        Assert.Equal(HttpStatusCode.NotFound, inactive.StatusCode);
    }

    private async Task<long> CreateCompanyAsync(string name)
    {
        using var response = await fixture.Client.PostAsJsonAsync(
            "/api/admin/companies",
            CompanyPayload(name));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetInt64();
    }

    private async Task CreateEmployeeAsync(string username, long companyId)
    {
        using var response = await fixture.Client.PostAsJsonAsync(
            "/api/admin/employees",
            new
            {
                username,
                password = "secret",
                roleIds = new[] { 3 },
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

    private async Task PromoteToOwnerAsync(string username)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE company_employees SET company_role = 'owner' WHERE employee_id = (SELECT e.id FROM employees e JOIN users u ON u.id = e.user_id WHERE u.username = @username)";
        command.Parameters.AddWithValue("username", username);
        await command.ExecuteNonQueryAsync();
    }

    private async Task CreateClientAsync(string username)
    {
        using var response = await fixture.Client.PostAsJsonAsync(
            "/api/admin/clients",
            new
            {
                username,
                password = "secret",
                companyIds = Array.Empty<long>(),
                displayName = "Marta",
                fullName = "Marta Silva",
                nif = "123456789",
                email = $"{username}@example.test",
                phoneNumber = "910000000",
                address = "Lisboa"
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task LoginAsync(string username)
    {
        using var login = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username, password = "secret" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    private static object CompanyPayload(string name, string? website = null) => new
    {
        name,
        legalName = "Current Company, Lda.",
        nif = "501234567",
        email = "company@example.test",
        phoneNumber = "210000000",
        address = "Portugal",
        website
    };
}
