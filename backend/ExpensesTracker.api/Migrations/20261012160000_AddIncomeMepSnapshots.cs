using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExpensesTracker.api.Migrations
{
    [Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(ExpensesTracker.api.Data.AppDbContext))]
    [Migration("20261012160000_AddIncomeMepSnapshots")]
    public partial class AddIncomeMepSnapshots : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(name: "usdmeprate", table: "incomes", type: "numeric", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "usdmepquotedat", table: "incomes", type: "timestamp without time zone", nullable: true);
            migrationBuilder.AddColumn<decimal>(name: "usdmepamount", table: "incomes", type: "numeric", nullable: true);
            migrationBuilder.AddColumn<string>(name: "usdmepsource", table: "incomes", type: "text", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "usdmeprate", table: "incomes");
            migrationBuilder.DropColumn(name: "usdmepquotedat", table: "incomes");
            migrationBuilder.DropColumn(name: "usdmepamount", table: "incomes");
            migrationBuilder.DropColumn(name: "usdmepsource", table: "incomes");
        }
    }
}
