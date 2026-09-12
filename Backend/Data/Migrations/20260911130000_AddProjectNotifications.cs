using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Blueprint.Api.Data.Migrations;

[DbContext(typeof(BlueprintDbContext))]
[Migration("20260911130000_AddProjectNotifications")]
public partial class AddProjectNotifications : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "project_events",
            columns: table => new
            {
                id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                project_id = table.Column<long>(type: "bigint", nullable: false),
                actor_user_id = table.Column<long>(type: "bigint", nullable: false),
                actor_display_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                project_title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                type = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                summary = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                template_version = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                target_kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                document_id = table.Column<Guid>(type: "uuid", nullable: true),
                conversation_id = table.Column<long>(type: "bigint", nullable: true),
                message_id = table.Column<long>(type: "bigint", nullable: true),
                context_json = table.Column<string>(type: "jsonb", nullable: false),
                deduplication_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_project_events", x => x.id);
                table.ForeignKey(
                    name: "FK_project_events_projects_project_id",
                    column: x => x.project_id,
                    principalTable: "projects",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "user_notifications",
            columns: table => new
            {
                id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                project_event_id = table.Column<long>(type: "bigint", nullable: false),
                recipient_user_id = table.Column<long>(type: "bigint", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_user_notifications", x => x.id);
                table.ForeignKey(
                    name: "FK_user_notifications_project_events_project_event_id",
                    column: x => x.project_event_id,
                    principalTable: "project_events",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_user_notifications_users_recipient_user_id",
                    column: x => x.recipient_user_id,
                    principalTable: "users",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(name: "IX_project_events_deduplication_key", table: "project_events", column: "deduplication_key", unique: true);
        migrationBuilder.CreateIndex(name: "IX_project_events_project_id_id", table: "project_events", columns: new[] { "project_id", "id" });
        migrationBuilder.CreateIndex(name: "IX_user_notifications_project_event_id_recipient_user_id", table: "user_notifications", columns: new[] { "project_event_id", "recipient_user_id" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_user_notifications_recipient_user_id_read_at_id", table: "user_notifications", columns: new[] { "recipient_user_id", "read_at", "id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "user_notifications");
        migrationBuilder.DropTable(name: "project_events");
    }
}
