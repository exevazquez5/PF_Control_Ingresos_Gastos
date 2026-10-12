using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ExpensesTracker.api.Migrations
{
    /// <inheritdoc />
    public partial class AddIncomeSourcesDiscountRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "mode",
                table: "incomes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "sourceid",
                table: "incomes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "islabor",
                table: "categories",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "incomesources",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    mode = table.Column<string>(type: "text", nullable: false),
                    isarchived = table.Column<bool>(type: "boolean", nullable: false),
                    archivedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_incomesources", x => x.id);
                    table.ForeignKey(
                        name: "fk_incomesources_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "discountrules",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    incomesourceid = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    percentage = table.Column<decimal>(type: "numeric", nullable: true),
                    fixedamount = table.Column<decimal>(type: "numeric", nullable: true),
                    isexpected = table.Column<bool>(type: "boolean", nullable: false),
                    isarchived = table.Column<bool>(type: "boolean", nullable: false),
                    archivedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_discountrules", x => x.id);
                    table.ForeignKey(
                        name: "fk_discountrules_incomesources_incomesourceid",
                        column: x => x.incomesourceid,
                        principalTable: "incomesources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_discountrules_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "incomesourcealiases",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    incomesourceid = table.Column<int>(type: "integer", nullable: false),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_incomesourcealiases", x => x.id);
                    table.ForeignKey(
                        name: "fk_incomesourcealiases_incomesources_incomesourceid",
                        column: x => x.incomesourceid,
                        principalTable: "incomesources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_incomesourcealiases_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_incomes_sourceid",
                table: "incomes",
                column: "sourceid");

            migrationBuilder.CreateIndex(
                name: "ix_discountrules_incomesourceid_name",
                table: "discountrules",
                columns: new[] { "incomesourceid", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_discountrules_userid",
                table: "discountrules",
                column: "userid");

            migrationBuilder.CreateIndex(
                name: "ix_incomesourcealiases_incomesourceid",
                table: "incomesourcealiases",
                column: "incomesourceid");

            migrationBuilder.CreateIndex(
                name: "ix_incomesourcealiases_userid_name",
                table: "incomesourcealiases",
                columns: new[] { "userid", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_incomesources_userid_name",
                table: "incomesources",
                columns: new[] { "userid", "name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_incomes_incomesources_sourceid",
                table: "incomes",
                column: "sourceid",
                principalTable: "incomesources",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            // Datos: marcar categorías de ingreso con naturaleza laboral (reemplaza la heurística de nombres)
            migrationBuilder.Sql(
                "UPDATE categories SET isLabor = TRUE WHERE type = 'ingreso' AND name IN ('Salario', 'Freelance');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_incomes_incomesources_sourceid",
                table: "incomes");

            migrationBuilder.DropTable(
                name: "discountrules");

            migrationBuilder.DropTable(
                name: "incomesourcealiases");

            migrationBuilder.DropTable(
                name: "incomesources");

            migrationBuilder.DropIndex(
                name: "ix_incomes_sourceid",
                table: "incomes");

            migrationBuilder.DropColumn(
                name: "mode",
                table: "incomes");

            migrationBuilder.DropColumn(
                name: "sourceid",
                table: "incomes");

            migrationBuilder.DropColumn(
                name: "islabor",
                table: "categories");
        }
    }
}
