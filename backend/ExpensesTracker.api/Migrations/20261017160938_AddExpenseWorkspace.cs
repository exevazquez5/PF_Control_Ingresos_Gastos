using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ExpensesTracker.api.Migrations
{
    public partial class AddExpenseWorkspace : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sharedservices",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    provider = table.Column<string>(type: "text", nullable: false),
                    categoryid = table.Column<int>(type: "integer", nullable: false),
                    dueday = table.Column<int>(type: "integer", nullable: false),
                    isarchived = table.Column<bool>(type: "boolean", nullable: false),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table => table.PrimaryKey("pk_sharedservices", x => x.id));

            migrationBuilder.CreateTable(
                name: "taxobligations",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    period = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    duedate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    paidat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    expenseid = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_taxobligations", x => x.id);
                    table.ForeignKey("fk_taxobligations_expenses_expenseid", x => x.expenseid, "expenses", "id", onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "sharedservicebills",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    serviceid = table.Column<int>(type: "integer", nullable: false),
                    period = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    servicenamesnapshot = table.Column<string>(type: "text", nullable: false),
                    providersnapshot = table.Column<string>(type: "text", nullable: false),
                    grossamount = table.Column<decimal>(type: "numeric", nullable: false),
                    duedate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    paidat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    expenseid = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sharedservicebills", x => x.id);
                    table.ForeignKey("fk_sharedservicebills_expenses_expenseid", x => x.expenseid, "expenses", "id", onDelete: ReferentialAction.SetNull);
                    table.ForeignKey("fk_sharedservicebills_sharedservices_serviceid", x => x.serviceid, "sharedservices", "id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sharedserviceparticipants",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    serviceid = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    sharepercent = table.Column<decimal>(type: "numeric", nullable: false),
                    isowner = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sharedserviceparticipants", x => x.id);
                    table.ForeignKey("fk_sharedserviceparticipants_sharedservices_serviceid", x => x.serviceid, "sharedservices", "id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sharedservicebillshares",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    billid = table.Column<int>(type: "integer", nullable: false),
                    participantnamesnapshot = table.Column<string>(type: "text", nullable: false),
                    agreedamount = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sharedservicebillshares", x => x.id);
                    table.ForeignKey("fk_sharedservicebillshares_sharedservicebills_billid", x => x.billid, "sharedservicebills", "id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sharedservicereimbursements",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    billid = table.Column<int>(type: "integer", nullable: false),
                    participantname = table.Column<string>(type: "text", nullable: false),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sharedservicereimbursements", x => x.id);
                    table.ForeignKey("fk_sharedservicereimbursements_sharedservicebills_billid", x => x.billid, "sharedservicebills", "id", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex("ix_sharedservicebills_expenseid", "sharedservicebills", "expenseid");
            migrationBuilder.CreateIndex("ix_sharedservicebills_serviceid_period", "sharedservicebills", new[] { "serviceid", "period" }, unique: true);
            migrationBuilder.CreateIndex("ix_sharedservicebillshares_billid", "sharedservicebillshares", "billid");
            migrationBuilder.CreateIndex("ix_sharedserviceparticipants_serviceid", "sharedserviceparticipants", "serviceid");
            migrationBuilder.CreateIndex("ix_sharedservicereimbursements_billid", "sharedservicereimbursements", "billid");
            migrationBuilder.CreateIndex("ix_sharedservicereimbursements_userid_date", "sharedservicereimbursements", new[] { "userid", "date" });
            migrationBuilder.CreateIndex("ix_taxobligations_expenseid", "taxobligations", "expenseid");
            migrationBuilder.CreateIndex("ix_taxobligations_userid_type_period", "taxobligations", new[] { "userid", "type", "period" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable("sharedservicebillshares");
            migrationBuilder.DropTable("sharedserviceparticipants");
            migrationBuilder.DropTable("sharedservicereimbursements");
            migrationBuilder.DropTable("taxobligations");
            migrationBuilder.DropTable("sharedservicebills");
            migrationBuilder.DropTable("sharedservices");
        }
    }
}
