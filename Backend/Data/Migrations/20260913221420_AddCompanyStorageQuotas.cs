using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyStorageQuotas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "quota_charge_bytes",
                table: "stored_objects",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.Sql("""
                UPDATE stored_objects
                SET quota_charge_bytes = CASE
                    WHEN status = 'Deleted' THEN 0
                    ELSE COALESCE(verified_length, expected_length)
                END;
                """);

            migrationBuilder.AlterColumn<long>(
                name: "project_id",
                table: "project_events",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<long>(
                name: "company_id",
                table: "project_events",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "scope",
                table: "project_events",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "company_storage_allocations",
                columns: table => new
                {
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    admin_extra_bytes = table.Column<long>(type: "bigint", nullable: false),
                    purchased_extra_bytes = table.Column<long>(type: "bigint", nullable: false),
                    warning_level = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_storage_allocations", x => x.company_id);
                    table.CheckConstraint("CK_company_storage_admin_extra", "admin_extra_bytes >= 0 AND admin_extra_bytes % 100000000 = 0");
                    table.CheckConstraint("CK_company_storage_purchased_extra", "purchased_extra_bytes >= 0");
                    table.CheckConstraint("CK_company_storage_warning_level", "warning_level IN (0, 80, 90, 100)");
                    table.ForeignKey(
                        name: "FK_company_storage_allocations_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "storage_configuration",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    base_limit_bytes = table.Column<long>(type: "bigint", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storage_configuration", x => x.id);
                    table.CheckConstraint("CK_storage_configuration_base_limit", "base_limit_bytes >= 0 AND base_limit_bytes % 100000000 = 0");
                    table.CheckConstraint("CK_storage_configuration_singleton", "id = 1");
                });

            migrationBuilder.Sql("""
                INSERT INTO storage_configuration (id, base_limit_bytes, updated_at, updated_by)
                VALUES (1, 5000000000, NOW(), 0);

                INSERT INTO company_storage_allocations
                    (company_id, admin_extra_bytes, purchased_extra_bytes, warning_level, updated_at, updated_by)
                SELECT id, 0, 0, 0, NOW(), 0 FROM companies;

                UPDATE project_events AS event
                SET company_id = project.company_id, scope = 'project'
                FROM projects AS project
                WHERE event.project_id = project.id;
                """);

            migrationBuilder.AlterColumn<long>(
                name: "company_id",
                table: "project_events",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "scope",
                table: "project_events",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_project_events_company_id_id",
                table: "project_events",
                columns: new[] { "company_id", "id" });

            migrationBuilder.AddForeignKey(
                name: "FK_project_events_companies_company_id",
                table: "project_events",
                column: "company_id",
                principalTable: "companies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM project_events WHERE scope = 'company';");

            migrationBuilder.DropForeignKey(
                name: "FK_project_events_companies_company_id",
                table: "project_events");

            migrationBuilder.DropTable(
                name: "company_storage_allocations");

            migrationBuilder.DropTable(
                name: "storage_configuration");

            migrationBuilder.DropIndex(
                name: "IX_project_events_company_id_id",
                table: "project_events");

            migrationBuilder.DropColumn(
                name: "quota_charge_bytes",
                table: "stored_objects");

            migrationBuilder.DropColumn(
                name: "company_id",
                table: "project_events");

            migrationBuilder.DropColumn(
                name: "scope",
                table: "project_events");

            migrationBuilder.AlterColumn<long>(
                name: "project_id",
                table: "project_events",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
