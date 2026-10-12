using ExpensesTracker.api.Data;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Data;

namespace ExpensesTracker.api.Tests;

public class TestingApiFactory : WebApplicationFactory<Program>
{
    static TestingApiFactory()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("Jwt__Key", "clave-de-firma-para-tests-de-integracion-0123456789");
    }

    public const int UserA = 1;
    public const int UserB = 2;
    public const int AdminUser = 3;
    public const int CategoryGasto = 1;
    public const int CategoryIngreso = 2;

    public const int ExpenseArchivedA = 10;
    public const int ExpenseArchivedB = 11;
    public const int ExpenseActiveA = 12;
    public const int ExpenseActiveB = 13;
    public const int ExpenseArchivedC = 14;

    public const int CuotaPendingA = 20;
    public const int CuotaPagadaA = 21;
    public const int CuotaPendingB = 22;
    public const int CuotaPendingA2 = 23;
    public const int CuotaParaPagar = 24;
    public const int CuotaOwnList = 25;

    public const int BudgetArchivedA = 30;
    public const int BudgetArchivedB = 31;
    public const int BudgetArchivedC = 32;

    public const int IncomeArchivedA = 40;
    public const int IncomeArchivedB = 41;
    public const int IncomeArchivedC = 42;

    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private bool _initialized;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(WebHostDefaults.EnvironmentKey, "Testing");

        builder.ConfigureServices(services =>
        {
            var toRemove = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>) ||
                (d.ServiceType.IsGenericType &&
                 d.ServiceType.GetGenericTypeDefinition() == typeof(IDbContextOptionsConfiguration<>))).ToList();

            foreach (var descriptor in toRemove)
                services.Remove(descriptor);

            services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        var host = base.CreateHost(builder);

        if (!_initialized)
        {
            if (_connection.State == ConnectionState.Closed)
                _connection.Open();

            using var scope = host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.EnsureCreated();
            Seed(db);
            _initialized = true;
        }

        return host;
    }

    private static void Seed(AppDbContext db)
    {
        var now = new DateTime(2026, 10, 1, 12, 0, 0);

        db.Users.AddRange(
            new User { Id = UserA, Username = "usera", Email = "usera@test.com", PasswordHash = new byte[] { 0 }, PasswordSalt = new byte[] { 0 }, Role = "User" },
            new User { Id = UserB, Username = "userb", Email = "userb@test.com", PasswordHash = new byte[] { 0 }, PasswordSalt = new byte[] { 0 }, Role = "User" },
            new User { Id = AdminUser, Username = "admin", Email = "admin@test.com", PasswordHash = new byte[] { 0 }, PasswordSalt = new byte[] { 0 }, Role = "Admin" });

        db.Categories.AddRange(
            new Category { Id = CategoryGasto, Name = "Gastos test", Type = "gasto", IsSystem = true, CreatedAt = now },
            new Category { Id = CategoryIngreso, Name = "Ingresos test", Type = "ingreso", IsSystem = true, CreatedAt = now });

        db.Expenses.AddRange(
            new Expense { Id = ExpenseArchivedA, Amount = 1000m, Description = "gasto A archivado", Date = now, CategoryId = CategoryGasto, UserId = UserA, IsDeleted = true, DeletedAt = now },
            new Expense { Id = ExpenseArchivedB, Amount = 2000m, Description = "gasto B archivado", Date = now, CategoryId = CategoryGasto, UserId = UserB, IsDeleted = true, DeletedAt = now },
            new Expense { Id = ExpenseArchivedC, Amount = 3000m, Description = "gasto A archivado admin", Date = now, CategoryId = CategoryGasto, UserId = UserA, IsDeleted = true, DeletedAt = now },
            new Expense { Id = ExpenseActiveA, Amount = 4000m, Description = "gasto A cuotas", Date = now, CategoryId = CategoryGasto, UserId = UserA },
            new Expense { Id = ExpenseActiveB, Amount = 5000m, Description = "gasto B cuotas", Date = now, CategoryId = CategoryGasto, UserId = UserB });

        db.PagosCuotas.AddRange(
            new PagoCuota { Id = CuotaPendingA, ExpenseId = ExpenseActiveA, NroCuota = 1, MontoCuota = 500m, DueDate = new DateTime(2026, 10, 15), Status = PagoCuotaStatus.Pending },
            new PagoCuota { Id = CuotaPendingA2, ExpenseId = ExpenseActiveA, NroCuota = 2, MontoCuota = 500m, DueDate = new DateTime(2026, 10, 16), Status = PagoCuotaStatus.Pending },
            new PagoCuota { Id = CuotaPagadaA, ExpenseId = ExpenseActiveA, NroCuota = 3, MontoCuota = 500m, DueDate = new DateTime(2026, 9, 15), PaidAt = new DateTime(2026, 9, 10), Status = PagoCuotaStatus.Paid },
            new PagoCuota { Id = CuotaPendingB, ExpenseId = ExpenseActiveB, NroCuota = 1, MontoCuota = 700m, DueDate = new DateTime(2026, 10, 20), Status = PagoCuotaStatus.Pending },
            new PagoCuota { Id = CuotaParaPagar, ExpenseId = ExpenseActiveA, NroCuota = 4, MontoCuota = 400m, DueDate = new DateTime(2026, 11, 15), Status = PagoCuotaStatus.Pending },
            new PagoCuota { Id = CuotaOwnList, ExpenseId = ExpenseActiveA, NroCuota = 5, MontoCuota = 300m, DueDate = new DateTime(2026, 6, 15), Status = PagoCuotaStatus.Pending });

        db.Budgets.AddRange(
            new Budget { Id = BudgetArchivedA, UserId = UserA, Period = "2026-08", PeriodStart = new DateTime(2026, 8, 1), PeriodEnd = new DateTime(2026, 8, 31), TotalAmount = 100000m, CreatedAt = now, UpdatedAt = now, IsDeleted = true, DeletedAt = now },
            new Budget { Id = BudgetArchivedB, UserId = UserB, Period = "2026-08", PeriodStart = new DateTime(2026, 8, 1), PeriodEnd = new DateTime(2026, 8, 31), TotalAmount = 200000m, CreatedAt = now, UpdatedAt = now, IsDeleted = true, DeletedAt = now },
            new Budget { Id = BudgetArchivedC, UserId = UserA, Period = "2026-07", PeriodStart = new DateTime(2026, 7, 1), PeriodEnd = new DateTime(2026, 7, 31), TotalAmount = 150000m, CreatedAt = now, UpdatedAt = now, IsDeleted = true, DeletedAt = now });

        db.Incomes.AddRange(
            new Income { Id = IncomeArchivedA, Amount = 900m, Description = "ingreso A archivado", Date = now, CategoryId = CategoryIngreso, UserId = UserA, IsDeleted = true, DeletedAt = now },
            new Income { Id = IncomeArchivedB, Amount = 800m, Description = "ingreso B archivado", Date = now, CategoryId = CategoryIngreso, UserId = UserB, IsDeleted = true, DeletedAt = now },
            new Income { Id = IncomeArchivedC, Amount = 700m, Description = "ingreso A archivado admin", Date = now, CategoryId = CategoryIngreso, UserId = UserA, IsDeleted = true, DeletedAt = now });

        db.SaveChanges();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            _connection.Dispose();
    }
}
