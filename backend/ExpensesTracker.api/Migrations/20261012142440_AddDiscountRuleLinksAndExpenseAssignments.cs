using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ExpensesTracker.api.Migrations
{
    /// <inheritdoc />
    public partial class AddDiscountRuleLinksAndExpenseAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "linkedcategoryid",
                table: "discountrules",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "linkeddescription",
                table: "discountrules",
                type: "text",
                nullable: true);

            // Vigencia de la regla (Fase 3.5a). Prod tiene 0 reglas: el default solo
            // aplica a entornos con datos, y se corrige al mes de creación más abajo.
            migrationBuilder.AddColumn<DateTime>(
                name: "validfrom",
                table: "discountrules",
                type: "timestamp without time zone",
                nullable: false,
                defaultValue: new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "validto",
                table: "discountrules",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "expenseruleassignments",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    userid = table.Column<int>(type: "integer", nullable: false),
                    ruleid = table.Column<int>(type: "integer", nullable: false),
                    expenseid = table.Column<int>(type: "integer", nullable: false),
                    pagocuotaid = table.Column<int>(type: "integer", nullable: true),
                    year = table.Column<int>(type: "integer", nullable: false),
                    month = table.Column<int>(type: "integer", nullable: false),
                    createdat = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_expenseruleassignments", x => x.id);
                    table.ForeignKey(
                        name: "fk_expenseruleassignments_discountrules_ruleid",
                        column: x => x.ruleid,
                        principalTable: "discountrules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_expenseruleassignments_expenses_expenseid",
                        column: x => x.expenseid,
                        principalTable: "expenses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_expenseruleassignments_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_discountrules_linkedcategoryid",
                table: "discountrules",
                column: "linkedcategoryid");

            migrationBuilder.CreateIndex(
                name: "ix_expenseruleassignments_expenseid",
                table: "expenseruleassignments",
                column: "expenseid",
                unique: true,
                filter: "pagocuotaid IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_expenseruleassignments_pagocuotaid",
                table: "expenseruleassignments",
                column: "pagocuotaid",
                unique: true,
                filter: "pagocuotaid IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_expenseruleassignments_ruleid_year_month",
                table: "expenseruleassignments",
                columns: new[] { "ruleid", "year", "month" });

            migrationBuilder.CreateIndex(
                name: "ix_expenseruleassignments_userid",
                table: "expenseruleassignments",
                column: "userid");

            migrationBuilder.AddForeignKey(
                name: "fk_discountrules_categories_linkedcategoryid",
                table: "discountrules",
                column: "linkedcategoryid",
                principalTable: "categories",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // ── Data-fix Fase 3.5a ──────────────────────────────────────────
            // 1) Corrección de modo bruto (guarda): los ingresos en modo Bruto NO
            //    tienen bruto del recibo; lo depositado ES el bruto.
            //    - gross == amount → se limpia grossamount (sigue en modo bruto).
            //    - gross > amount  → eran depósitos con bruto → pasan a modo neto
            //      conservando el gross (input colapsado de un recibo laboral).
            //    Antes de tocar nada se deja una copia persistente en
            //    incomes_modo_bruto_fix_backup para un Down() real.
            // 2) Data-fix puntual del legado (era "Sueldos"): Bonificacion y
            //    Comisiones eran categorías de ingreso con naturaleza laboral
            //    detectada por heurística de nombres; al eliminar la heurística
            //    se fija islabor directamente (no es regla de producto).
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS incomes_modo_bruto_fix_backup (
                    incomeid integer NOT NULL PRIMARY KEY,
                    grossamount numeric NOT NULL,
                    mode text NOT NULL
                );
                INSERT INTO incomes_modo_bruto_fix_backup (incomeid, grossamount, mode)
                SELECT id, grossamount, mode FROM incomes
                WHERE mode = 'bruto' AND grossamount IS NOT NULL;

                UPDATE incomes
                SET grossamount = NULL
                WHERE mode = 'bruto' AND grossamount IS NOT NULL AND grossamount = amount;

                UPDATE incomes
                SET mode = 'neto'
                WHERE mode = 'bruto' AND grossamount IS NOT NULL AND grossamount > amount;

                UPDATE categories
                SET islabor = true
                WHERE issystem = true AND name IN ('Bonificacion', 'Comisiones');

                -- Vigencia: las reglas preexistentes arrancan el primer día de su mes de creación.
                UPDATE discountrules
                SET validfrom = date_trunc('month', createdat);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverse del data-fix usando la copia persistente, antes de tocar el esquema.
            migrationBuilder.Sql(@"
                UPDATE incomes
                SET grossamount = b.grossamount, mode = b.mode
                FROM incomes_modo_bruto_fix_backup b
                WHERE incomes.id = b.incomeid;

                UPDATE categories
                SET islabor = false
                WHERE issystem = true AND name IN ('Bonificacion', 'Comisiones');

                DROP TABLE IF EXISTS incomes_modo_bruto_fix_backup;
            ");

            migrationBuilder.DropForeignKey(
                name: "fk_discountrules_categories_linkedcategoryid",
                table: "discountrules");

            migrationBuilder.DropTable(
                name: "expenseruleassignments");

            migrationBuilder.DropIndex(
                name: "ix_discountrules_linkedcategoryid",
                table: "discountrules");

            migrationBuilder.DropColumn(
                name: "linkedcategoryid",
                table: "discountrules");

            migrationBuilder.DropColumn(
                name: "linkeddescription",
                table: "discountrules");

            migrationBuilder.DropColumn(
                name: "validfrom",
                table: "discountrules");

            migrationBuilder.DropColumn(
                name: "validto",
                table: "discountrules");
        }
    }
}
