using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

public class DiscountRuleTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public DiscountRuleTests(TestingApiFactory factory) => _factory = factory;

    private HttpClient UserAClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<int> CreateSourceAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/IncomeSources", new { name, mode = "neto" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task SinToken_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/DiscountRules");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_FijaY_Porcentaje_DeOk()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa REGLAS");

        var fija = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Obra social",
            fixedAmount = 2500m,
            isExpected = false,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, fija.StatusCode);

        var porcentaje = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Jubilación",
            percentage = 11m,
            isExpected = false,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, porcentaje.StatusCode);

        var list = await client.GetAsync($"/api/DiscountRules?sourceId={sourceId}");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        using var doc = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        Assert.Equal(2, doc.RootElement.GetArrayLength());

        var jubilacion = doc.RootElement.EnumerateArray().First(r => r.GetProperty("name").GetString() == "Jubilación");
        Assert.Equal(11m, jubilacion.GetProperty("percentage").GetDecimal());
        Assert.Equal(JsonValueKind.Null, jubilacion.GetProperty("fixedAmount").ValueKind);
    }

    [Fact]
    public async Task Create_AmbosOVacio_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa VALIDA");

        var mensajeEsperado = "Solo se puede indicar un porcentaje o un monto fijo.";

        var ambos = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Ambos",
            percentage = 10m,
            fixedAmount = 100m,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.BadRequest, ambos.StatusCode);
        Assert.Contains(mensajeEsperado, await ambos.Content.ReadAsStringAsync());

        var ninguno = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Ninguno",
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.BadRequest, ninguno.StatusCode);
        Assert.Contains(mensajeEsperado, await ninguno.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_PorcentajeInvalido_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa PCT");

        var response = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Demasiado",
            percentage = 100m,
            userId = TestingApiFactory.UserA
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("El porcentaje debe ser mayor a 0 y menor a 100.", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_NombreRepetidoEnFuente_Returns400()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa NOMBRE");

        var first = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Jubilación",
            percentage = 10m,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Jubilación",
            percentage = 12m,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Contains("Ya existe una regla con ese nombre en esta fuente.", await second.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_IgnoraUserIdDelDto_YUsaElDelToken()
    {
        var client = UserAClient();
        var sourceId = await CreateSourceAsync(client, "Empresa TOKEN");

        var response = await client.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Aportes",
            percentage = 5m,
            userId = 999
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(TestingApiFactory.UserA, doc.RootElement.GetProperty("userId").GetInt32());
    }

    [Fact]
    public async Task Create_FuenteDeOtroUsuario_Returns404()
    {
        var clientA = UserAClient();
        var sourceId = await CreateSourceAsync(clientA, "Empresa AJENA");

        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var clientB = _factory.CreateClient();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserB, Username = "userb", Role = "User" });
        clientB.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await clientB.PostAsJsonAsync("/api/DiscountRules", new
        {
            incomeSourceId = sourceId,
            name = "Robada",
            percentage = 5m,
            userId = TestingApiFactory.UserB
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("La fuente de ingreso no existe.", await response.Content.ReadAsStringAsync());
    }
}
