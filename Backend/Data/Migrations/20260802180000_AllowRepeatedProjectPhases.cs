using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    [DbContext(typeof(BlueprintDbContext))]
    [Migration("20260802180000_AllowRepeatedProjectPhases")]
    public partial class AllowRepeatedProjectPhases : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_project_phases_project_id_phase_code",
                table: "project_phases");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_project_phases_project_id_phase_code",
                table: "project_phases",
                columns: new[] { "project_id", "phase_code" },
                unique: true);
        }

        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
            modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        }
    }
}
