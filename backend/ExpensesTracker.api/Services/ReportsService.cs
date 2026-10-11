using ExpensesTracker.api.Data;
using ExpensesTracker.api.DTOs.NewFolder;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;


namespace ExpensesTracker.api.Services
{
    public class ReportService : IReportService
    {
        private readonly AppDbContext _context;

        public ReportService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<MonthlySummaryDto>> GetMonthlySummaryAsync()
        {
            var incomes = await _context.Incomes
                .GroupBy(i => new { i.Date.Year, i.Date.Month })
                .Select(g => new {
                    g.Key.Year,
                    g.Key.Month,
                    Ingresos = g.Sum(i => i.Amount)
                })
                .ToListAsync();

            var cuotasPagadas = await _context.PagosCuotas
                .Where(pc => pc.Status == PagoCuotaStatus.Paid && pc.PaidAt.HasValue && !pc.Expense.IsDeleted)
                .GroupBy(pc => new { pc.PaidAt!.Value.Year, pc.PaidAt!.Value.Month })
                .Select(g => new {
                    g.Key.Year,
                    g.Key.Month,
                    Gastos = g.Sum(pc => pc.MontoCuota)
                })
                .ToListAsync();

            var gastosDirectos = await _context.Expenses
                .Where(e => !_context.PagosCuotas.Any(pc => pc.ExpenseId == e.Id))
                .GroupBy(e => new { e.Date.Year, e.Date.Month })
                .Select(g => new {
                    g.Key.Year,
                    g.Key.Month,
                    Gastos = g.Sum(e => e.Amount)
                })
                .ToListAsync();

            var allData = incomes
                .Select(i => new { i.Year, i.Month, i.Ingresos, Gastos = 0m })
                .Concat(cuotasPagadas.Select(c => new { c.Year, c.Month, Ingresos = 0m, c.Gastos }))
                .Concat(gastosDirectos.Select(g => new { g.Year, g.Month, Ingresos = 0m, g.Gastos }));

            return allData
                .GroupBy(x => new { x.Year, x.Month })
                .Select(g => new MonthlySummaryDto
                {
                    Year = g.Key.Year,
                    Month = g.Key.Month,
                    Ingresos = g.Sum(x => x.Ingresos),
                    Gastos = g.Sum(x => x.Gastos)
                })
                .OrderBy(x => x.Year)
                .ThenBy(x => x.Month)
                .ToList();
        }


        public async Task<List<MonthlySummaryDto>> GetMonthlySummaryByUserAsync(int userId)
        {
            var incomes = await _context.Incomes
                .Where(i => i.UserId == userId)
                .GroupBy(i => new { i.Date.Year, i.Date.Month })
                .Select(g => new {
                    g.Key.Year,
                    g.Key.Month,
                    Ingresos = g.Sum(i => i.Amount)
                })
                .ToListAsync();

            var cuotasPagadas = await _context.PagosCuotas
                .Where(pc => pc.Status == PagoCuotaStatus.Paid && pc.PaidAt.HasValue && pc.Expense.UserId == userId && !pc.Expense.IsDeleted)
                .GroupBy(pc => new { pc.PaidAt!.Value.Year, pc.PaidAt!.Value.Month })
                .Select(g => new {
                    g.Key.Year,
                    g.Key.Month,
                    Gastos = g.Sum(pc => pc.MontoCuota)
                })
                .ToListAsync();

            var gastosDirectos = await _context.Expenses
                .Where(e => e.UserId == userId && !_context.PagosCuotas.Any(pc => pc.ExpenseId == e.Id))
                .GroupBy(e => new { e.Date.Year, e.Date.Month })
                .Select(g => new {
                    g.Key.Year,
                    g.Key.Month,
                    Gastos = g.Sum(e => e.Amount)
                })
                .ToListAsync();

            var allData = incomes
                .Select(i => new { i.Year, i.Month, i.Ingresos, Gastos = 0m })
                .Concat(cuotasPagadas.Select(c => new { c.Year, c.Month, Ingresos = 0m, c.Gastos }))
                .Concat(gastosDirectos.Select(g => new { g.Year, g.Month, Ingresos = 0m, g.Gastos }));

            return allData
                .GroupBy(x => new { x.Year, x.Month })
                .Select(g => new MonthlySummaryDto
                {
                    Year = g.Key.Year,
                    Month = g.Key.Month,
                    Ingresos = g.Sum(x => x.Ingresos),
                    Gastos = g.Sum(x => x.Gastos)
                })
                .OrderBy(x => x.Year)
                .ThenBy(x => x.Month)
                .ToList();
        }


    }

}
