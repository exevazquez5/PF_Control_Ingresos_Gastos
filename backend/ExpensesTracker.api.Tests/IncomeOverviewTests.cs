using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

public class IncomeOverviewEmptyTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public IncomeOverviewEmptyTests(TestingApiFactory factory) => _factory = factory;

    [Fact]
    public async Task SinToken_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/Incomes/overview");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SinIngresos_MesesVacios_D7()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/api/Incomes/overview");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("firstIncomeMonth").ValueKind);
        Assert.Equal(0, doc.RootElement.GetProperty("months").GetArrayLength());
    }
}

public class IncomeOverviewMonthsTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public IncomeOverviewMonthsTests(TestingApiFactory factory) => _factory = factory;

    private HttpClient UserAClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task MesesEntrePrimerIngresoYActual_ConVacioIntermedio_D7()
    {
        var client = UserAClient();

        var currentMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
        var threeMonthsAgo = currentMonth.AddMonths(-3);
        var oneMonthAgo = currentMonth.AddMonths(-1);

        foreach (var (date, amount) in new[] { (threeMonthsAgo, 1000m), (oneMonthAgo, 2000m) })
        {
            var create = await client.PostAsJsonAsync("/api/Incomes", new
            {
                amount,
                isRecurring = false,
                description = "Ingreso overview",
                date,
                categoryId = TestingApiFactory.CategoryIngreso,
                userId = TestingApiFactory.UserA
            });
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        }

        var response = await client.GetAsync("/api/Incomes/overview");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var months = doc.RootElement.GetProperty("months");

        var expectedCount = (currentMonth.Year * 12 + currentMonth.Month) - (threeMonthsAgo.Year * 12 + threeMonthsAgo.Month) + 1;
        Assert.Equal(expectedCount, months.GetArrayLength());

        var first = months[0];
        Assert.Equal(threeMonthsAgo.Year, first.GetProperty("year").GetInt32());
        Assert.Equal(threeMonthsAgo.Month, first.GetProperty("month").GetInt32());
        Assert.Equal(1000m, first.GetProperty("total").GetDecimal());

        // Mes vacío intermedio (tres meses atrás + 1)
        var emptyMonth = months[1];
        Assert.Equal(threeMonthsAgo.AddMonths(1).Month, emptyMonth.GetProperty("month").GetInt32());
        Assert.Equal(0m, emptyMonth.GetProperty("total").GetDecimal());

        var current = months[months.GetArrayLength() - 1];
        Assert.Equal(currentMonth.Month, current.GetProperty("month").GetInt32());
        Assert.Equal(0m, current.GetProperty("total").GetDecimal());
    }
}

public class IncomeOverviewSourcesTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public IncomeOverviewSourcesTests(TestingApiFactory factory) => _factory = factory;

    private HttpClient UserAClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task AgrupaPorFuenteYFallbackACategoria_D6()
    {
        var client = UserAClient();

        var createSource = await client.PostAsJsonAsync("/api/IncomeSources", new { name = "Empresa OVERVIEW", mode = "neto" });
        Assert.Equal(HttpStatusCode.Created, createSource.StatusCode);
        using var sourceDoc = JsonDocument.Parse(await createSource.Content.ReadAsStringAsync());
        var sourceId = sourceDoc.RootElement.GetProperty("id").GetInt32();

        var thisMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 5);

        var conFuente = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 3000m,
            grossAmount = 4000m,
            isRecurring = false,
            description = "Con fuente overview",
            date = thisMonth,
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, conFuente.StatusCode);

        var sinFuente = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 500m,
            isRecurring = false,
            description = "Sin fuente overview",
            date = thisMonth,
            categoryId = TestingApiFactory.CategoryIngreso,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, sinFuente.StatusCode);

        var response = await client.GetAsync("/api/Incomes/overview");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var months = doc.RootElement.GetProperty("months");
        var month = months[months.GetArrayLength() - 1];

        Assert.Equal(3500m, month.GetProperty("total").GetDecimal());
        Assert.Equal(4500m, month.GetProperty("grossTotal").GetDecimal());

        var sources = month.GetProperty("sources").EnumerateArray().ToList();
        Assert.Equal(2, sources.Count);

        var conFuenteGroup = sources.First(s => s.GetProperty("sourceId").ValueKind != JsonValueKind.Null);
        Assert.Equal(sourceId, conFuenteGroup.GetProperty("sourceId").GetInt32());
        Assert.Equal("Empresa OVERVIEW", conFuenteGroup.GetProperty("sourceName").GetString());
        Assert.Equal(3000m, conFuenteGroup.GetProperty("total").GetDecimal());

        // D6: sin fuente asignada, el nombre se deriva de la categoría
        var sinFuenteGroup = sources.First(s => s.GetProperty("sourceId").ValueKind == JsonValueKind.Null);
        Assert.Equal("Ingresos test", sinFuenteGroup.GetProperty("sourceName").GetString());
        Assert.Equal(500m, sinFuenteGroup.GetProperty("total").GetDecimal());
    }
}

public class IncomeOverviewIsolationTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public IncomeOverviewIsolationTests(TestingApiFactory factory) => _factory = factory;

    [Fact]
    public async Task SoloVeLosIngresosDelUsuarioDelToken()
    {
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();

        var clientA = _factory.CreateClient();
        var tokenA = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        clientA.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenA);

        var clientB = _factory.CreateClient();
        var tokenB = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserB, Username = "userb", Role = "User" });
        clientB.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenB);

        var create = await clientA.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 700m,
            isRecurring = false,
            description = "Ingreso privado A",
            date = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 10),
            categoryId = TestingApiFactory.CategoryIngreso,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var response = await clientB.GetAsync("/api/Incomes/overview");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("Ingreso privado A", body);

        using var doc = JsonDocument.Parse(body);
        Assert.Equal(0, doc.RootElement.GetProperty("months").GetArrayLength());
    }
}
