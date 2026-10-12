using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExpensesTracker.api.Data;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

public class DiscountRuleTotalsTests : IDisposable
{
    // Fábrica propia por test: el auto-match de descuentos es global entre reglas,
    // así que cada test necesita su propia base aislada (no IClassFixture compartido).
    private readonly TestingApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private HttpClient ClientFor(int userId, string username)
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = userId, Username = username, Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private HttpClient UserAClient() => ClientFor(TestingApiFactory.UserA, "usera");

    private async Task<int> CreateSourceAsync(HttpClient client, string name, string mode)
    {
        var response = await client.PostAsJsonAsync("/api/IncomeSources", new { name, mode });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    private async Task CreateIncomeAsync(HttpClient client, int sourceId, decimal amount, string mode, DateTime date, decimal? grossAmount = null)
    {
        var response = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount,
            grossAmount,
            isRecurring = false,
            description = $"Ingreso {mode} totals",
            date,
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            mode,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task<int> CreateExpenseAsync(HttpClient client, decimal amount, string description, DateTime date, string fundingSource = "Income")
    {
        var response = await client.PostAsJsonAsync("/api/Expenses", new
        {
            amount,
            description,
            date,
            categoryId = TestingApiFactory.CategoryGasto,
            fundingSource,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    private async Task<int> CreateLinkedRuleAsync(HttpClient client, int sourceId, string name, string? linkedDescription = null, int? linkedCategoryId = null, DateTime? validFrom = null)
    {
        var response = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name,
            linkedDescription,
            linkedCategoryId,
            isExpected = true,
            validFrom = validFrom ?? new DateTime(2026, 1, 1),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using (var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync()))
            return doc.RootElement.GetProperty("id").GetInt32();
    }

    private async Task<JsonElement> GetTotalsAsync(HttpClient client, int year, int month)
    {
        var response = await client.GetAsync($"/api/DiscountRules/totals?year={year}&month={month}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static JsonElement? SourceByName(JsonElement totals, string name)
    {
        var fuentes = totals.GetProperty("fuentes").EnumerateArray().ToList();
        var match = fuentes.FirstOrDefault(s => s.GetProperty("sourceName").GetString() == name);
        return match.ValueKind == JsonValueKind.Undefined ? null : match;
    }

    private static JsonElement? RuleByName(JsonElement source, string name)
    {
        var reglas = source.GetProperty("reglas").EnumerateArray().ToList();
        var match = reglas.FirstOrDefault(r => r.GetProperty("name").GetString() == name);
        return match.ValueKind == JsonValueKind.Undefined ? null : match;
    }

    private static decimal? Monto(JsonElement rule)
    {
        if (rule.GetProperty("monto").ValueKind == JsonValueKind.Null) return null;
        return rule.GetProperty("monto").GetDecimal();
    }

    [Fact]
    public async Task Referencia_Bruto1M_Vinculados_Neto743980_Invariante_Dashboard()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa REF", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 1000000m, "bruto", oct);
        await CreateExpenseAsync(client, 200000m, "VEP obra social", oct);
        await CreateExpenseAsync(client, 56020m, "VEP jubilación", oct, fundingSource: "Credit");
        await CreateLinkedRuleAsync(client, sourceId, "Jubilación", linkedDescription: "VEP");

        var totals = await GetTotalsAsync(client, 2026, 10);

        // Invariante KPI: Total del mes no cambia contra el Dashboard.
        Assert.Equal(1000000m, totals.GetProperty("total").GetDecimal());

        var fuente = SourceByName(totals, "Empresa REF")!.Value;
        Assert.Equal("bruto", fuente.GetProperty("mode").GetString());
        Assert.Equal(1000000m, fuente.GetProperty("ingresosBruto").GetDecimal());
        Assert.Equal(256020m, fuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(743980m, fuente.GetProperty("neto").GetDecimal());

        var rule = RuleByName(fuente, "Jubilación")!.Value;
        Assert.Equal(256020m, Monto(rule));
        Assert.True(rule.GetProperty("deduce").GetBoolean());
        Assert.Equal(2, rule.GetProperty("gastosVinculados").GetInt32());
    }

    [Fact]
    public async Task NoDobleResta_UnGastoLoTomaLaReglaMasAntigua()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa NODOBLE", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 500000m, "bruto", oct);
        await CreateExpenseAsync(client, 256020m, "VEP único", oct);

        await CreateLinkedRuleAsync(client, sourceId, "Jub 1", linkedDescription: "VEP");
        await CreateLinkedRuleAsync(client, sourceId, "Jub 2", linkedDescription: "VEP");

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa NODOBLE")!.Value;

        var jub1 = RuleByName(fuente, "Jub 1")!.Value;
        Assert.Equal(256020m, Monto(jub1));
        Assert.Equal(1, jub1.GetProperty("gastosVinculados").GetInt32());

        var jub2 = RuleByName(fuente, "Jub 2")!.Value;
        Assert.Null(Monto(jub2));
        Assert.Equal(0, jub2.GetProperty("gastosVinculados").GetInt32());

        Assert.Equal(500000m, totals.GetProperty("total").GetDecimal());
        Assert.Equal(256020m, fuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(243980m, fuente.GetProperty("neto").GetDecimal());
    }

    [Fact]
    public async Task AsignacionManual_VEP_MesN_AlMesN1_CuentaUnaSolaVez()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa VEP", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 300000m, "bruto", oct);
        // La fuente también tiene ingreso en septiembre: la regla deduce ese mes.
        await CreateIncomeAsync(client, sourceId, 300000m, "bruto", new DateTime(2026, 9, 10));
        var vepId = await CreateExpenseAsync(client, 50000m, "VEP", oct);
        var ruleId = await CreateLinkedRuleAsync(client, sourceId, "Jubilación", linkedDescription: "VEP");

        // Asignación manual a septiembre (mes N-1), aunque el gasto es de octubre (mes N).
        var assign = await client.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new
        {
            expenseId = vepId,
            year = 2026,
            month = 9
        });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

        // Mes N-1 (septiembre): cuenta UNA vez vía asignación manual.
        var sep = await GetTotalsAsync(client, 2026, 9);
        var sepFuente = SourceByName(sep, "Empresa VEP")!.Value;
        Assert.Equal(50000m, Monto(RuleByName(sepFuente, "Jubilación")!.Value));
        Assert.Equal(1, RuleByName(sepFuente, "Jubilación")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(50000m, sepFuente.GetProperty("descuentos").GetDecimal());

        // Mes N (octubre): excluido del auto-match → sin doble conteo.
        var octTotals = await GetTotalsAsync(client, 2026, 10);
        var octFuente = SourceByName(octTotals, "Empresa VEP")!.Value;
        Assert.Null(Monto(RuleByName(octFuente, "Jubilación")!.Value));
        Assert.Equal(0, RuleByName(octFuente, "Jubilación")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(300000m, octTotals.GetProperty("total").GetDecimal());
        Assert.Equal(0m, octFuente.GetProperty("descuentos").GetDecimal());

        // Al des-asignar, vuelve el auto-match del mes natural.
        var unassign = await client.DeleteAsync($"/api/DiscountRules/{ruleId}/assign?expenseId={vepId}");
        Assert.Equal(HttpStatusCode.NoContent, unassign.StatusCode);

        var octAfter = await GetTotalsAsync(client, 2026, 10);
        var octAfterFuente = SourceByName(octAfter, "Empresa VEP")!.Value;
        Assert.Equal(50000m, Monto(RuleByName(octAfterFuente, "Jubilación")!.Value));
    }

    [Fact]
    public async Task Porcentaje_Redondeo2Decimales_BaseSoloBruto_MesesMixtos()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa MIXTA", "bruto");
        var date = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 1000m, "bruto", date);
        await CreateIncomeAsync(client, sourceId, 500m, "neto", date);

        var ruleResponse = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Aporte %",
            percentage = 33.33m,
            validFrom = new DateTime(2026, 1, 1),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, ruleResponse.StatusCode);

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa MIXTA")!.Value;

        Assert.Equal(1000m, fuente.GetProperty("ingresosBruto").GetDecimal());
        Assert.Equal(500m, fuente.GetProperty("ingresosNeto").GetDecimal());
        Assert.Equal(333.30m, Monto(RuleByName(fuente, "Aporte %")!.Value));
        Assert.Equal(333.30m, fuente.GetProperty("descuentos").GetDecimal());
        // Neto = base bruto (1000 - 333.30) + neto sin restar (500).
        Assert.Equal(1166.70m, fuente.GetProperty("neto").GetDecimal());
        Assert.Equal(1500m, totals.GetProperty("total").GetDecimal());
    }

    [Fact]
    public async Task ReglaVinculada_SoloEnFuenteBruta_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa NETALINK", "neto");

        var response = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Jubilación",
            linkedDescription = "VEP",
            isExpected = true,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("solo pueden crearse en fuentes de modo Bruto", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task IsExpected_SinVinculo_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa ESPERADA", "bruto");

        var response = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Sueldo neto",
            fixedAmount = 100m,
            isExpected = true,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Las reglas esperadas deben vincularse a un gasto", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task LinkedCategory_DeOtroUsuario_ODeTipoNoGasto_Returns404()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa LNK", "bruto");

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var categoriaDeB = new Category { Name = "Gasto de B", Type = "gasto", UserId = TestingApiFactory.UserB, IsSystem = false, CreatedAt = DateTime.UtcNow };
        db.Categories.Add(categoriaDeB);
        await db.SaveChangesAsync();
        var categoriaDeBId = categoriaDeB.Id;

        var deOtroUsuario = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Jub ajena",
            linkedCategoryId = categoriaDeBId,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.NotFound, deOtroUsuario.StatusCode);
        Assert.Contains("no existe o no es de tipo gasto", await deOtroUsuario.Content.ReadAsStringAsync());

        var tipoIngreso = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Jub ingreso",
            linkedCategoryId = TestingApiFactory.CategoryIngreso,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.NotFound, tipoIngreso.StatusCode);
    }

