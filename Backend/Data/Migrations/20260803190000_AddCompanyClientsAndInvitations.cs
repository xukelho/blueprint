using System;
using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Blueprint.Api.Data.Migrations
{
    [DbContext(typeof(BlueprintDbContext))]
    [Migration("20260803190000_AddCompanyClientsAndInvitations")]
    public partial class AddCompanyClientsAndInvitations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE clients SET email = lower(trim(email));");

            migrationBuilder.CreateTable(
                name: "client_invitations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_invitations", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_invitations_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "company_clients",
                columns: table => new
                {
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    internal_notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false, defaultValue: "")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_clients", x => new { x.company_id, x.client_id });
                    table.ForeignKey(
                        name: "FK_company_clients_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_company_clients_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql("""
                INSERT INTO company_clients (company_id, client_id, internal_notes)
                SELECT company_id, id, internal_notes
                FROM clients
                WHERE company_id IS NOT NULL;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_clients_companies_company_id",
                table: "clients");
            migrationBuilder.DropIndex(
                name: "IX_clients_company_id",
                table: "clients");
            migrationBuilder.RenameColumn(
                name: "company_id",
                table: "clients",
                newName: "active_company_id");
            migrationBuilder.DropColumn(
                name: "internal_notes",
                table: "clients");

            migrationBuilder.CreateIndex(
                name: "IX_client_invitations_company_id_email",
                table: "client_invitations",
                columns: new[] { "company_id", "email" },
                unique: true);
            migrationBuilder.CreateIndex(
                name: "IX_company_clients_client_id",
                table: "company_clients",
                column: "client_id");
            migrationBuilder.CreateIndex(
                name: "IX_clients_active_company_id",
                table: "clients",
                column: "active_company_id");
            migrationBuilder.CreateIndex(
                name: "IX_clients_email",
                table: "clients",
                column: "email",
                unique: true);
            migrationBuilder.AddForeignKey(
                name: "FK_clients_companies_active_company_id",
                table: "clients",
                column: "active_company_id",
                principalTable: "companies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_clients_companies_active_company_id",
                table: "clients");
            migrationBuilder.DropIndex(
                name: "IX_clients_active_company_id",
                table: "clients");
            migrationBuilder.DropIndex(
                name: "IX_clients_email",
                table: "clients");
            migrationBuilder.AddColumn<string>(
                name: "internal_notes",
                table: "clients",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");
            migrationBuilder.RenameColumn(
                name: "active_company_id",
                table: "clients",
                newName: "company_id");
            migrationBuilder.Sql("""
                UPDATE clients AS client
                SET internal_notes = membership.internal_notes
                FROM company_clients AS membership
                WHERE membership.client_id = client.id
                  AND membership.company_id = client.company_id;
                """);
            migrationBuilder.DropTable(name: "client_invitations");
            migrationBuilder.DropTable(name: "company_clients");
            migrationBuilder.CreateIndex(
                name: "IX_clients_company_id",
                table: "clients",
                column: "company_id");
            migrationBuilder.AddForeignKey(
                name: "FK_clients_companies_company_id",
                table: "clients",
                column: "company_id",
                principalTable: "companies",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
            modelBuilder.HasAnnotation("ProductVersion", "10.0.0");
        }
    }
}
