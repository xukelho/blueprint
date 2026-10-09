using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class ProjectDocumentVisibilityMigrationIntegrationTests
{
    [Fact]
    public async Task MigrationPreservesEveryExistingLifecycleStateAndLeavesFalseDefaultWithoutSideEffects()
    {
        var admin = Environment.GetEnvironmentVariable("BLUEPRINT_TEST_ADMIN_CONNECTION")
            ?? "Host=localhost;Port=5837;Database=postgres;Username=blueprint;Password=blueprint_dev_password";
        var name = $"blueprint_visibility_migration_{Guid.NewGuid():N}";
        var connectionString = new NpgsqlConnectionStringBuilder(admin) { Database = name, Pooling = false }.ConnectionString;
        await using (var connection = new NpgsqlConnection(admin))
        {
            await connection.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", connection);
            await create.ExecuteNonQueryAsync();
        }
        try
        {
            await using var db = new BlueprintDbContext(new DbContextOptionsBuilder<BlueprintDbContext>().UseNpgsql(connectionString).Options);
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync("20260913221420_AddCompanyStorageQuotas");
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync();
            await using (var seed = connection.CreateCommand())
            {
                seed.CommandText = """
                    INSERT INTO companies (id,name,legal_name,nif,email,phone_number,address,is_active,created_at,created_by,updated_at,updated_by)
                    VALUES (901,'Migration','Migration','901','migration@example.test','1','Lisboa',true,'2026-01-01Z',1,'2026-01-01Z',1);
                    INSERT INTO projects (id,company_id,title,code,address,is_archived,created_at,created_by,updated_at,updated_by)
                    VALUES (901,901,'Migration','MIG-V','Lisboa',false,'2026-01-01Z',1,'2026-01-01Z',1);
                    INSERT INTO project_phases (id,project_id,phase_code,position) VALUES (901,901,'feasibility-studies',0);
                    INSERT INTO stored_objects (id,project_id,object_key,file_name,content_type,expected_length,verified_length,quota_charge_bytes,status,upload_expires_at,created_at,created_by,updated_at,updated_by)
                    SELECT ('00000000-0000-0000-0000-00000000000' || n)::uuid,901,'migration/' || n,'file.bin','application/octet-stream',42,42,42,status,'2027-01-01Z','2026-01-01Z',1,'2026-01-01Z',1
                    FROM (VALUES (1,'Available'),(2,'PendingUpload'),(3,'Deleted')) s(n,status);
                    INSERT INTO project_documents (id,project_id,phase_id,stored_object_id,is_deleted,created_at,created_by,updated_at,updated_by)
                    SELECT id,901,901,id,status='Deleted','2026-01-01Z',1,'2026-01-01Z',1 FROM stored_objects;
                    """;
                await seed.ExecuteNonQueryAsync();
            }
            await migrator.MigrateAsync();
            var documents = await db.ProjectDocuments.AsNoTracking().ToArrayAsync();
            Assert.Equal(3, documents.Length);
            Assert.All(documents, d =>
            {
                Assert.True(d.IsVisible);
                Assert.Equal(DateTimeOffset.Parse("2026-01-01T00:00:00Z"), d.UpdatedAt);
                Assert.Equal(1, d.UpdatedBy);
            });
            Assert.Single(documents, d => d.IsDeleted);
            Assert.Empty(await db.ProjectEvents.ToArrayAsync());
            Assert.Empty(await db.UserNotifications.ToArrayAsync());
            Assert.All(await db.StoredObjects.AsNoTracking().ToArrayAsync(), o => Assert.Equal(42, o.QuotaChargeBytes));
            await using (var insert = connection.CreateCommand())
            {
                insert.CommandText = """
                    INSERT INTO stored_objects (id,project_id,object_key,file_name,content_type,expected_length,quota_charge_bytes,status,upload_expires_at,created_at,created_by,updated_at,updated_by)
                    VALUES ('00000000-0000-0000-0000-000000000004',901,'migration/new','new.bin','application/octet-stream',1,1,'PendingUpload',now(),now(),1,now(),1);
                    INSERT INTO project_documents (id,project_id,phase_id,stored_object_id,created_at,created_by,updated_at,updated_by)
                    VALUES ('00000000-0000-0000-0000-000000000004',901,901,'00000000-0000-0000-0000-000000000004',now(),1,now(),1);
                    """;
                await insert.ExecuteNonQueryAsync();
            }
            Assert.False((await db.ProjectDocuments.AsNoTracking().SingleAsync(d => d.Id == Guid.Parse("00000000-0000-0000-0000-000000000004"))).IsVisible);
            await migrator.MigrateAsync("20260913221420_AddCompanyStorageQuotas");
            await using var columns = new NpgsqlCommand("SELECT count(*) FROM information_schema.columns WHERE table_name='project_documents' AND column_name='is_visible'", connection);
            Assert.Equal(0L, await columns.ExecuteScalarAsync());
        }
        finally
        {
            await using var connection = new NpgsqlConnection(admin);
            await connection.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