    [Fact]
    public async Task Mes_SinIngreso_ReglaInformativa_NoEntraEnTotales()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa VACIA", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateExpenseAsync(client, 50000m, "VEP sin ingreso", oct);
        await CreateLinkedRuleAsync(client, sourceId, "Jubilación", linkedDescription: "VEP");

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa VACIA")!.Value;

        // Fuente sin ingreso en el mes: la regla se muestra como informativa.
        Assert.False(fuente.GetProperty("tieneIngresos").GetBoolean());
        Assert.Equal(0m, fuente.GetProperty("ingresosBruto").GetDecimal());
        var regla = RuleByName(fuente, "Jubilación")!.Value;
        Assert.False(regla.GetProperty("deduce").GetBoolean());
        // No consume gastos en el auto-match ni entra en Descuentos/Neto del mes.
        Assert.Equal(0, regla.GetProperty("gastosVinculados").GetInt32());
        Assert.Null(Monto(regla));
        Assert.Equal(0m, fuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(JsonValueKind.Null, fuente.GetProperty("neto").ValueKind);
        Assert.Equal(JsonValueKind.Null, totals.GetProperty("neto").ValueKind);
        Assert.Equal(0m, totals.GetProperty("descuentos").GetDecimal());
        Assert.Equal(0m, totals.GetProperty("total").GetDecimal());
    }

