using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyMemberships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "deactivated_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "deactivated_by",
                table: "users",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AlterColumn<string>(
                name: "phone_number",
                table: "employees",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);

            migrationBuilder.AlterColumn<string>(
                name: "nif",
                table: "employees",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32);

            migrationBuilder.AlterColumn<string>(
                name: "email",
                table: "employees",
                type: "character varying(320)",
                maxLength: 320,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(320)",
                oldMaxLength: 320);

            migrationBuilder.AlterColumn<string>(
                name: "address",
                table: "employees",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024);

            migrationBuilder.CreateTable(
                name: "company_employees",
                columns: table => new
                {
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    employee_id = table.Column<long>(type: "bigint", nullable: false),
                    company_role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    is_architect = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_employees", x => new { x.company_id, x.employee_id });
                    table.ForeignKey(
                        name: "FK_company_employees_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_company_employees_employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employees",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Preserve the existing employee-to-company assignment while
            // moving it to the membership table. Architect used to be stored
            // as a global role (ID 4), which now becomes a membership flag.
            migrationBuilder.Sql(
                "INSERT INTO company_employees (company_id, employee_id, company_role, is_architect) " +
                "SELECT e.company_id, e.id, 'employee', EXISTS (" +
                "SELECT 1 FROM user_roles ur WHERE ur.user_id = e.user_id AND ur.role_id = 4) " +
                "FROM employees e;");
            migrationBuilder.Sql("DELETE FROM user_roles WHERE role_id = 4;");

            migrationBuilder.DropForeignKey(
                name: "FK_employees_companies_company_id",
                table: "employees");

            migrationBuilder.DropIndex(
                name: "IX_employees_company_id",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "company_id",
                table: "employees");

            migrationBuilder.CreateIndex(
                name: "IX_company_employees_employee_id",
                table: "company_employees",
                column: "employee_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "company_employees");

            migrationBuilder.DropColumn(
                name: "deactivated_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "deactivated_by",
                table: "users");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "users");

            migrationBuilder.AlterColumn<string>(
                name: "phone_number",
                table: "employees",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "nif",
                table: "employees",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "email",
                table: "employees",
                type: "character varying(320)",
                maxLength: 320,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(320)",
                oldMaxLength: 320,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "address",
                table: "employees",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(1024)",
                oldMaxLength: 1024,
                oldNullable: true);

            migrationBuilder.AddColumn<long>(
                name: "company_id",
                table: "employees",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_employees_company_id",
                table: "employees",
                column: "company_id");

            migrationBuilder.AddForeignKey(
                name: "FK_employees_companies_company_id",
                table: "employees",
                column: "company_id",
                principalTable: "companies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
