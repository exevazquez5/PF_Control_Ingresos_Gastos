using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

public class IncomeSourceTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public IncomeSourceTests(TestingApiFactory factory) => _factory = factory;

    private HttpClient UserAClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private HttpClient UserBClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserB, Username = "userb", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<(int Id, string Name)> CreateSourceAsync(HttpClient client, string name, string mode = "neto")
    {
        var response = await client.PostAsJsonAsync("/api/IncomeSources", new { name, mode });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (doc.RootElement.GetProperty("id").GetInt32(), doc.RootElement.GetProperty("name").GetString()!);
    }

    [Fact]
    public async Task SinToken_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/IncomeSources");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Create_DefaultNeto_ListaOk()
    {
        var client = UserAClient();

        var (id, name) = await CreateSourceAsync(client, "Empresa ACME");

        Assert.Equal("Empresa ACME", name);

        var list = await client.GetAsync("/api/IncomeSources");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);

        using var doc = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        var source = doc.RootElement.EnumerateArray()
            .FirstOrDefault(s => s.GetProperty("id").GetInt32() == id);
        Assert.Equal("neto", source.GetProperty("mode").GetString());
        Assert.Equal(0, source.GetProperty("aliases").GetArrayLength());
    }

    [Fact]
    public async Task Create_NombreRepetido_Returns400()
    {
        var client = UserAClient();
        await CreateSourceAsync(client, "Empresa DUP");

        var response = await client.PostAsJsonAsync("/api/IncomeSources", new { name = "Empresa DUP", mode = "neto" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Ya existe una fuente o alias con ese nombre.", body);
    }

    [Fact]
    public async Task Create_ModoBruto_SePersiste()
    {
        var client = UserAClient();

        var response = await client.PostAsJsonAsync("/api/IncomeSources", new { name = "Empresa BRUTO", mode = "bruto" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("bruto", doc.RootElement.GetProperty("mode").GetString());
    }

    [Fact]
    public async Task Create_ModoInvalido_Returns400()
    {
        var client = UserAClient();

        var response = await client.PostAsJsonAsync("/api/IncomeSources", new { name = "Empresa MODO", mode = "mixto" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("El modo debe ser \"neto\" o \"bruto\".", body);
    }

    [Fact]
    public async Task Rename_ViejoNombreQuedaComoAlias_D11()
    {
        var client = UserAClient();
        var (id, _) = await CreateSourceAsync(client, "Empresa RENAME");

        var rename = await client.PutAsJsonAsync($"/api/IncomeSources/{id}", new { name = "Empresa RENOMBRADA", mode = "neto" });
        Assert.Equal(HttpStatusCode.NoContent, rename.StatusCode);

        var list = await client.GetAsync("/api/IncomeSources");
        using var doc = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        var source = doc.RootElement.EnumerateArray().First(s => s.GetProperty("id").GetInt32() == id);
        Assert.Equal("Empresa RENOMBRADA", source.GetProperty("name").GetString());

        var aliases = source.GetProperty("aliases").EnumerateArray().Select(a => a.GetString()).ToList();
        Assert.Contains("Empresa RENAME", aliases);
    }

    [Fact]
    public async Task Rename_ANombreTomado_Returns400()
    {
        var client = UserAClient();
        await CreateSourceAsync(client, "Empresa UNO");
        var (idDos, _) = await CreateSourceAsync(client, "Empresa DOS");

        var rename = await client.PutAsJsonAsync($"/api/IncomeSources/{idDos}", new { name = "Empresa UNO", mode = "neto" });

        Assert.Equal(HttpStatusCode.BadRequest, rename.StatusCode);
        var body = await rename.Content.ReadAsStringAsync();
        Assert.Contains("Ya existe una fuente o alias con ese nombre.", body);
    }

    [Fact]
    public async Task Merge_ReasignaIncomesYDejaAlias_D11()
    {
        var client = UserAClient();
        var (sourceId, _) = await CreateSourceAsync(client, "Empresa MERGE-VIEJA");
        var (targetId, _) = await CreateSourceAsync(client, "Empresa MERGE-NUEVA");

        var createIncome = await client.PostAsJsonAsync("/api/Incomes", new
        {
            amount = 2000m,
            isRecurring = true,
            description = "Sueldo merge test",
            date = DateTime.Today,
            categoryId = TestingApiFactory.CategoryIngreso,
            sourceId,
            userId = TestingApiFactory.UserA
        });
        Assert.Equal(HttpStatusCode.Created, createIncome.StatusCode);
        using var createdDoc = JsonDocument.Parse(await createIncome.Content.ReadAsStringAsync());
        var incomeId = createdDoc.RootElement.GetProperty("id").GetInt32();
        Assert.Equal(sourceId, createdDoc.RootElement.GetProperty("sourceId").GetInt32());

        var merge = await client.PostAsJsonAsync("/api/IncomeSources/merge", new { sourceId, targetSourceId = targetId });
        Assert.Equal(HttpStatusCode.NoContent, merge.StatusCode);

        var income = await client.GetAsync($"/api/Incomes/{incomeId}");
        Assert.Equal(HttpStatusCode.OK, income.StatusCode);
        using var incomeDoc = JsonDocument.Parse(await income.Content.ReadAsStringAsync());
        Assert.Equal(targetId, incomeDoc.RootElement.GetProperty("sourceId").GetInt32());
        Assert.Equal("Empresa MERGE-NUEVA", incomeDoc.RootElement.GetProperty("sourceName").GetString());

        var merged = await client.GetAsync($"/api/IncomeSources/{sourceId}");
        Assert.Equal(HttpStatusCode.NotFound, merged.StatusCode);

        var list = await client.GetAsync("/api/IncomeSources");
        using var listDoc = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        var target = listDoc.RootElement.EnumerateArray().First(s => s.GetProperty("id").GetInt32() == targetId);
        var aliases = target.GetProperty("aliases").EnumerateArray().Select(a => a.GetString()).ToList();
        Assert.Contains("Empresa MERGE-VIEJA", aliases);
    }

    [Fact]
    public async Task OtroUsuario_NoPuedeModificarMiFuente()
    {
        var clientA = UserAClient();
        var clientB = UserBClient();
        var (id, _) = await CreateSourceAsync(clientA, "Empresa PROPIA");

        var renameByB = await clientB.PutAsJsonAsync($"/api/IncomeSources/{id}", new { name = "Robada", mode = "neto" });
        Assert.Equal(HttpStatusCode.NotFound, renameByB.StatusCode);

        var archiveByB = await clientB.PostAsync($"/api/IncomeSources/{id}/archive", null);
        Assert.Equal(HttpStatusCode.NotFound, archiveByB.StatusCode);

        var listB = await clientB.GetAsync("/api/IncomeSources");
        using var doc = JsonDocument.Parse(await listB.Content.ReadAsStringAsync());
        Assert.DoesNotContain(doc.RootElement.EnumerateArray(), s => s.GetProperty("name").GetString() == "Empresa PROPIA");
    }
}
