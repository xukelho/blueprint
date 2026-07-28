using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Blueprint.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRolesAndProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "role_id",
                table: "users",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "architects",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    display_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    full_name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    nif = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    address = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_architects", x => x.id);
                    table.ForeignKey(
                        name: "FK_architects_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "clients",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    display_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    full_name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    nif = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    address = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clients", x => x.id);
                    table.ForeignKey(
                        name: "FK_clients_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    display_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    full_name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    nif = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    address = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_companies", x => x.id);
                    table.ForeignKey(
                        name: "FK_companies_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    role = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "user_roles",
                columns: new[] { "id", "role" },
                values: new object[,]
                {
                    { 1L, "platform admin" },
                    { 2L, "client" },
                    { 3L, "company" },
                    { 4L, "architect" }
                });

            migrationBuilder.Sql(
                """
                UPDATE users
                SET role_id = 1
                WHERE role_id IS NULL;
                """);

            migrationBuilder.AlterColumn<long>(
                name: "role_id",
                table: "users",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_role_id",
                table: "users",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "IX_architects_user_id",
                table: "architects",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_clients_user_id",
                table: "clients",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_companies_user_id",
                table: "companies",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_role",
                table: "user_roles",
                column: "role",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_users_user_roles_role_id",
                table: "users",
                column: "role_id",
                principalTable: "user_roles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_users_user_roles_role_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "architects");

            migrationBuilder.DropTable(
                name: "clients");

            migrationBuilder.DropTable(
                name: "companies");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropIndex(
                name: "IX_users_role_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "role_id",
                table: "users");
        }
    }
}
