using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExpensesTracker.api.Migrations
{
    /// <inheritdoc />
    public partial class AddGrossAmountAndIsRecurring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "grossamount",
                table: "incomes",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "isrecurring",
                table: "incomes",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "grossamount",
                table: "incomes");

            migrationBuilder.DropColumn(
                name: "isrecurring",
                table: "incomes");
        }
    }
}
