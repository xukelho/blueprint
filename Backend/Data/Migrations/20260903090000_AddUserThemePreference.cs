using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations;

[DbContext(typeof(BlueprintDbContext))]
[Migration("20260903090000_AddUserThemePreference")]
public partial class AddUserThemePreference : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "theme_preference",
            table: "users",
            type: "character varying(16)",
            maxLength: 16,
            nullable: false,
            defaultValue: UserThemePreferences.Light);

        migrationBuilder.AddCheckConstraint(
            name: "CK_users_theme_preference",
            table: "users",
            sql: "theme_preference IN ('light', 'dark', 'dynamic')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_users_theme_preference",
            table: "users");

        migrationBuilder.DropColumn(
            name: "theme_preference",
            table: "users");
    }

    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
    }
}
