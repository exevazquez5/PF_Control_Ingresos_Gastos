using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExpensesTracker.api.Data;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

// Fase 3.5a (enmienda 8): con una base sintetica de volumen, los KPIs de agregados
// (Total Ingresos / Total Gastos) deben ser identicos antes y despues del cambio.
// Aqui verificamos que los endpoints que alimentan el Dashboard suman siempre Amount
// (que en modo Bruto ES el bruto) y no se ven alterados por el modo ni por GrossAmount.
public class KpiInvarianceVolumeTests : IDisposable
{
    private readonly TestingApiFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private const int VolumeMonth = 3;   // marzo 2027 (mes dedicado, sin colision con el seed base)
    private const int VolumeYear = 2027;
    private const int IncomesCount = 101;
    private const int ExpensesCount = 767;

    private HttpClient UserAClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private (decimal incomes, decimal expenses) SeedVolume()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var source = new IncomeSource
        {
            UserId = TestingApiFactory.UserA,
            Name = "Volumen SA",
            Mode = IncomeSource.ModeBruto,
            CreatedAt = new DateTime(VolumeYear, VolumeMonth, 1)
        };
        db.IncomeSources.Add(source);
        db.SaveChanges();

        decimal incomes = 0m;
        for (var i = 0; i < IncomesCount; i++)
        {
            var amount = 1000m + i;
            var bruto = i % 2 == 0;
            // En modo neto con bruto declarado, GrossAmount NUNCA debe filtrarse al KPI.
            var gross = bruto ? (decimal?)null : amount + 500m;
            db.Incomes.Add(new Income
            {
                Amount = amount,
                GrossAmount = gross,
                IsRecurring = false,
                Description = $"volumen ingreso {i}",
                Date = new DateTime(VolumeYear, VolumeMonth, (i % 28) + 1),
                CategoryId = TestingApiFactory.CategoryIngreso,
                SourceId = source.Id,
                Mode = bruto ? IncomeSource.ModeBruto : IncomeSource.ModeNeto,
                UserId = TestingApiFactory.UserA
            });
            incomes += amount;
        }

        decimal expenses = 0m;
        var funding = new[] { FundingSource.Income, FundingSource.Savings, FundingSource.Credit };
        for (var i = 0; i < ExpensesCount; i++)
        {
            var amount = 100m + i;
            db.Expenses.Add(new Expense
            {
                Amount = amount,
                Description = $"volumen gasto {i}",
                Date = new DateTime(VolumeYear, VolumeMonth, (i % 28) + 1),
                CategoryId = TestingApiFactory.CategoryGasto,
                UserId = TestingApiFactory.UserA,
                FundingSource = funding[i % funding.Length]
            });
            expenses += amount;
        }

        db.SaveChanges();
        return (incomes, expenses);
    }

    [Fact]
    public async Task Kpis_ConVolumen_IngresosYGastos_SumanAmount_IgnorandoModoYGross()
    {
        var (expectedIncomes, expectedExpenses) = SeedVolume();
        var client = UserAClient();

        // Total Ingresos del mes (endpoint del Dashboard / pantalla de Ingresos)
        var overview = await client.GetFromJsonAsync<JsonElement>("/api/Incomes/overview");
        var months = overview.GetProperty("months");
        var target = months.EnumerateArray().First(m =>
            m.GetProperty("month").GetInt32() == VolumeMonth &&
            m.GetProperty("year").GetInt32() == VolumeYear);

        Assert.Equal(expectedIncomes, target.GetProperty("total").GetDecimal());

        // Total Gastos del mes
        var expenses = await client.GetFromJsonAsync<JsonElement>($"/api/Expenses/month/{VolumeMonth}/{VolumeYear}");
        var expenseSum = expenses.EnumerateArray().Sum(e => e.GetProperty("amount").GetDecimal());

        Assert.Equal(ExpensesCount, expenses.GetArrayLength());
        Assert.Equal(expectedExpenses, expenseSum);
    }

    [Fact]
    public async Task Kpis_ConVolumen_SinVolumenNoAlteraOtrosMeses()
    {
        // Con volumen en marzo, un mes vecino sin datos debe dar 0 (no se contamina).
        SeedVolume();
        var client = UserAClient();
        var expenses = await client.GetFromJsonAsync<JsonElement>($"/api/Expenses/month/2/{VolumeYear}");
        Assert.Equal(0, expenses.GetArrayLength());
    }
}
