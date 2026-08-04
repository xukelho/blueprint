using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveClientActiveCompany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_clients_companies_active_company_id",
                table: "clients");

            migrationBuilder.DropIndex(
                name: "IX_clients_active_company_id",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "active_company_id",
                table: "clients");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "active_company_id",
                table: "clients",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_clients_active_company_id",
                table: "clients",
                column: "active_company_id");

            migrationBuilder.AddForeignKey(
                name: "FK_clients_companies_active_company_id",
                table: "clients",
                column: "active_company_id",
                principalTable: "companies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
