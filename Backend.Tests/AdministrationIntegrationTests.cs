using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class AdministrationIntegrationTests(
    PostgreSqlApiFixture fixture)
    : IClassFixture<PostgreSqlApiFixture>
{
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task FreshDatabaseHasExpectedSchemaRolesAndBootstrapAdmin()
    {
        var roles = await fixture.Client.GetFromJsonAsync<JsonElement[]>(
            "/api/admin/roles");

        Assert.NotNull(roles);
        Assert.Equal(
            ["platform admin", "client", "employee", "architect"],
            roles.Select(candidate => candidate.GetProperty("name").GetString()));

        using var login = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "admin", password = "admin" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("success", loginBody.GetProperty("status").GetString());
        Assert.Equal(
            ["platform admin"],
            loginBody.GetProperty("roles")
                .EnumerateArray()
                .Select(candidate => candidate.GetString()));

        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'role_id'
                ),
                (
                    SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name IN (
                          'users', 'roles', 'user_roles', 'companies',
                          'employees', 'clients'
                      )
                );
            """;
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.False(reader.GetBoolean(0));
        Assert.Equal(6, reader.GetInt64(1));
    }

    [Fact]
    public async Task EmployeeLifecycleEnforcesRolesAtomicityAndSoftDeletedCompanyAccess()
    {
        var company = await CreateCompanyAsync("Atelier Norte");
        var companyId = company.GetProperty("id").GetInt64();

        var employeePayload = new
        {
            username = "employee.architect",
            password = "secret",
            roleIds = new[] { 3, 4 },
            companyId,
            displayName = "Ana",
            fullName = "Ana Martins",
            nif = "123456789",
            email = "ana@example.test",
            phoneNumber = "910000000",
            address = "Lisbon"
        };
        using var createEmployee = await fixture.Client.PostAsJsonAsync(
            "/api/admin/employees", employeePayload);
        Assert.Equal(HttpStatusCode.Created, createEmployee.StatusCode);
        var employee = await createEmployee.Content.ReadFromJsonAsync<JsonElement>();
        var employeeId = employee.GetProperty("id").GetInt64();
        var userId = employee.GetProperty("userId").GetInt64();

        using var login = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "employee.architect", password = "secret" });
        var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            ["employee", "architect"],
            loginBody.GetProperty("roles")
                .EnumerateArray()
                .Select(candidate => candidate.GetString()));

        using var invalidRoleUpdate = await fixture.Client.PutAsJsonAsync(
            $"/api/admin/users/{userId}",
            new
            {
                username = "employee.architect",
                password = (string?)null,
                roleIds = new[] { 2 }
            });
        Assert.Equal(HttpStatusCode.Conflict, invalidRoleUpdate.StatusCode);

        using var validRoleUpdate = await fixture.Client.PutAsJsonAsync(
            $"/api/admin/users/{userId}",
            new
            {
                username = "employee.architect",
                password = (string?)null,
                roleIds = new[] { 3 }
            });
        Assert.Equal(HttpStatusCode.OK, validRoleUpdate.StatusCode);
        var updatedUser = await validRoleUpdate.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            ["employee"],
            updatedUser.GetProperty("roles")
                .EnumerateArray()
                .Select(candidate => candidate.GetProperty("name").GetString()));

        using var duplicate = await fixture.Client.PostAsJsonAsync(
            "/api/admin/employees", employeePayload);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal(1, await CountUsersAsync("employee.architect"));

        using var invalidEmployeeRoles = await fixture.Client.PostAsJsonAsync(
            "/api/admin/employees",
            new
            {
                username = "architect.without.employee",
                password = "secret",
                roleIds = new[] { 4 },
                companyId,
                displayName = "Invalid",
                fullName = "Invalid Architect",
                nif = "555555555",
                email = "invalid@example.test",
                phoneNumber = "940000000",
                address = "Portugal"
            });
        Assert.Equal(HttpStatusCode.BadRequest, invalidEmployeeRoles.StatusCode);
        Assert.Equal(0, await CountUsersAsync("architect.without.employee"));

        using var deleteCompany = await fixture.Client.DeleteAsync(
            $"/api/admin/companies/{companyId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteCompany.StatusCode);
        using var deleteCompanyAgain = await fixture.Client.DeleteAsync(
            $"/api/admin/companies/{companyId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteCompanyAgain.StatusCode);

        var activeCompanies = await fixture.Client.GetFromJsonAsync<JsonElement[]>(
            "/api/admin/companies");
        Assert.DoesNotContain(
            activeCompanies!,
            candidate => candidate.GetProperty("id").GetInt64() == companyId);
        var allCompanies = await fixture.Client.GetFromJsonAsync<JsonElement[]>(
            "/api/admin/companies?includeInactive=true");
        Assert.Contains(
            allCompanies!,
            candidate =>
                candidate.GetProperty("id").GetInt64() == companyId &&
                !candidate.GetProperty("isActive").GetBoolean() &&
                candidate.GetProperty("updatedBy").GetInt64() == -999 &&
                candidate.GetProperty("updatedAt").GetDateTimeOffset() >
                candidate.GetProperty("createdAt").GetDateTimeOffset());

        using var loginAfterDelete = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "employee.architect", password = "secret" });
        Assert.Equal(HttpStatusCode.OK, loginAfterDelete.StatusCode);
        var loginAfterDeleteBody =
            await loginAfterDelete.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            ["employee"],
            loginAfterDeleteBody.GetProperty("roles")
                .EnumerateArray()
                .Select(candidate => candidate.GetString()));

        using var inactiveLink = await fixture.Client.PostAsJsonAsync(
            "/api/admin/clients",
            new
            {
                username = "inactive.company.client",
                password = "secret",
                companyId,
                displayName = "Client",
                fullName = "Inactive Company Client",
                nif = "987654321",
                email = "client@example.test",
                phoneNumber = "920000000",
                address = "Porto"
            });
        Assert.Equal(HttpStatusCode.Conflict, inactiveLink.StatusCode);
        Assert.Equal(0, await CountUsersAsync("inactive.company.client"));

        using var deleteEmployee = await fixture.Client.DeleteAsync(
            $"/api/admin/employees/{employeeId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteEmployee.StatusCode);
        Assert.Equal(0, await CountUsersAsync("employee.architect"));
    }

    [Fact]
    public async Task ClientCreationAndDeletionOperateOnTheWholeAccount()
    {
        using var createClient = await fixture.Client.PostAsJsonAsync(
            "/api/admin/clients",
            new
            {
                username = "independent.client",
                password = "secret",
                companyId = (long?)null,
                displayName = "Marta",
                fullName = "Marta Silva",
                nif = "111222333",
                email = "marta@example.test",
                phoneNumber = "930000000",
                address = "Setubal"
            });
        Assert.Equal(HttpStatusCode.Created, createClient.StatusCode);
        var client = await createClient.Content.ReadFromJsonAsync<JsonElement>();

        using var login = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "independent.client", password = "secret" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var loginBody = await login.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(
            ["client"],
            loginBody.GetProperty("roles")
                .EnumerateArray()
                .Select(candidate => candidate.GetString()));

        using var delete = await fixture.Client.DeleteAsync(
            $"/api/admin/clients/{client.GetProperty("id").GetInt64()}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        using var loginAfterDelete = await fixture.Client.PostAsJsonAsync(
            "/api/auth/login",
            new { username = "independent.client", password = "secret" });
        Assert.Equal(HttpStatusCode.Unauthorized, loginAfterDelete.StatusCode);
    }

    private async Task<JsonElement> CreateCompanyAsync(string name)
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
        return await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
    }

    private async Task<long> CountUsersAsync(string username)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM users WHERE username = @username";
        command.Parameters.AddWithValue("username", username);
        return (long)(await command.ExecuteScalarAsync())!;
    }
}
