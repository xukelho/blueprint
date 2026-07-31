using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations;

public partial class AddCompanyOwnerRole : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "INSERT INTO roles (id, name) VALUES (5, 'company owner') ON CONFLICT DO NOTHING;");
        // Existing employee accounts previously had company-settings access. Preserve it.
        migrationBuilder.Sql("UPDATE company_employees SET company_role = 'owner' WHERE company_role = 'employee';");
        migrationBuilder.Sql("INSERT INTO user_roles (user_id, role_id) SELECT e.user_id, 5 FROM company_employees ce JOIN employees e ON e.id = ce.employee_id ON CONFLICT DO NOTHING;");
    }
    protected override void Down(MigrationBuilder migrationBuilder) => throw new NotSupportedException();
}
