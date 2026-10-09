using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectDocumentVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_visible",
                table: "project_documents",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Preserve access to every existing logical document, including pending
            // and deleted records. New inserts retain the false column default.
            migrationBuilder.Sql("UPDATE project_documents SET is_visible = TRUE;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_visible",
                table: "project_documents");
        }
    }
}
