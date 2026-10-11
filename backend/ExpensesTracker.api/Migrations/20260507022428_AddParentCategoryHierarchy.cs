using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ExpensesTracker.api.Migrations
{
    /// <inheritdoc />
    public partial class AddParentCategoryHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "passwordresettokens",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    token = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    expiration = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_passwordresettokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    username = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    passwordhash = table.Column<byte[]>(type: "bytea", nullable: false),
                    passwordsalt = table.Column<byte[]>(type: "bytea", nullable: false),
                    role = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "budgets",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    periodstart = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    periodend = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    period = table.Column<string>(type: "text", nullable: false),
                    totalamount = table.Column<decimal>(type: "numeric", nullable: false),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    updatedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    isdeleted = table.Column<bool>(type: "boolean", nullable: false),
                    deletedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_budgets", x => x.id);
                    table.ForeignKey(
                        name: "fk_budgets_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "text", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    issystem = table.Column<bool>(type: "boolean", nullable: false),
                    userid = table.Column<int>(type: "integer", nullable: true),
                    parentcategoryid = table.Column<int>(type: "integer", nullable: true),
                    icon = table.Column<string>(type: "text", nullable: true),
                    color = table.Column<string>(type: "text", nullable: true),
                    isarchived = table.Column<bool>(type: "boolean", nullable: false),
                    archivedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => x.id);
                    table.ForeignKey(
                        name: "fk_categories_categories_parentcategoryid",
                        column: x => x.parentcategoryid,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_categories_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "creditcards",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: true),
                    closingday = table.Column<int>(type: "integer", nullable: false),
                    dueday = table.Column<int>(type: "integer", nullable: false),
                    isdeleted = table.Column<bool>(type: "boolean", nullable: false),
                    deletedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_creditcards", x => x.id);
                    table.ForeignKey(
                        name: "fk_creditcards_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "budgetcategories",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    budgetid = table.Column<int>(type: "integer", nullable: false),
                    categoryid = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    alertthreshold = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_budgetcategories", x => x.id);
                    table.ForeignKey(
                        name: "fk_budgetcategories_budgets_budgetid",
                        column: x => x.budgetid,
                        principalTable: "budgets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_budgetcategories_categories_categoryid",
                        column: x => x.categoryid,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "incomes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    categoryid = table.Column<int>(type: "integer", nullable: false),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    isdeleted = table.Column<bool>(type: "boolean", nullable: false),
                    deletedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    deletedbyuserid = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_incomes", x => x.id);
                    table.ForeignKey(
                        name: "fk_incomes_categories_categoryid",
                        column: x => x.categoryid,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_incomes_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "expenses",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    amount = table.Column<decimal>(type: "numeric", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    categoryid = table.Column<int>(type: "integer", nullable: false),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    creditcardid = table.Column<int>(type: "integer", nullable: true),
                    fundingsource = table.Column<int>(type: "integer", nullable: false),
                    isdeleted = table.Column<bool>(type: "boolean", nullable: false),
                    deletedat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    deletedbyuserid = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_expenses", x => x.id);
                    table.ForeignKey(
                        name: "fk_expenses_categories_categoryid",
                        column: x => x.categoryid,
                        principalTable: "categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_expenses_creditcards_creditcardid",
                        column: x => x.creditcardid,
                        principalTable: "creditcards",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_expenses_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pagoscuotas",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    expenseid = table.Column<int>(type: "integer", nullable: false),
                    nrocuota = table.Column<int>(type: "integer", nullable: false),
                    montocuota = table.Column<decimal>(type: "numeric", nullable: false),
                    duedate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    paidat = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pagoscuotas", x => x.id);
                    table.ForeignKey(
                        name: "fk_pagoscuotas_expenses_expenseid",
                        column: x => x.expenseid,
                        principalTable: "expenses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_budgetcategories_budgetid_categoryid",
                table: "budgetcategories",
                columns: new[] { "budgetid", "categoryid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_budgetcategories_categoryid",
                table: "budgetcategories",
                column: "categoryid");

            migrationBuilder.CreateIndex(
                name: "ix_budgets_userid_period",
                table: "budgets",
                columns: new[] { "userid", "period" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_budgets_userid_periodstart",
                table: "budgets",
                columns: new[] { "userid", "periodstart" });

            migrationBuilder.CreateIndex(
                name: "ix_categories_parentcategoryid",
                table: "categories",
                column: "parentcategoryid");

            migrationBuilder.CreateIndex(
                name: "ix_categories_userid_name",
                table: "categories",
                columns: new[] { "userid", "name" },
                unique: true,
                filter: "userid IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_creditcards_userid",
                table: "creditcards",
                column: "userid");

            migrationBuilder.CreateIndex(
                name: "ix_expenses_categoryid",
                table: "expenses",
                column: "categoryid");

            migrationBuilder.CreateIndex(
                name: "ix_expenses_creditcardid",
                table: "expenses",
                column: "creditcardid");

            migrationBuilder.CreateIndex(
                name: "ix_expenses_userid",
                table: "expenses",
                column: "userid");

            migrationBuilder.CreateIndex(
                name: "ix_incomes_categoryid",
                table: "incomes",
                column: "categoryid");

            migrationBuilder.CreateIndex(
                name: "ix_incomes_userid",
                table: "incomes",
                column: "userid");

            migrationBuilder.CreateIndex(
                name: "ix_pagoscuotas_expenseid",
                table: "pagoscuotas",
                column: "expenseid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "budgetcategories");

            migrationBuilder.DropTable(
                name: "incomes");

            migrationBuilder.DropTable(
                name: "pagoscuotas");

            migrationBuilder.DropTable(
                name: "passwordresettokens");

            migrationBuilder.DropTable(
                name: "budgets");

            migrationBuilder.DropTable(
                name: "expenses");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "creditcards");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
