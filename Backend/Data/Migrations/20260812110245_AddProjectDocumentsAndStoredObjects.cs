using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectDocumentsAndStoredObjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_project_phases_project_id_id",
                table: "project_phases",
                columns: new[] { "project_id", "id" });

            migrationBuilder.CreateTable(
                name: "stored_objects",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    object_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    file_name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    content_type = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    expected_length = table.Column<long>(type: "bigint", nullable: false),
                    verified_length = table.Column<long>(type: "bigint", nullable: true),
                    etag = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    upload_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    uploaded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    deletion_requested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    maintenance_attempts = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    retry_after = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_storage_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<long>(type: "bigint", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stored_objects", x => x.id);
                    table.UniqueConstraint("AK_stored_objects_project_id_id", x => new { x.project_id, x.id });
                    table.CheckConstraint("CK_stored_objects_expected_length", "expected_length >= 0");
                    table.ForeignKey(
                        name: "FK_stored_objects_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "project_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    phase_id = table.Column<long>(type: "bigint", nullable: false),
                    stored_object_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<long>(type: "bigint", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<long>(type: "bigint", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_project_documents", x => x.id);
                    table.ForeignKey(
                        name: "FK_project_documents_project_phases_project_id_phase_id",
                        columns: x => new { x.project_id, x.phase_id },
                        principalTable: "project_phases",
                        principalColumns: new[] { "project_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_project_documents_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_project_documents_stored_objects_project_id_stored_object_id",
                        columns: x => new { x.project_id, x.stored_object_id },
                        principalTable: "stored_objects",
                        principalColumns: new[] { "project_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_project_documents_project_id_phase_id",
                table: "project_documents",
                columns: new[] { "project_id", "phase_id" });

            migrationBuilder.CreateIndex(
                name: "IX_project_documents_project_id_stored_object_id",
                table: "project_documents",
                columns: new[] { "project_id", "stored_object_id" });

            migrationBuilder.CreateIndex(
                name: "IX_project_documents_stored_object_id",
                table: "project_documents",
                column: "stored_object_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stored_objects_object_key",
                table: "stored_objects",
                column: "object_key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_documents");

            migrationBuilder.DropTable(
                name: "stored_objects");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_project_phases_project_id_id",
                table: "project_phases");
        }
    }
}
