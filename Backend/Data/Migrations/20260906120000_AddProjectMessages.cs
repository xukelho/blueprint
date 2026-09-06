using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Blueprint.Api.Data.Migrations;

[DbContext(typeof(BlueprintDbContext))]
[Migration("20260906120000_AddProjectMessages")]
public partial class AddProjectMessages : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "project_messages",
            columns: table => new
            {
                id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                project_id = table.Column<long>(type: "bigint", nullable: false),
                author_user_id = table.Column<long>(type: "bigint", nullable: false),
                author_display_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_project_messages", x => x.id);
                table.ForeignKey("FK_project_messages_projects_project_id", x => x.project_id, "projects", "id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_project_messages_users_author_user_id", x => x.author_user_id, "users", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(name: "IX_project_messages_author_user_id", table: "project_messages", column: "author_user_id");
        migrationBuilder.CreateIndex(name: "IX_project_messages_project_id_id", table: "project_messages", columns: ["project_id", "id"]);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "project_messages");
}
