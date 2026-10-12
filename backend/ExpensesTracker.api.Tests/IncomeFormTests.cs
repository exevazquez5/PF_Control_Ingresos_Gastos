using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExpensesTracker.api.Controllers;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

public class IncomeFormTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public IncomeFormTests(TestingApiFactory factory) => _factory = factory;

    private HttpClient UserAClient()
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = TestingApiFactory.UserA, Username = "usera", Role = "User" });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static object NewIncome(decimal amount, decimal? grossAmount = null, bool isRecurring = false) => new
    {
        amount,
        grossAmount,
        isRecurring,
        description = "Sueldo octubre",
        date = new DateTime(2026, 10, 1),
        categoryId = TestingApiFactory.CategoryIngreso,
        userId = TestingApiFactory.UserA
    };

    [Fact]
    public void MaxAmountMessage_EsElLiteralDelFrontend()
    {
        Assert.Equal("El monto no puede exceder $10,000,000", IncomesController.MaxAmountMessage);
        Assert.Equal(10000000m, IncomesController.MaxAmount);
    }

    [Fact]
    public async Task Create_MontoMayorAlLimite_Returns400_ConMensajeExacto()
    {
        var client = UserAClient();

        var response = await client.PostAsJsonAsync("/api/Incomes", NewIncome(10000001m));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains(IncomesController.MaxAmountMessage, body);
    }

    [Fact]
    public async Task Create_MontoIgualAlLimite_CreaOk()
    {
        var client = UserAClient();

        var response = await client.PostAsJsonAsync("/api/Incomes", NewIncome(10000000m));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Create_ConBrutoYRecurrente_PersisteYDevuelveLosCampos()
    {
        var client = UserAClient();

        var response = await client.PostAsJsonAsync("/api/Incomes", NewIncome(1000m, grossAmount: 1500m, isRecurring: true));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var created = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(1500m, created.RootElement.GetProperty("grossAmount").GetDecimal());
        Assert.True(created.RootElement.GetProperty("isRecurring").GetBoolean());

        var id = created.RootElement.GetProperty("id").GetInt32();

        var get = await client.GetAsync($"/api/Incomes/{id}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);

        using var fetched = JsonDocument.Parse(await get.Content.ReadAsStringAsync());
        Assert.Equal(1500m, fetched.RootElement.GetProperty("grossAmount").GetDecimal());
        Assert.True(fetched.RootElement.GetProperty("isRecurring").GetBoolean());
    }

    [Fact]
    public async Task Create_SinBruto_GrossAmountNulo()
    {
        var client = UserAClient();

        var response = await client.PostAsJsonAsync("/api/Incomes", NewIncome(500m));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var created = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Null, created.RootElement.GetProperty("grossAmount").ValueKind);
        Assert.False(created.RootElement.GetProperty("isRecurring").GetBoolean());
    }

    [Fact]
    public async Task Update_MontoMayorAlLimite_Returns400_ConMensajeExacto()
    {
        var client = UserAClient();

        var create = await client.PostAsJsonAsync("/api/Incomes", NewIncome(700m));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        var id = created.RootElement.GetProperty("id").GetInt32();

        var update = await client.PutAsJsonAsync($"/api/Incomes/{id}", new
        {
            id,
            amount = 10000001m,
            grossAmount = (decimal?)null,
            isRecurring = false,
            description = "Sueldo octubre",
            date = new DateTime(2026, 10, 1),
            categoryId = TestingApiFactory.CategoryIngreso,
            userId = TestingApiFactory.UserA
        });

        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        var body = await update.Content.ReadAsStringAsync();
        Assert.Contains(IncomesController.MaxAmountMessage, body);
    }
}
