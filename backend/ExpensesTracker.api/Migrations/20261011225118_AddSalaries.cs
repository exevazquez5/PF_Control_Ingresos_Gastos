using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ExpensesTracker.api.Migrations
{
    /// <inheritdoc />
    public partial class AddSalaries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "salaries",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    incomeid = table.Column<int>(type: "integer", nullable: false),
                    grossamount = table.Column<decimal>(type: "numeric", nullable: false),
                    netamount = table.Column<decimal>(type: "numeric", nullable: false),
                    date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    isdeleted = table.Column<bool>(type: "boolean", nullable: false),
                    deletedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_salaries", x => x.id);
                    table.ForeignKey(
                        name: "fk_salaries_incomes_incomeid",
                        column: x => x.incomeid,
                        principalTable: "incomes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_salaries_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "salarydeductions",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    salaryid = table.Column<int>(type: "integer", nullable: false),
                    expenseid = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_salarydeductions", x => x.id);
                    table.ForeignKey(
                        name: "fk_salarydeductions_expenses_expenseid",
                        column: x => x.expenseid,
                        principalTable: "expenses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_salarydeductions_salaries_salaryid",
                        column: x => x.salaryid,
                        principalTable: "salaries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_salaries_incomeid",
                table: "salaries",
                column: "incomeid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_salaries_userid_date",
                table: "salaries",
                columns: new[] { "userid", "date" });

            migrationBuilder.CreateIndex(
                name: "ix_salarydeductions_expenseid",
                table: "salarydeductions",
                column: "expenseid");

            migrationBuilder.CreateIndex(
                name: "ix_salarydeductions_salaryid_expenseid",
                table: "salarydeductions",
                columns: new[] { "salaryid", "expenseid" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "salarydeductions");

            migrationBuilder.DropTable(
                name: "salaries");
        }
    }
}
