using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectTimelinePhases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "phase",
                table: "projects");

            migrationBuilder.CreateTable(
                name: "project_phases",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    phase_code = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    is_current = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_project_phases", x => x.id);
                    table.ForeignKey(
                        name: "FK_project_phases_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_project_phases_project_id",
                table: "project_phases",
                column: "project_id",
                unique: true,
                filter: "is_current");

            migrationBuilder.CreateIndex(
                name: "IX_project_phases_project_id_phase_code",
                table: "project_phases",
                columns: new[] { "project_id", "phase_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_project_phases_project_id_position",
                table: "project_phases",
                columns: new[] { "project_id", "position" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_phases");

            migrationBuilder.AddColumn<string>(
                name: "phase",
                table: "projects",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");
        }
    }
}
