using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

public class IncomeSourceSnapshotTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public IncomeSourceSnapshotTests(TestingApiFactory factory) => _factory = factory;

    private HttpClient UserAClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<int> CreateSourceAsync(HttpClient client, string name, string mode)
    {
        var response = await client.PostAsJsonAsync("/api/IncomeSources", new { name, mode });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Create_SinModoExplicito_SnapshoteaModoDeLaFuente_D1()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa SNAP-NETO", "neto");

        var response = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 1000m,
            grossAmount = 1500m,
            isRecurring = false,
            description = "Snapshot neto",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            userId = TestingApiFactory.UserA
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("neto", doc.RootElement.GetProperty("mode").GetString());
        Assert.Equal(sourceId, doc.RootElement.GetProperty("sourceId").GetInt32());
        Assert.Equal("Empresa SNAP-NETO", doc.RootElement.GetProperty("sourceName").GetString());
    }

    [Fact]
    public async Task Create_FuenteBruto_SinBruto_SeGuardaComoBruto_3_5a()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa SNAP-BRUTO", "bruto");

        var response = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 1000m,
            isRecurring = false,
            description = "Sin bruto en modo bruto",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            userId = TestingApiFactory.UserA
        });

        // 3.5a: en modo Bruto lo depositado ES el bruto → no se exige ni se guarda GrossAmount.
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("bruto", doc.RootElement.GetProperty("mode").GetString());
        Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("grossAmount").ValueKind);
    }

    [Fact]
    public async Task Create_FuenteBruto_ConBruto_LoDescarta_3_5a()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa SNAP-BRUTO2", "bruto");

        var response = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 1000m,
            grossAmount = 1400m,
            isRecurring = false,
            description = "Con bruto en modo bruto",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            userId = TestingApiFactory.UserA
        });

        // 3.5a: en modo Bruto se ignora el GrossAmount del recibo (lo depositado es el bruto).
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("bruto", doc.RootElement.GetProperty("mode").GetString());
        Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("grossAmount").ValueKind);
    }

    [Fact]
    public async Task Create_ModoExplicito_OverrideaElDeLaFuente_D1()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa SNAP-OVERRIDE", "bruto");

        var response = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 1000m,
            isRecurring = false,
            description = "Override a neto",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            mode = "neto",
            userId = TestingApiFactory.UserA
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("neto", doc.RootElement.GetProperty("mode").GetString());
    }

    [Fact]
    public async Task Create_BrutoMenorQueDepositado_Returns400()
    {
        var client = UserAClient();

        var response = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 1000m,
            grossAmount = 900m,
            isRecurring = false,
            description = "Bruto menor",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            userId = TestingApiFactory.UserA
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("El bruto debe ser mayor o igual al monto depositado.", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_FuenteDeOtroUsuario_Returns400()
    {
        var clientA = UserAClient();
        var sourceId = await CreateSourceAsync(clientA, "Empresa AJENA SNAP", "neto");

        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var client = _factory.CreateClient();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserB, Username = "userb", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 1000m,
            isRecurring = false,
            description = "Fuente ajena",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            userId = TestingApiFactory.UserB
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("La fuente de ingreso no existe.", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_ConSourceName_CreaOReutilizaFuenteImplicita()
    {
        var client = UserAClient();

        var first = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 800m,
            isRecurring = false,
            description = "Fuente implicita uno",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceName = "Empresa IMPL",
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        int sourceId;
        using (var doc = JsonDocument.Parse(await first.Content.ReadAsStringAsync()))
        {
            sourceId = doc.RootElement.GetProperty("sourceId").GetInt32();
            Assert.Equal("Empresa IMPL", doc.RootElement.GetProperty("sourceName").GetString());
            Assert.Equal("neto", doc.RootElement.GetProperty("mode").GetString());
        }

        var second = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 850m,
            isRecurring = false,
            description = "Fuente implicita dos",
            date = new DateTime(2026, 10, 2),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceName = "Empresa IMPL",
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);

        using var secondDoc = JsonDocument.Parse(await second.Content.ReadAsStringAsync());
        Assert.Equal(sourceId, secondDoc.RootElement.GetProperty("sourceId").GetInt32());
    }

    [Fact]
    public async Task Update_CambiaFuenteYModo()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa UPDATE", "neto");

        var create = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 500m,
            isRecurring = false,
            description = "Update fuente",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        using var createdDoc = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        var id = createdDoc.RootElement.GetProperty("id").GetInt32();

        var update = await client.PutAsJsonAsync($"/api/Incomes/{id}", new
        {
            id,
            amount = 500m,
            isRecurring = false,
            description = "Update fuente",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            mode = "neto",
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var get = await client.GetAsync($"/api/Incomes/{id}");
        using var doc = JsonDocument.Parse(await get.Content.ReadAsStringAsync());
        Assert.Equal(sourceId, doc.RootElement.GetProperty("sourceId").GetInt32());
        Assert.Equal("Empresa UPDATE", doc.RootElement.GetProperty("sourceName").GetString());
        Assert.Equal("neto", doc.RootElement.GetProperty("mode").GetString());
    }

    [Fact]
    public async Task Update_ConSourceName_CreaFuenteYLaAsociaAlIngreso()
    {
        var client = UserAClient();
        var create = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 1800000m,
            isRecurring = false,
            description = "Sueldo historico",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        using var createdDoc = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        var id = createdDoc.RootElement.GetProperty("id").GetInt32();

        var update = await client.PutAsJsonAsync($"/api/Incomes/{id}", new
        {
            id,
            amount = 1800000m,
            isRecurring = false,
            description = "Sueldo historico",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceName = "Sueldo PS",
            mode = "bruto",
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);

        var get = await client.GetAsync($"/api/Incomes/{id}");
        using var doc = JsonDocument.Parse(await get.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.GetProperty("sourceId").GetInt32() > 0);
        Assert.Equal("Sueldo PS", doc.RootElement.GetProperty("sourceName").GetString());
        Assert.Equal("bruto", doc.RootElement.GetProperty("mode").GetString());

        var sources = await client.GetAsync("/api/IncomeSources");
        using var sourcesDoc = JsonDocument.Parse(await sources.Content.ReadAsStringAsync());
        Assert.Contains(sourcesDoc.RootElement.EnumerateArray(), source => source.GetProperty("name").GetString() == "Sueldo PS");
    }
}
