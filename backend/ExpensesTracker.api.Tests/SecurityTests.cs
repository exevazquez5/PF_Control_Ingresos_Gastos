using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensesTracker.api.Tests;

public class SecurityTests : IClassFixture<TestingApiFactory>
{
    private readonly TestingApiFactory _factory;

    public SecurityTests(TestingApiFactory factory) => _factory = factory;

    private HttpClient ClientFor(int userId, string username, string role)
    {
        var client = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var tokenService = scope.ServiceProvider.GetRequiredService<ITokenService>();
        var token = tokenService.GenerateToken(new User { Id = userId, Username = username, Role = role });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private HttpClient UserAClient() => ClientFor(TestingApiFactory.UserA, "usera", "User");
    private HttpClient UserBClient() => ClientFor(TestingApiFactory.UserB, "userb", "User");
    private HttpClient AdminClient() => ClientFor(TestingApiFactory.AdminUser, "admin", "Admin");

    [Fact]
    public async Task GetCuotas_SinToken_Returns401()
    {
        var response = await _factory.CreateClient()
            .GetAsync($"/api/Expenses/cuotas/{TestingApiFactory.UserA}/2026/6");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetCuotas_CrossUser_Returns404()
    {
        var response = await UserBClient()
            .GetAsync($"/api/Expenses/cuotas/{TestingApiFactory.UserA}/2026/10");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCuotas_Propias_Returns200_SoloDatosPropios()
    {
        var response = await UserAClient()
            .GetAsync($"/api/Expenses/cuotas/{TestingApiFactory.UserA}/2026/6");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var items = doc.RootElement.EnumerateArray().ToList();
        Assert.NotEmpty(items);
        Assert.All(items, item =>
            Assert.StartsWith("gasto A", item.GetProperty("expenseDescription").GetString()));
    }

    [Fact]
    public async Task GetCuotasPagadas_SinToken_Returns401()
    {
        var response = await _factory.CreateClient()
            .GetAsync($"/api/Expenses/cuotas/pagadas/{TestingApiFactory.UserA}/2026/9");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetCuotasPagadas_CrossUser_Returns404()
    {
        var response = await UserBClient()
            .GetAsync($"/api/Expenses/cuotas/pagadas/{TestingApiFactory.UserA}/2026/9");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCuotasPagadas_Propias_Returns200_SoloDatosPropios()
    {
        var response = await UserAClient()
            .GetAsync($"/api/Expenses/cuotas/pagadas/{TestingApiFactory.UserA}/2026/9");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var items = doc.RootElement.EnumerateArray().ToList();
        Assert.NotEmpty(items);
        Assert.All(items, item =>
            Assert.StartsWith("gasto A", item.GetProperty("expenseDescription").GetString()));
    }

    [Fact]
    public async Task PagarTodasCuotas_SinToken_Returns401()
    {
        var response = await _factory.CreateClient()
            .PutAsync($"/api/Expenses/cuotas/pagar-todas/{TestingApiFactory.UserA}/2026/10", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PagarTodasCuotas_CrossUser_Returns404()
    {
        var response = await UserBClient()
            .PutAsync($"/api/Expenses/cuotas/pagar-todas/{TestingApiFactory.UserA}/2026/10", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PagarTodasCuotas_Propias_PagaSoloPendientesDelMes()
    {
        var response = await UserAClient()
            .PutAsync($"/api/Expenses/cuotas/pagar-todas/{TestingApiFactory.UserA}/2026/10", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(2, doc.RootElement.GetProperty("cuotasPagadas").GetInt32());
    }

    [Fact]
    public async Task MarcarCuotaPagada_SinToken_Returns401()
    {
        var response = await _factory.CreateClient()
            .PutAsync($"/api/Expenses/cuotas/{TestingApiFactory.CuotaParaPagar}/pagar", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MarcarCuotaPagada_CrossUser_Returns404()
    {
        var response = await UserBClient()
            .PutAsync($"/api/Expenses/cuotas/{TestingApiFactory.CuotaParaPagar}/pagar", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MarcarCuotaPagada_Propia_Returns200()
    {
        var response = await UserAClient()
            .PutAsync($"/api/Expenses/cuotas/{TestingApiFactory.CuotaParaPagar}/pagar", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RestoreExpense_SinToken_Returns401()
    {
        var response = await _factory.CreateClient()
            .PostAsync($"/api/Expenses/{TestingApiFactory.ExpenseArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RestoreExpense_CrossUser_Returns404()
    {
        var response = await UserBClient()
            .PostAsync($"/api/Expenses/{TestingApiFactory.ExpenseArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RestoreExpense_Propio_Returns204()
    {
        var response = await UserAClient()
            .PostAsync($"/api/Expenses/{TestingApiFactory.ExpenseArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task RestoreExpense_Admin_DeOtroUsuario_Returns204()
    {
        var response = await AdminClient()
            .PostAsync($"/api/Expenses/{TestingApiFactory.ExpenseArchivedC}/restore", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task RestoreBudget_SinToken_Returns401()
    {
        var response = await _factory.CreateClient()
            .PostAsync($"/api/Budgets/{TestingApiFactory.BudgetArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RestoreBudget_CrossUser_Returns404()
    {
        var response = await UserBClient()
            .PostAsync($"/api/Budgets/{TestingApiFactory.BudgetArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RestoreBudget_Propio_Returns204()
    {
        var response = await UserAClient()
            .PostAsync($"/api/Budgets/{TestingApiFactory.BudgetArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task RestoreBudget_Admin_CrossUser_Returns404()
    {
        var response = await AdminClient()
            .PostAsync($"/api/Budgets/{TestingApiFactory.BudgetArchivedC}/restore", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RestoreIncome_SinToken_Returns401()
    {
        var response = await _factory.CreateClient()
            .PostAsync($"/api/Incomes/{TestingApiFactory.IncomeArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RestoreIncome_CrossUser_Returns404()
    {
        var response = await UserBClient()
            .PostAsync($"/api/Incomes/{TestingApiFactory.IncomeArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RestoreIncome_Propio_Returns204()
    {
        var response = await UserAClient()
            .PostAsync($"/api/Incomes/{TestingApiFactory.IncomeArchivedA}/restore", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task RestoreIncome_Admin_DeOtroUsuario_Returns204()
    {
        var response = await AdminClient()
            .PostAsync($"/api/Incomes/{TestingApiFactory.IncomeArchivedC}/restore", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
