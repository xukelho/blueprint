using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class ClientInvitationIntegrationTests(PostgreSqlApiFixture fixture)
    : IClassFixture<PostgreSqlApiFixture>
{
    [Fact]
    public async Task InvitationsAreCompanyScopedOwnerOnlyUniqueAndExpireAfterThreeDays()
    {
        var suffix = Guid.NewGuid().ToString("N");
        await LoginAsync("admin", "admin");
        var companyId = await CreateCompanyAsync($"Invite {suffix[..6]}");
        var secondCompanyId = await CreateCompanyAsync($"Invite second {suffix[..6]}");
        var ownerUsername = $"owner.{suffix}";
        var employeeUsername = $"employee.{suffix}";
        var ownerEmployeeId = await CreateEmployeeAsync(ownerUsername, companyId, owner: true);
        await CreateEmployeeAsync(employeeUsername, companyId, owner: false);

        var confirmedEmail = $"Confirmed.{suffix}@Example.Test";
        using var createClient = await fixture.Client.PostAsJsonAsync(
            "/api/admin/clients",
            ClientPayload($"client.{suffix}", confirmedEmail, [companyId, secondCompanyId]));
        Assert.Equal(HttpStatusCode.Created, createClient.StatusCode);
        var confirmedClient = await createClient.Content.ReadFromJsonAsync<JsonElement>();
        var confirmedClientId = confirmedClient.GetProperty("id").GetInt64();
        Assert.Equal(confirmedEmail.ToLowerInvariant(), confirmedClient.GetProperty("email").GetString());
        Assert.Equal(companyId, confirmedClient.GetProperty("companyIds")[0].GetInt64());

        using var duplicateClient = await fixture.Client.PostAsJsonAsync(
            "/api/admin/clients",
            ClientPayload($"client.duplicate.{suffix}", confirmedEmail.ToLowerInvariant(), []));
        Assert.Equal(HttpStatusCode.Conflict, duplicateClient.StatusCode);

        await LoginAsync(ownerUsername);
        var pendingEmail = $"Pending.{suffix}@Example.Test";
        using var createInvitation = await fixture.Client.PostAsJsonAsync(
            "/api/client-invitations/",
            new { email = pendingEmail });
        Assert.Equal(HttpStatusCode.Created, createInvitation.StatusCode);
        var invitation = await createInvitation.Content.ReadFromJsonAsync<JsonElement>();
        var invitationId = invitation.GetProperty("id").GetInt64();
        Assert.Equal(pendingEmail.ToLowerInvariant(), invitation.GetProperty("email").GetString());
        Assert.Equal(
            TimeSpan.FromDays(3),
            invitation.GetProperty("expiresAt").GetDateTimeOffset() - invitation.GetProperty("sentAt").GetDateTimeOffset());

        using var duplicateInvitation = await fixture.Client.PostAsJsonAsync(
            "/api/client-invitations/",
            new { email = pendingEmail.ToLowerInvariant() });
        Assert.Equal(HttpStatusCode.Conflict, duplicateInvitation.StatusCode);

        using var confirmedInvitation = await fixture.Client.PostAsJsonAsync(
            "/api/client-invitations/",
            new { email = confirmedEmail });
        Assert.Equal(HttpStatusCode.Conflict, confirmedInvitation.StatusCode);

        var listed = await fixture.Client.GetFromJsonAsync<JsonElement[]>("/api/client-invitations/");
        Assert.Contains(listed!, value => value.GetProperty("id").GetInt64() == invitationId);

        await BackdateInvitationAsync(invitationId);
        var afterExpiry = await fixture.Client.GetFromJsonAsync<JsonElement[]>("/api/client-invitations/");
        Assert.DoesNotContain(afterExpiry!, value => value.GetProperty("id").GetInt64() == invitationId);
        Assert.Equal(0, await CountInvitationAsync(invitationId));

        using var recreate = await fixture.Client.PostAsJsonAsync(
            "/api/client-invitations/",
            new { email = pendingEmail });
        Assert.Equal(HttpStatusCode.Created, recreate.StatusCode);

        using var firstNotes = await fixture.Client.PutAsJsonAsync(
            $"/api/clients/{confirmedClientId}/notes",
            new { internalNotes = "First company notes" });
        Assert.Equal(HttpStatusCode.NoContent, firstNotes.StatusCode);

        await MoveEmployeeAsync(ownerEmployeeId, secondCompanyId);
        var secondDetail = await fixture.Client.GetFromJsonAsync<JsonElement>($"/api/clients/{confirmedClientId}");
        Assert.Equal(string.Empty, secondDetail.GetProperty("internalNotes").GetString());
        using var secondNotes = await fixture.Client.PutAsJsonAsync(
            $"/api/clients/{confirmedClientId}/notes",
            new { internalNotes = "Second company notes" });
        Assert.Equal(HttpStatusCode.NoContent, secondNotes.StatusCode);
        using var secondCompanyInvite = await fixture.Client.PostAsJsonAsync(
            "/api/client-invitations/",
            new { email = pendingEmail });
        Assert.Equal(HttpStatusCode.Created, secondCompanyInvite.StatusCode);
        Assert.Equal(
            new[] { "First company notes", "Second company notes" },
            await LoadNotesAsync(confirmedClientId));

        await LoginAsync(employeeUsername);
        using var employeeList = await fixture.Client.GetAsync("/api/client-invitations/");
        Assert.Equal(HttpStatusCode.OK, employeeList.StatusCode);
        using var employeeCreate = await fixture.Client.PostAsJsonAsync(
            "/api/client-invitations/",
            new { email = $"forbidden.{suffix}@example.test" });
        Assert.Equal(HttpStatusCode.Forbidden, employeeCreate.StatusCode);

        await LoginAsync(ownerUsername);
        var overrideEmail = $"Override.{suffix}@Example.Test";
        using var overrideInvitation = await fixture.Client.PostAsJsonAsync(
            "/api/client-invitations/",
            new { email = overrideEmail });
        Assert.Equal(HttpStatusCode.Created, overrideInvitation.StatusCode);

        await LoginAsync("admin", "admin");
        using var overrideClientResponse = await fixture.Client.PostAsJsonAsync(
            "/api/admin/clients",
            ClientPayload($"override.{suffix}", overrideEmail, [secondCompanyId]));
        Assert.Equal(HttpStatusCode.Created, overrideClientResponse.StatusCode);
        var overrideClient = await overrideClientResponse.Content.ReadFromJsonAsync<JsonElement>();
        var overrideClientId = overrideClient.GetProperty("id").GetInt64();
        Assert.Equal(0, await CountInvitationsAsync(secondCompanyId, overrideEmail));

        var protectedProjectId = await InsertProjectAsync(secondCompanyId, overrideClientId, suffix);
        using var protectedRemoval = await fixture.Client.PutAsJsonAsync(
            $"/api/admin/clients/{overrideClientId}",
            ClientUpdatePayload(overrideEmail, [companyId]));
        Assert.Equal(HttpStatusCode.Conflict, protectedRemoval.StatusCode);

        await UnassignProjectAsync(protectedProjectId);
        using var membershipUpdate = await fixture.Client.PutAsJsonAsync(
            $"/api/admin/clients/{overrideClientId}",
            ClientUpdatePayload(overrideEmail, [companyId]));
        Assert.Equal(HttpStatusCode.OK, membershipUpdate.StatusCode);
        Assert.Equal(companyId, await ActiveCompanyIdAsync(overrideClientId));
    }

    private async Task<long> CreateCompanyAsync(string name)
    {
        using var response = await fixture.Client.PostAsJsonAsync("/api/admin/companies", new
        {
            name,
            legalName = $"{name}, Lda.",
            nif = Guid.NewGuid().ToString("N")[..9],
            email = $"{Guid.NewGuid():N}@example.test",
            phoneNumber = "210000000",
            address = "Portugal"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64();
    }

    private async Task<long> CreateEmployeeAsync(string username, long companyId, bool owner)
    {
        using var response = await fixture.Client.PostAsJsonAsync("/api/admin/employees", new
        {
            username,
            password = "secret",
            roleIds = new[] { 3L },
            companyId,
            displayName = owner ? "Owner" : "Employee",
            fullName = owner ? "Company Owner" : "Company Employee",
            nif = Guid.NewGuid().ToString("N")[..9],
            email = $"{username}@example.test",
            phoneNumber = "910000000",
            address = "Lisboa"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var employee = await response.Content.ReadFromJsonAsync<JsonElement>();
        var employeeId = employee.GetProperty("id").GetInt64();
        if (!owner) return employeeId;

        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE company_employees SET company_role = 'owner' WHERE employee_id = @employeeId; INSERT INTO user_roles (user_id, role_id) VALUES (@userId, 5) ON CONFLICT DO NOTHING;";
        command.Parameters.AddWithValue("employeeId", employeeId);
        command.Parameters.AddWithValue("userId", employee.GetProperty("userId").GetInt64());
        await command.ExecuteNonQueryAsync();
        return employeeId;
    }

    private static object ClientPayload(string username, string email, long[] companyIds) => new
    {
        username,
        password = "secret",
        companyIds,
        displayName = "Marta",
        fullName = "Marta Silva",
        nif = "123456789",
        email,
        phoneNumber = "930000000",
        address = "Lisboa"
    };

    private static object ClientUpdatePayload(string email, long[] companyIds) => new
    {
        companyIds,
        displayName = "Override client",
        fullName = "Override Client",
        nif = "123456789",
        email,
        phoneNumber = "930000000",
        address = "Lisboa"
    };

    private async Task BackdateInvitationAsync(long invitationId)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE client_invitations SET sent_at = now() - interval '72 hours' WHERE id = @id";
        command.Parameters.AddWithValue("id", invitationId);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<long> CountInvitationAsync(long invitationId)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM client_invitations WHERE id = @id";
        command.Parameters.AddWithValue("id", invitationId);
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private async Task<long> CountInvitationsAsync(long companyId, string email)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM client_invitations WHERE company_id = @companyId AND email = lower(trim(@email))";
        command.Parameters.AddWithValue("companyId", companyId);
        command.Parameters.AddWithValue("email", email);
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private async Task<long> InsertProjectAsync(long companyId, long clientId, string suffix)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO projects (company_id, client_id, title, code, address, is_archived, created_at, created_by, updated_at, updated_by) VALUES (@companyId, @clientId, 'Protected project', @code, '', false, now(), -999, now(), -999) RETURNING id";
        command.Parameters.AddWithValue("companyId", companyId);
        command.Parameters.AddWithValue("clientId", clientId);
        command.Parameters.AddWithValue("code", $"PROTECTED-{suffix[..8]}");
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private async Task UnassignProjectAsync(long projectId)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE projects SET client_id = NULL WHERE id = @projectId";
        command.Parameters.AddWithValue("projectId", projectId);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<long?> ActiveCompanyIdAsync(long clientId)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT active_company_id FROM clients WHERE id = @clientId";
        command.Parameters.AddWithValue("clientId", clientId);
        return (long?)await command.ExecuteScalarAsync();
    }

    private async Task MoveEmployeeAsync(long employeeId, long companyId)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE company_employees SET company_id = @companyId WHERE employee_id = @employeeId";
        command.Parameters.AddWithValue("companyId", companyId);
        command.Parameters.AddWithValue("employeeId", employeeId);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<string[]> LoadNotesAsync(long clientId)
    {
        var notes = new List<string>();
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT internal_notes FROM company_clients WHERE client_id = @clientId ORDER BY company_id";
        command.Parameters.AddWithValue("clientId", clientId);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync()) notes.Add(reader.GetString(0));
        return notes.ToArray();
    }

    private async Task LoginAsync(string username, string password = "secret")
    {
        using var response = await fixture.Client.PostAsJsonAsync("/api/auth/login", new { username, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
