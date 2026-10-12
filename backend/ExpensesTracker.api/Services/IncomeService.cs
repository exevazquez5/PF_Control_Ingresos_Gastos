using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;
using ExpensesTracker.api.Data;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class IncomeService : IIncomeService
{
    private readonly AppDbContext _context;

    public IncomeService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Income>> GetAllAsync()
    {
        return await _context.Incomes
            .Include(i => i.Category)
            .Include(i => i.User)
            .Include(i => i.Source)
            .ToListAsync();
    }

    public async Task<Income?> GetById(int id)
    {
        return await _context.Incomes
            .Include(i => i.Category)
            .Include(i => i.User)
            .Include(i => i.Source)
            .FirstOrDefaultAsync(i => i.Id == id);
    }

    public async Task<List<Income>> GetByUserId(int userId)
    {
        return await _context.Incomes
            .Include(i => i.Category)
            .Include(i => i.User)
            .Include(i => i.Source)
            .Where(i => i.UserId == userId)
            .ToListAsync();
    }

    public async Task<Income> Create(Income income)
    {
        _context.Incomes.Add(income);
        await _context.SaveChangesAsync();

        return await _context.Incomes
            .Include(i => i.Category)
            .Include(i => i.User)
            .Include(i => i.Source)
            .FirstOrDefaultAsync(i => i.Id == income.Id);
    }

    public async Task<bool> Update(Income income)
    {
        var existingIncome = await _context.Incomes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == income.Id);
        if (existingIncome == null) return false;

        existingIncome.Amount = income.Amount;
        existingIncome.GrossAmount = income.GrossAmount;
        existingIncome.IsRecurring = income.IsRecurring;
        existingIncome.Description = income.Description;
        existingIncome.Date = income.Date;
        existingIncome.CategoryId = income.CategoryId;
        existingIncome.SourceId = income.SourceId;
        existingIncome.Mode = income.Mode;
        existingIncome.UserId = income.UserId;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task Delete(int id)
    {
        var income = await _context.Incomes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == id);
        if (income != null)
        {
            _context.Incomes.Remove(income);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<object> GetSummaryByUser(int userId)
    {
        var totalIncome = await _context.Incomes
            .Where(i => i.UserId == userId)
            .SumAsync(i => i.Amount);

        var totalExpenses = await _context.Expenses
            .Where(e => e.UserId == userId)
            .SumAsync(e => e.Amount);

        return new
        {
            TotalIncome = totalIncome,
            TotalExpenses = totalExpenses,
            Balance = totalIncome - totalExpenses
        };
    }

    public async Task<List<Income>> Filter(int? userId, int? categoryId, DateTime? from, DateTime? to)
    {
        var query = _context.Incomes.AsQueryable();

        if (userId.HasValue)
            query = query.Where(i => i.UserId == userId);

        if (categoryId.HasValue)
            query = query.Where(i => i.CategoryId == categoryId);

        if (from.HasValue)
            query = query.Where(i => i.Date >= from);

        if (to.HasValue)
            query = query.Where(i => i.Date <= to);

        return await query
            .Include(i => i.Category)
            .Include(i => i.User)
            .Include(i => i.Source)
            .ToListAsync();
    }

    public async Task<object> GetOverviewAsync(int userId)
    {
        var incomes = await _context.Incomes
            .Include(i => i.Category)
            .Include(i => i.Source)
            .Where(i => i.UserId == userId)
            .ToListAsync();

        var currentMonth = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);

        if (incomes.Count == 0)
        {
            return new
            {
                FirstIncomeMonth = (DateTime?)null,
                CurrentMonth = currentMonth,
                Months = Array.Empty<object>()
            };
        }

        // D7: meses vacíos solo entre el primer ingreso y el fin (mes actual o último ingreso)
        var firstIncomeMonth = incomes.Min(i => new DateTime(i.Date.Year, i.Date.Month, 1));
        var lastIncomeMonth = incomes.Max(i => new DateTime(i.Date.Year, i.Date.Month, 1));
        var endMonth = lastIncomeMonth > currentMonth ? lastIncomeMonth : currentMonth;

        var months = new List<object>();
        for (var month = firstIncomeMonth; month <= endMonth; month = month.AddMonths(1))
        {
            var monthIncomes = incomes
                .Where(i => i.Date.Year == month.Year && i.Date.Month == month.Month)
                .ToList();

            var sources = monthIncomes
                .GroupBy(i => new
                {
                    i.SourceId,
                    // Sin fuente asignada (filas legadas): se deriva del nombre de la categoría (D6)
                    Name = i.Source?.Name ?? i.Category?.Name ?? "Sin fuente"
                })
                .Select(g => new
                {
                    SourceId = g.Key.SourceId,
                    SourceName = g.Key.Name,
                    Total = g.Sum(i => i.Amount),
                    GrossTotal = g.Sum(i => i.GrossAmount ?? i.Amount)
                })
                .OrderByDescending(s => s.Total)
                .ToList();

            var categories = monthIncomes
                .GroupBy(i => new { i.CategoryId, Name = i.Category?.Name ?? "Sin categoría" })
                .Select(g => new
                {
                    CategoryId = g.Key.CategoryId,
                    CategoryName = g.Key.Name,
                    Total = g.Sum(i => i.Amount)
                })
                .OrderByDescending(c => c.Total)
                .ToList();

            months.Add(new
            {
                Year = month.Year,
                Month = month.Month,
                Total = monthIncomes.Sum(i => i.Amount),
                GrossTotal = monthIncomes.Sum(i => i.GrossAmount ?? i.Amount),
                Sources = sources,
                Categories = categories
            });
        }

        return new
        {
            FirstIncomeMonth = firstIncomeMonth,
            CurrentMonth = currentMonth,
            Months = months
        };
    }

    public async Task<bool> ArchiveAsync(int id, int? userId = null)
    {
        var income = await _context.Incomes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == id);
        if (income == null) return false;

        if (income.IsDeleted) return false;

        income.IsDeleted = true;
        income.DeletedAt = DateTime.UtcNow;
        income.DeletedByUserId = userId;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RestoreAsync(int id, int userId, bool isAdmin = false)
    {
        var income = await _context.Incomes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == id);
        if (income == null) return false;

        if (!isAdmin && income.UserId != userId) return false;

        if (!income.IsDeleted) return false;

        income.IsDeleted = false;
        income.DeletedAt = null;
        income.DeletedByUserId = null;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<Income>> GetDeletedByUserId(int userId)
    {
        return await _context.Incomes
            .IgnoreQueryFilters()
            .Include(i => i.Category)
            .Include(i => i.User)
            .Include(i => i.Source)
            .Where(i => i.UserId == userId && i.IsDeleted)
            .OrderByDescending(i => i.DeletedAt)
            .ToListAsync();
    }
}