    [Fact]
    public async Task DescuentosSuperanIngreso_NetoNegativo_ConAviso()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa NEG", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 10000m, "bruto", oct);

        var ruleResponse = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Fija alta",
            fixedAmount = 15000m,
            validFrom = new DateTime(2026, 1, 1),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, ruleResponse.StatusCode);

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa NEG")!.Value;

        // Sin clamp: se muestra el neto real negativo y el aviso.
        Assert.Equal(-5000m, fuente.GetProperty("neto").GetDecimal());
        Assert.True(fuente.GetProperty("avisoNeto").GetBoolean());
        Assert.Equal(15000m, fuente.GetProperty("descuentos").GetDecimal());
        // El mes tiene ingreso → el neto del mes también refleja el valor real.
        Assert.Equal(-5000m, totals.GetProperty("neto").GetDecimal());
    }

    [Fact]
    public async Task Cuota_PagadaEnElMes_SumaLaCuota_IgualQueDashboard()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa CUOTA", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 1000000m, "bruto", oct);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var gasto = new Expense { Amount = 500000m, Description = "Obra social cuotas", Date = new DateTime(2026, 9, 1), CategoryId = TestingApiFactory.CategoryGasto, UserId = TestingApiFactory.UserA };
        db.Expenses.Add(gasto);
        await db.SaveChangesAsync();
        // Igual que el Dashboard: cuenta la cuota PAGADA este mes (PaidAt), no por vencimiento.
        db.PagosCuotas.AddRange(
            new PagoCuota { ExpenseId = gasto.Id, NroCuota = 1, MontoCuota = 120000m, DueDate = new DateTime(2026, 9, 15), PaidAt = new DateTime(2026, 10, 5), Status = PagoCuotaStatus.Paid },
            new PagoCuota { ExpenseId = gasto.Id, NroCuota = 2, MontoCuota = 380000m, DueDate = new DateTime(2026, 10, 15) });
        await db.SaveChangesAsync();

        await CreateLinkedRuleAsync(client, sourceId, "Obra social", linkedDescription: "Obra social cuotas");

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa CUOTA")!.Value;

        // Solo la cuota pagada en octubre, no el monto total del gasto ni la pendiente.
        Assert.Equal(120000m, Monto(RuleByName(fuente, "Obra social")!.Value));
        Assert.Equal(1, RuleByName(fuente, "Obra social")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(120000m, fuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(880000m, fuente.GetProperty("neto").GetDecimal());
    }

    [Fact]
    public async Task Seguridad_SinToken_Y_CrossUser_Returns401_404()
    {
        var clientA = UserAClient();
        var sourceId = await CreateSourceAsync(clientA, "Empresa SEG", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(clientA, sourceId, 100000m, "bruto", oct);
        var vepId = await CreateExpenseAsync(clientA, 50000m, "VEP", oct);
        var ruleId = await CreateLinkedRuleAsync(clientA, sourceId, "Jubilación", linkedDescription: "VEP");

        // Sin token → 401 en assign y totals.
        var anonymous = _factory.CreateClient();
        var assignAnon = await anonymous.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.Unauthorized, assignAnon.StatusCode);
        var totalsAnon = await anonymous.GetAsync("/api/DiscountRules/totals?year=2026&month=10");
        Assert.Equal(HttpStatusCode.Unauthorized, totalsAnon.StatusCode);

        var clientB = ClientFor(TestingApiFactory.UserB, "userb");

        // Regla de otra persona → 404.
        var assignRuleAjenA = await clientB.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.NotFound, assignRuleAjenA.StatusCode);
        Assert.Contains("La regla no existe.", await assignRuleAjenA.Content.ReadAsStringAsync());

        // Gasto de otra persona → 404.
        var sourceBId = await CreateSourceAsync(clientB, "Empresa SEG B", "bruto");
        var ruleBId = await CreateLinkedRuleAsync(clientB, sourceBId, "Jubilación B", linkedDescription: "VEP B");
        var assignGastoAjeno = await clientB.PostAsJsonAsync($"/api/DiscountRules/{ruleBId}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.NotFound, assignGastoAjeno.StatusCode);
        Assert.Contains("El gasto no existe.", await assignGastoAjeno.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AsignarGastoAReglaNoVinculada_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa NOVINC", "bruto");
        var oct = new DateTime(2026, 10, 10);

        var vepId = await CreateExpenseAsync(client, 50000m, "VEP fija", oct);

        var ruleResponse = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Fija",
            fixedAmount = 100m,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, ruleResponse.StatusCode);
        using var ruleDoc = JsonDocument.Parse(await ruleResponse.Content.ReadAsStringAsync());
        var ruleId = ruleDoc.RootElement.GetProperty("id").GetInt32();

        var assign = await client.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.BadRequest, assign.StatusCode);
        Assert.Contains("Solo las reglas vinculadas a gastos admiten reasignación manual", await assign.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task GastoYaAsignado_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa YAASIG", "bruto");
        var oct = new DateTime(2026, 10, 10);

        var vepId = await CreateExpenseAsync(client, 50000m, "VEP doble", oct);
        var rule1 = await CreateLinkedRuleAsync(client, sourceId, "Jub 1", linkedDescription: "VEP");
        var rule2 = await CreateLinkedRuleAsync(client, sourceId, "Jub 2", linkedDescription: "VEP");

        var first = await client.PostAsJsonAsync($"/api/DiscountRules/{rule1}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await client.PostAsJsonAsync($"/api/DiscountRules/{rule2}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Contains("El gasto ya está asignado a una regla.", await second.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task CuotaYaAsignada_Returns400_UnicidadPorCuota()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa CUOTADUP", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 500000m, "bruto", oct);

        // Gasto con cuotas: la unicidad de asignación es por cuota (ExpenseId + PagoCuotaId).
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var gasto = new Expense { Amount = 300000m, Description = "Obra social cuota dup", Date = oct, CategoryId = TestingApiFactory.CategoryGasto, UserId = TestingApiFactory.UserA };
            db.Expenses.Add(gasto);
            await db.SaveChangesAsync();
            db.PagosCuotas.Add(new PagoCuota { ExpenseId = gasto.Id, NroCuota = 1, MontoCuota = 300000m, DueDate = new DateTime(2026, 10, 15) });
            await db.SaveChangesAsync();
        }

        int expenseId;
        int cuotaId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var gasto = db.Expenses.First(e => e.Description == "Obra social cuota dup");
            expenseId = gasto.Id;
            cuotaId = db.PagosCuotas.First(pc => pc.ExpenseId == gasto.Id).Id;
        }

        var rule1 = await CreateLinkedRuleAsync(client, sourceId, "Obra 1", linkedDescription: "Obra social cuota dup");
        var rule2 = await CreateLinkedRuleAsync(client, sourceId, "Obra 2", linkedDescription: "Obra social cuota dup");

        var first = await client.PostAsJsonAsync($"/api/DiscountRules/{rule1}/assign", new { expenseId, pagoCuotaId = cuotaId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        // Misma cuota en otra regla → 400 (índice único por PagoCuotaId).
        var second = await client.PostAsJsonAsync($"/api/DiscountRules/{rule2}/assign", new { expenseId, pagoCuotaId = cuotaId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Contains("La cuota ya está asignada a una regla.", await second.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Formula_Modo_X_Fija_Porcentaje_Vinculada()
    {
        // Tabla de fórmula: modo de la fuente (bruto/neto) × tipo de regla (fija/%/vinculada).
        var client = UserAClient();
        var oct = new DateTime(2026, 10, 10);

        // Fuente BRUTO: fija, % y vinculada deducen.
        var brutoId = await CreateSourceAsync(client, "Formula Bruto", "bruto");
        await CreateIncomeAsync(client, brutoId, 1000m, "bruto", oct);
        await CreateExpenseAsync(client, 100m, "vep formula bruto", oct);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = brutoId, name = "B fija", fixedAmount = 100m, validFrom = new DateTime(2026, 1, 1), userId = TestingApiFactory.UserA })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = brutoId, name = "B pct", percentage = 10m, validFrom = new DateTime(2026, 1, 1), userId = TestingApiFactory.UserA })).StatusCode);
        await CreateLinkedRuleAsync(client, brutoId, "B vinc", linkedDescription: "vep formula bruto");

        // Fuente NETO: fija informativa, % requiere el bruto del recibo, vinculada no se permite.
        var netoId = await CreateSourceAsync(client, "Formula Neto", "neto");
        await CreateIncomeAsync(client, netoId, 1000m, "neto", oct);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = netoId, name = "N fija", fixedAmount = 100m, validFrom = new DateTime(2026, 1, 1), userId = TestingApiFactory.UserA })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = netoId, name = "N pct", percentage = 10m, validFrom = new DateTime(2026, 1, 1), userId = TestingApiFactory.UserA })).StatusCode);
        var vincNeto = await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = netoId, name = "N vinc", linkedDescription = "vep formula neto", isExpected = true, userId = TestingApiFactory.UserA });
        Assert.Equal(HttpStatusCode.BadRequest, vincNeto.StatusCode);

        var totals = await GetTotalsAsync(client, 2026, 10);

        var b = SourceByName(totals, "Formula Bruto")!.Value;
        Assert.Equal(1000m, b.GetProperty("ingresosBruto").GetDecimal());
        Assert.Equal(100m, Monto(RuleByName(b, "B fija")!.Value));
        Assert.True(RuleByName(b, "B fija")!.Value.GetProperty("deduce").GetBoolean());
        Assert.Equal(100m, Monto(RuleByName(b, "B pct")!.Value)); // 1000 * 10% = 100
        Assert.True(RuleByName(b, "B pct")!.Value.GetProperty("deduce").GetBoolean());
        Assert.Equal(100m, Monto(RuleByName(b, "B vinc")!.Value));
        Assert.True(RuleByName(b, "B vinc")!.Value.GetProperty("deduce").GetBoolean());
        Assert.Equal(300m, b.GetProperty("descuentos").GetDecimal());
        Assert.Equal(700m, b.GetProperty("neto").GetDecimal());

        var n = SourceByName(totals, "Formula Neto")!.Value;
        Assert.Equal(1000m, n.GetProperty("ingresosNeto").GetDecimal());
        // Fija en fuente neto: se muestra pero no deduce.
        Assert.Equal(100m, Monto(RuleByName(n, "N fija")!.Value));
        Assert.False(RuleByName(n, "N fija")!.Value.GetProperty("deduce").GetBoolean());
        // % en fuente neto sin bruto: requiere el bruto del recibo (sin monto, sin deducir).
        Assert.Null(Monto(RuleByName(n, "N pct")!.Value));
        Assert.True(RuleByName(n, "N pct")!.Value.GetProperty("requiereBruto").GetBoolean());
        Assert.False(RuleByName(n, "N pct")!.Value.GetProperty("deduce").GetBoolean());
        Assert.Equal(0m, n.GetProperty("descuentos").GetDecimal());
        Assert.Equal(1000m, n.GetProperty("neto").GetDecimal());

        // El descuento del mes solo cuenta fuentes de modo Bruto.
        Assert.Equal(300m, totals.GetProperty("descuentos").GetDecimal());
        Assert.Equal(1700m, totals.GetProperty("neto").GetDecimal());
        Assert.Equal(2000m, totals.GetProperty("total").GetDecimal());
    }

    [Fact]
    public async Task Seguridad_Unassign_SinToken_Y_CrossUser_Returns401_404()
    {
        var clientA = UserAClient();
        var sourceId = await CreateSourceAsync(clientA, "Empresa UNSEC", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(clientA, sourceId, 100000m, "bruto", oct);
        var vepId = await CreateExpenseAsync(clientA, 50000m, "VEP", oct);
        var ruleId = await CreateLinkedRuleAsync(clientA, sourceId, "Jubilación", linkedDescription: "VEP");

        var assign = await clientA.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

        // Sin token → 401.
        var anonymous = _factory.CreateClient();
        var anon = await anonymous.DeleteAsync($"/api/DiscountRules/{ruleId}/assign?expenseId={vepId}");
        Assert.Equal(HttpStatusCode.Unauthorized, anon.StatusCode);

        // Otro usuario → 404 (la asignación no existe para él).
        var clientB = ClientFor(TestingApiFactory.UserB, "userb");
        var cross = await clientB.DeleteAsync($"/api/DiscountRules/{ruleId}/assign?expenseId={vepId}");
        Assert.Equal(HttpStatusCode.NotFound, cross.StatusCode);

        // El dueño sí puede desasignar.
        var own = await clientA.DeleteAsync($"/api/DiscountRules/{ruleId}/assign?expenseId={vepId}");
        Assert.Equal(HttpStatusCode.NoContent, own.StatusCode);
    }

    // ── Fase 3.5a: semántica por (fuente, mes) + vigencia ──────────────────────

    [Fact]
    public async Task A_FuenteBrutoConIngresoNeto_NoDeduce_FijaNiVinculada()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa BRUTO NETO", "bruto");
        var oct = new DateTime(2026, 10, 10);

        // Ingreso con snapshot Neto aunque la fuente sea Bruto: nunca se resta.
        await CreateIncomeAsync(client, sourceId, 1000000m, "neto", oct);
        await CreateExpenseAsync(client, 80000m, "VEP bruto neto", oct);

        // Fija y vinculada son válidas (la fuente es Bruto), pero sin bruto en el mes no deducen.
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = sourceId, name = "Fija", fixedAmount = 50000m, validFrom = new DateTime(2026, 1, 1), userId = TestingApiFactory.UserA })).StatusCode);
        await CreateLinkedRuleAsync(client, sourceId, "Vinculada", linkedDescription: "VEP bruto neto");

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa BRUTO NETO")!.Value;

        Assert.Equal(0m, fuente.GetProperty("ingresosBruto").GetDecimal());
        Assert.Equal(1000000m, fuente.GetProperty("ingresosNeto").GetDecimal());
        var fija = RuleByName(fuente, "Fija")!.Value;
        Assert.Equal(50000m, Monto(fija));
        Assert.False(fija.GetProperty("deduce").GetBoolean());
        var vinc = RuleByName(fuente, "Vinculada")!.Value;
        Assert.False(vinc.GetProperty("deduce").GetBoolean());
        Assert.Equal(0, vinc.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(0m, fuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(1000000m, fuente.GetProperty("neto").GetDecimal());
        Assert.Equal(0m, totals.GetProperty("descuentos").GetDecimal());
        Assert.Equal(1000000m, totals.GetProperty("neto").GetDecimal());
        // Invariante del mes.
        Assert.Equal(
            totals.GetProperty("total").GetDecimal() - totals.GetProperty("descuentos").GetDecimal(),
            totals.GetProperty("neto").GetDecimal());
    }

    [Fact]
    public async Task B_CambioDeModoDeLaFuente_ConservaElHistorial()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa CAMBIO", "bruto");
        var oct = new DateTime(2026, 10, 10);
        var sep = new DateTime(2026, 9, 10);

        await CreateIncomeAsync(client, sourceId, 1000000m, "bruto", oct);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = sourceId, name = "Fija", fixedAmount = 100000m, validFrom = new DateTime(2026, 1, 1), userId = TestingApiFactory.UserA })).StatusCode);

        var octBefore = await GetTotalsAsync(client, 2026, 10);
        Assert.Equal(100000m, SourceByName(octBefore, "Empresa CAMBIO")!.Value.GetProperty("descuentos").GetDecimal());

        // La fuente pasa a modo Neto (no debe alterar el historial).
        var put = await client.PutAsJsonAsync($"/api/IncomeSources/{sourceId}", new { name = "Empresa CAMBIO", mode = "neto" });
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);

        // Octubre sigue deduciendo igual (su ingreso quedó con snapshot Bruto).
        var octAfter = await GetTotalsAsync(client, 2026, 10);
        var octFuente = SourceByName(octAfter, "Empresa CAMBIO")!.Value;
        Assert.Equal(100000m, octFuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(900000m, octFuente.GetProperty("neto").GetDecimal());

        // Septiembre con ingreso Neto: la regla no deduce (el modo actual no la fuerza).
        await CreateIncomeAsync(client, sourceId, 500000m, "neto", sep);
        var sepTotals = await GetTotalsAsync(client, 2026, 9);
        var sepFuente = SourceByName(sepTotals, "Empresa CAMBIO")!.Value;
        Assert.Equal(0m, sepFuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(500000m, sepFuente.GetProperty("neto").GetDecimal());
    }

    [Fact]
    public async Task C_FuenteSinIngreso_NoConsumeGastosNiEntraEnTotales()
    {
        var client = UserAClient();
        var sinIngresoId = await CreateSourceAsync(client, "Empresa SININ", "bruto");
        var conIngresoId = await CreateSourceAsync(client, "Empresa CONIN", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, conIngresoId, 500000m, "bruto", oct);
        await CreateExpenseAsync(client, 70000m, "VEP compartido", oct);

        // La regla de la fuente SIN ingreso se crea primero (tendría prioridad en el auto-match).
        await CreateLinkedRuleAsync(client, sinIngresoId, "Jub sin ingreso", linkedDescription: "VEP compartido");
        await CreateLinkedRuleAsync(client, conIngresoId, "Jub con ingreso", linkedDescription: "VEP compartido");

        var totals = await GetTotalsAsync(client, 2026, 10);

        var sinIngreso = SourceByName(totals, "Empresa SININ")!.Value;
        Assert.False(sinIngreso.GetProperty("tieneIngresos").GetBoolean());
        Assert.False(RuleByName(sinIngreso, "Jub sin ingreso")!.Value.GetProperty("deduce").GetBoolean());
        Assert.Equal(0, RuleByName(sinIngreso, "Jub sin ingreso")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(0m, sinIngreso.GetProperty("descuentos").GetDecimal());

        // El gasto lo toma la fuente con ingreso: la sin ingreso no consume en el auto-match.
        var conIngreso = SourceByName(totals, "Empresa CONIN")!.Value;
        Assert.Equal(70000m, Monto(RuleByName(conIngreso, "Jub con ingreso")!.Value));
        Assert.Equal(1, RuleByName(conIngreso, "Jub con ingreso")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(70000m, conIngreso.GetProperty("descuentos").GetDecimal());

        // Invariante del mes.
        Assert.Equal(500000m, totals.GetProperty("total").GetDecimal());
        Assert.Equal(70000m, totals.GetProperty("descuentos").GetDecimal());
        Assert.Equal(430000m, totals.GetProperty("neto").GetDecimal());
        Assert.Equal(
            totals.GetProperty("total").GetDecimal() - totals.GetProperty("descuentos").GetDecimal(),
            totals.GetProperty("neto").GetDecimal());
    }

    [Fact]
    public async Task D_NetoConBrutoParcial_OtrosSinDetallarRestaSoloNetosConBruto()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa OTROS", "neto");
        var oct = new DateTime(2026, 10, 10);

        // Dos ingresos netos: uno trae el bruto del recibo, el otro no.
        await CreateIncomeAsync(client, sourceId, 1000m, "neto", oct, grossAmount: 1500m);
        await CreateIncomeAsync(client, sourceId, 500m, "neto", oct);

        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = sourceId, name = "Obra social", fixedAmount = 100m, validFrom = new DateTime(2026, 1, 1), userId = TestingApiFactory.UserA })).StatusCode);

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa OTROS")!.Value;

        Assert.Equal(1500m, fuente.GetProperty("grossTotal").GetDecimal());
        Assert.Equal(1500m, fuente.GetProperty("ingresosNeto").GetDecimal());
        // (1500 - 1000) - 100 = 400. Si restara todos los netos, daría 0.
        Assert.Equal(400m, fuente.GetProperty("otrosSinDetallar").GetDecimal());
        Assert.False(fuente.GetProperty("avisoOtros").GetBoolean());
        // La fija en fuente neto no deduce.
        Assert.Equal(0m, fuente.GetProperty("descuentos").GetDecimal());
    }

    [Fact]
    public async Task E_GastoAsignadoManual_BorradoYRestaurado_AjustaElMonto()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa BORRA", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 500000m, "bruto", oct);
        var vepId = await CreateExpenseAsync(client, 60000m, "VEP borrable", oct);
        var ruleId = await CreateLinkedRuleAsync(client, sourceId, "Jubilación", linkedDescription: "VEP borrable");

        var assign = await client.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new { expenseId = vepId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

        var before = await GetTotalsAsync(client, 2026, 10);
        var antes = SourceByName(before, "Empresa BORRA")!.Value;
        Assert.Equal(60000m, Monto(RuleByName(antes, "Jubilación")!.Value));
        Assert.Equal(60000m, antes.GetProperty("descuentos").GetDecimal());

        // Gasto borrado (soft-delete): la asignación deja de aportar.
        var del = await client.DeleteAsync($"/api/Expenses/{vepId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        var duringDelete = await GetTotalsAsync(client, 2026, 10);
        var borrado = SourceByName(duringDelete, "Empresa BORRA")!.Value;
        Assert.Equal(0m, Monto(RuleByName(borrado, "Jubilación")!.Value));
        Assert.Equal(0m, borrado.GetProperty("descuentos").GetDecimal());

        // Gasto restaurado: vuelve a contar.
        var restore = await client.PostAsync($"/api/Expenses/{vepId}/restore", null);
        Assert.Equal(HttpStatusCode.NoContent, restore.StatusCode);
        var afterRestore = await GetTotalsAsync(client, 2026, 10);
        var restaurado = SourceByName(afterRestore, "Empresa BORRA")!.Value;
        Assert.Equal(60000m, Monto(RuleByName(restaurado, "Jubilación")!.Value));
        Assert.Equal(60000m, restaurado.GetProperty("descuentos").GetDecimal());
    }

    [Fact]
    public async Task F_DosReglasSobreElMismoGasto_GanaLaMasAntigua()
    {
        var client = UserAClient();
        var zetaId = await CreateSourceAsync(client, "Empresa ZETA", "bruto");
        var alfaId = await CreateSourceAsync(client, "Empresa ALFA", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, zetaId, 500000m, "bruto", oct);
        await CreateIncomeAsync(client, alfaId, 500000m, "bruto", oct);
        await CreateExpenseAsync(client, 90000m, "VEP disputado", oct);

        // "Vieja" se crea antes (menor Id) aunque su fuente ordene después alfabéticamente.
        await CreateLinkedRuleAsync(client, zetaId, "Vieja", linkedDescription: "VEP disputado");
        await CreateLinkedRuleAsync(client, alfaId, "Nueva", linkedDescription: "VEP disputado");

        var totals = await GetTotalsAsync(client, 2026, 10);
        var zeta = SourceByName(totals, "Empresa ZETA")!.Value;
        var alfa = SourceByName(totals, "Empresa ALFA")!.Value;

        Assert.Equal(90000m, Monto(RuleByName(zeta, "Vieja")!.Value));
        Assert.Equal(1, RuleByName(zeta, "Vieja")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Null(Monto(RuleByName(alfa, "Nueva")!.Value));
        Assert.Equal(0, RuleByName(alfa, "Nueva")!.Value.GetProperty("gastosVinculados").GetInt32());
    }

    [Fact]
    public async Task G_Vigencia_ReglaNoAfectaMesesPrevios()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa VIG", "bruto");
        var sep = new DateTime(2026, 9, 10);
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 1000000m, "bruto", sep);
        await CreateIncomeAsync(client, sourceId, 1000000m, "bruto", oct);

        // Vigente desde octubre: no afecta septiembre.
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = sourceId, name = "Desde octubre", fixedAmount = 100000m, validFrom = new DateTime(2026, 10, 1), userId = TestingApiFactory.UserA })).StatusCode);
        // Vigente hasta septiembre: no afecta octubre.
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/DiscountRules", new { incomeSourceId = sourceId, name = "Hasta septiembre", fixedAmount = 30000m, validFrom = new DateTime(2026, 1, 1), validTo = new DateTime(2026, 9, 30), userId = TestingApiFactory.UserA })).StatusCode);

        var sepTotals = await GetTotalsAsync(client, 2026, 9);
        var sepFuente = SourceByName(sepTotals, "Empresa VIG")!.Value;
        Assert.NotNull(RuleByName(sepFuente, "Hasta septiembre"));
        Assert.Null(RuleByName(sepFuente, "Desde octubre"));
        Assert.Equal(30000m, sepFuente.GetProperty("descuentos").GetDecimal());

        var octTotals = await GetTotalsAsync(client, 2026, 10);
        var octFuente = SourceByName(octTotals, "Empresa VIG")!.Value;
        Assert.NotNull(RuleByName(octFuente, "Desde octubre"));
        Assert.Null(RuleByName(octFuente, "Hasta septiembre"));
        Assert.Equal(100000m, octFuente.GetProperty("descuentos").GetDecimal());
    }

    [Fact]
    public async Task H_CuotaImpagaAsignada_NoResta()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa IMPAGA", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 500000m, "bruto", oct);

        int expenseId;
        int cuotaId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var gasto = new Expense { Amount = 200000m, Description = "Obra impaga", Date = oct, CategoryId = TestingApiFactory.CategoryGasto, UserId = TestingApiFactory.UserA };
            db.Expenses.Add(gasto);
            await db.SaveChangesAsync();
            var cuota = new PagoCuota { ExpenseId = gasto.Id, NroCuota = 1, MontoCuota = 200000m, DueDate = new DateTime(2026, 10, 15), Status = PagoCuotaStatus.Pending };
            db.PagosCuotas.Add(cuota);
            await db.SaveChangesAsync();
            expenseId = gasto.Id;
            cuotaId = cuota.Id;
        }

        var ruleId = await CreateLinkedRuleAsync(client, sourceId, "Obra social", linkedDescription: "Obra impaga");

        // La asignación manual se puede hacer sobre una cuota impaga...
        var assign = await client.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new { expenseId, pagoCuotaId = cuotaId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

        // ...pero no resta: el Dashboard no cuenta la cuota impaga como gasto.
        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa IMPAGA")!.Value;
        Assert.Equal(0m, Monto(RuleByName(fuente, "Obra social")!.Value));
        Assert.Equal(1, RuleByName(fuente, "Obra social")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(0m, fuente.GetProperty("descuentos").GetDecimal());
        Assert.Equal(500000m, fuente.GetProperty("neto").GetDecimal());
    }

    [Fact]
    public async Task I_CuotaAsignadaYGastoBorrado_NoResta()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa CUOTABORRA", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 500000m, "bruto", oct);

        int expenseId;
        int cuotaId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var gasto = new Expense { Amount = 300000m, Description = "Obra borrable cuota", Date = oct, CategoryId = TestingApiFactory.CategoryGasto, UserId = TestingApiFactory.UserA };
            db.Expenses.Add(gasto);
            await db.SaveChangesAsync();
            var cuota = new PagoCuota { ExpenseId = gasto.Id, NroCuota = 1, MontoCuota = 120000m, DueDate = new DateTime(2026, 10, 15), PaidAt = new DateTime(2026, 10, 5), Status = PagoCuotaStatus.Paid };
            db.PagosCuotas.Add(cuota);
            await db.SaveChangesAsync();
            expenseId = gasto.Id;
            cuotaId = cuota.Id;
        }

        var ruleId = await CreateLinkedRuleAsync(client, sourceId, "Obra social", linkedDescription: "Obra borrable cuota");
        var assign = await client.PostAsJsonAsync($"/api/DiscountRules/{ruleId}/assign", new { expenseId, pagoCuotaId = cuotaId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

        var before = await GetTotalsAsync(client, 2026, 10);
        var antes = SourceByName(before, "Empresa CUOTABORRA")!.Value;
        Assert.Equal(120000m, Monto(RuleByName(antes, "Obra social")!.Value));
        Assert.Equal(120000m, antes.GetProperty("descuentos").GetDecimal());

        // Gasto borrado: la cuota (aún pagada) deja de aportar monto.
        var del = await client.DeleteAsync($"/api/Expenses/{expenseId}");
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        var duringDelete = await GetTotalsAsync(client, 2026, 10);
        var borrado = SourceByName(duringDelete, "Empresa CUOTABORRA")!.Value;
        Assert.Equal(0m, Monto(RuleByName(borrado, "Obra social")!.Value));
        Assert.Equal(0m, borrado.GetProperty("descuentos").GetDecimal());

        // Gasto restaurado: vuelve a aportar.
        var restore = await client.PostAsync($"/api/Expenses/{expenseId}/restore", null);
        Assert.Equal(HttpStatusCode.NoContent, restore.StatusCode);
        var afterRestore = await GetTotalsAsync(client, 2026, 10);
        var restaurado = SourceByName(afterRestore, "Empresa CUOTABORRA")!.Value;
        Assert.Equal(120000m, Monto(RuleByName(restaurado, "Obra social")!.Value));
    }

    [Fact]
    public async Task J_ReglaNoVigente_NoConsumeGastosDeUnaVigente()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa NOVIG", "bruto");
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 500000m, "bruto", oct);
        await CreateExpenseAsync(client, 90000m, "VEP vigencia", oct);

        // La regla NO vigente se crea primero: si participara del auto-match, se quedaría el gasto.
        await CreateLinkedRuleAsync(client, sourceId, "Futura", linkedDescription: "VEP vigencia", validFrom: new DateTime(2026, 11, 1));
        await CreateLinkedRuleAsync(client, sourceId, "Vigente", linkedDescription: "VEP vigencia", validFrom: new DateTime(2026, 1, 1));

        var totals = await GetTotalsAsync(client, 2026, 10);
        var fuente = SourceByName(totals, "Empresa NOVIG")!.Value;

        // La no vigente ni aparece en el mes; la vigente consume el gasto.
        Assert.Null(RuleByName(fuente, "Futura"));
        Assert.Equal(90000m, Monto(RuleByName(fuente, "Vigente")!.Value));
        Assert.Equal(1, RuleByName(fuente, "Vigente")!.Value.GetProperty("gastosVinculados").GetInt32());
        Assert.Equal(90000m, fuente.GetProperty("descuentos").GetDecimal());
    }

    [Fact]
    public async Task K_ValidToAnteriorAValidFrom_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa VTO", "bruto");

        var post = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Rango inválido",
            fixedAmount = 100m,
            validFrom = new DateTime(2026, 10, 1),
            validTo = new DateTime(2026, 9, 30),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.BadRequest, post.StatusCode);
        Assert.Contains("no puede ser anterior a la de inicio", await post.Content.ReadAsStringAsync());

        var ruleResponse = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Rango ok",
            fixedAmount = 100m,
            validFrom = new DateTime(2026, 1, 1),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, ruleResponse.StatusCode);
        using var doc = JsonDocument.Parse(await ruleResponse.Content.ReadAsStringAsync());
        var ruleId = doc.RootElement.GetProperty("id").GetInt32();

        var put = await client.PutAsJsonAsync($"/api/DiscountRules/{ruleId}", new
        {
            id = ruleId,
            incomeSourceId = sourceId,
            name = "Rango ok",
            fixedAmount = 100m,
            validFrom = new DateTime(2026, 10, 1),
            validTo = new DateTime(2026, 9, 30),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
        Assert.Contains("no puede ser anterior a la de inicio", await put.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task L_EdicionDeMonto_HoySobrescribeElHistorico_DeudaVersionado()
    {
        // Caracteriza la DEUDA declarada en el PR: editar el monto SOBRESCRIBE la regla y
        // recalcula meses anteriores. Cuando se implemente el versionado, este test debe pasar
        // a exigir que septiembre conserve el monto viejo (100) y solo octubre tome el nuevo (200).
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa EDICION", "bruto");
        var sep = new DateTime(2026, 9, 10);
        var oct = new DateTime(2026, 10, 10);

        await CreateIncomeAsync(client, sourceId, 1000000m, "bruto", sep);
        await CreateIncomeAsync(client, sourceId, 1000000m, "bruto", oct);

        var ruleResponse = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Obra social",
            fixedAmount = 100m,
            validFrom = new DateTime(2026, 1, 1),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, ruleResponse.StatusCode);
        using var doc = JsonDocument.Parse(await ruleResponse.Content.ReadAsStringAsync());
        var ruleId = doc.RootElement.GetProperty("id").GetInt32();

        var sepBefore = await GetTotalsAsync(client, 2026, 9);
        Assert.Equal(100m, SourceByName(sepBefore, "Empresa EDICION")!.Value.GetProperty("descuentos").GetDecimal());

        var put = await client.PutAsJsonAsync($"/api/DiscountRules/{ruleId}", new
        {
            id = ruleId,
            incomeSourceId = sourceId,
            name = "Obra social",
            fixedAmount = 200m,
            validFrom = new DateTime(2026, 1, 1),
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);

        // Deuda: el mes histórico cambia a 200 (hoy la edición sobrescribe).
        var sepAfter = await GetTotalsAsync(client, 2026, 9);
        Assert.Equal(200m, SourceByName(sepAfter, "Empresa EDICION")!.Value.GetProperty("descuentos").GetDecimal());
        var octAfter = await GetTotalsAsync(client, 2026, 10);
        Assert.Equal(200m, SourceByName(octAfter, "Empresa EDICION")!.Value.GetProperty("descuentos").GetDecimal());
    }
}