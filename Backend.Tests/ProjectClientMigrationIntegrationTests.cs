using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class ProjectClientMigrationIntegrationTests
{
    [Fact]
    public async Task MigrationBackfillsExistingAssignmentsBeforeRemovingProjectClientId()
    {
        var adminConnectionString =
            Environment.GetEnvironmentVariable("BLUEPRINT_TEST_ADMIN_CONNECTION")
            ?? "Host=localhost;Port=5837;Database=postgres;Username=blueprint;Password=blueprint_dev_password";
        var databaseName = $"blueprint_migration_test_{Guid.NewGuid():N}";
        var databaseConnectionString = new NpgsqlConnectionStringBuilder(adminConnectionString)
        {
            Database = databaseName,
            Pooling = false
        }.ConnectionString;

        await using (var adminConnection = new NpgsqlConnection(adminConnectionString))
        {
            await adminConnection.OpenAsync();
            await using var createDatabase = adminConnection.CreateCommand();
            createDatabase.CommandText = $"CREATE DATABASE \"{databaseName}\"";
            await createDatabase.ExecuteNonQueryAsync();
        }

        try
        {
            var options = new DbContextOptionsBuilder<BlueprintDbContext>()
                .UseNpgsql(databaseConnectionString)
                .Options;
            await using var db = new BlueprintDbContext(options);
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync("20260804113502_RemoveClientActiveCompany");

            await using var connection = new NpgsqlConnection(databaseConnectionString);
            await connection.OpenAsync();
            var companyId = await InsertCompany(connection);
            var userId = await InsertUser(connection);
            var clientId = await InsertClient(connection, userId);
            var assignedProjectId = await InsertProject(connection, companyId, clientId, "MIGRATION-ASSIGNED");
            var unassignedProjectId = await InsertProject(connection, companyId, null, "MIGRATION-UNASSIGNED");

            await migrator.MigrateAsync();

            await using var assertion = connection.CreateCommand();
            assertion.CommandText = """
                SELECT
                    NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'client_id'
                    ),
                    EXISTS (
                        SELECT 1 FROM project_clients
                        WHERE project_id = @assignedProjectId AND client_id = @clientId
                    ),
                    NOT EXISTS (
                        SELECT 1 FROM project_clients
                        WHERE project_id = @unassignedProjectId
                    );
                """;
            assertion.Parameters.AddWithValue("assignedProjectId", assignedProjectId);
            assertion.Parameters.AddWithValue("clientId", clientId);
            assertion.Parameters.AddWithValue("unassignedProjectId", unassignedProjectId);
            await using var reader = await assertion.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.True(reader.GetBoolean(0));
            Assert.True(reader.GetBoolean(1));
            Assert.True(reader.GetBoolean(2));
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await using var adminConnection = new NpgsqlConnection(adminConnectionString);
            await adminConnection.OpenAsync();
            await using var terminateConnections = adminConnection.CreateCommand();
            terminateConnections.CommandText = """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = @databaseName
                  AND pid <> pg_backend_pid();
                """;
            terminateConnections.Parameters.AddWithValue("databaseName", databaseName);
            await terminateConnections.ExecuteNonQueryAsync();
            await using var dropDatabase = adminConnection.CreateCommand();
            dropDatabase.CommandText = $"DROP DATABASE IF EXISTS \"{databaseName}\"";
            await dropDatabase.ExecuteNonQueryAsync();
        }
    }

    private static async Task<long> InsertCompany(NpgsqlConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO companies (name, legal_name, nif, email, phone_number, address, is_active, created_at, created_by, updated_at, updated_by)
            VALUES ('Migration company', 'Migration company, Lda.', '501000000', 'migration.company@example.test', '210000000', 'Lisboa', true, now(), -1, now(), -1)
            RETURNING id;
            """;
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<long> InsertUser(NpgsqlConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO users (username, password, is_active, created_at, created_by, updated_at, updated_by)
            VALUES ('migration.client', 'not-used', true, now(), -1, now(), -1)
            RETURNING id;
            """;
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<long> InsertClient(NpgsqlConnection connection, long userId)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO clients (user_id, display_name, full_name, nif, email, phone_number, address)
            VALUES (@userId, 'Migration client', 'Migration Client', '201000000', 'migration.client@example.test', '910000000', 'Lisboa')
            RETURNING id;
            """;
        command.Parameters.AddWithValue("userId", userId);
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<long> InsertProject(NpgsqlConnection connection, long companyId, long? clientId, string code)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO projects (company_id, client_id, title, code, address, is_archived, created_at, created_by, updated_at, updated_by)
            VALUES (@companyId, @clientId, @code, @code, 'Lisboa', false, now(), -1, now(), -1)
            RETURNING id;
            """;
        command.Parameters.AddWithValue("companyId", companyId);
        command.Parameters.AddWithValue("clientId", clientId is null ? DBNull.Value : clientId.Value);
        command.Parameters.AddWithValue("code", code);
        return (long)(await command.ExecuteScalarAsync())!;
    }
}
