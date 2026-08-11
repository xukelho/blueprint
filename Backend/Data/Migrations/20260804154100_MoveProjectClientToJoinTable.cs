using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MoveProjectClientToJoinTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "project_clients",
                columns: table => new
                {
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_project_clients", x => new { x.project_id, x.client_id });
                    table.ForeignKey(
                        name: "FK_project_clients_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_project_clients_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT INTO project_clients (project_id, client_id)
                SELECT id, client_id
                FROM projects
                WHERE client_id IS NOT NULL;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_projects_clients_client_id",
                table: "projects");

            migrationBuilder.DropIndex(
                name: "IX_projects_client_id",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "client_id",
                table: "projects");

            migrationBuilder.CreateIndex(
                name: "IX_project_clients_client_id",
                table: "project_clients",
                column: "client_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "client_id",
                table: "projects",
                type: "bigint",
                nullable: true);

            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM project_clients
                        GROUP BY project_id
                        HAVING COUNT(*) > 1
                    ) THEN
                        RAISE EXCEPTION 'Cannot restore projects.client_id because one or more projects have multiple clients.';
                    END IF;
                END $$;

                UPDATE projects AS project
                SET client_id = project_client.client_id
                FROM project_clients AS project_client
                WHERE project_client.project_id = project.id;
                """);

            migrationBuilder.DropTable(
                name: "project_clients");

            migrationBuilder.CreateIndex(
                name: "IX_projects_client_id",
                table: "projects",
                column: "client_id");

            migrationBuilder.AddForeignKey(
                name: "FK_projects_clients_client_id",
                table: "projects",
                column: "client_id",
                principalTable: "clients",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
