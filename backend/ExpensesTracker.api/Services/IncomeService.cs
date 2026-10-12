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
            .ToListAsync();
    }

    public async Task<Income?> GetById(int id)
    {
        return await _context.Incomes
            .Include(i => i.Category)
            .Include(i => i.User)
            .FirstOrDefaultAsync(i => i.Id == id);
    }

    public async Task<List<Income>> GetByUserId(int userId)
    {
        return await _context.Incomes
            .Include(i => i.Category)
            .Include(i => i.User)
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
            .FirstOrDefaultAsync(i => i.Id == income.Id);
    }

    public async Task<bool> Update(Income income)
    {
        var existingIncome = await _context.Incomes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == income.Id);
        if (existingIncome == null) return false;

        existingIncome.Amount = income.Amount;
        existingIncome.Description = income.Description;
        existingIncome.Date = income.Date;
        existingIncome.CategoryId = income.CategoryId;
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
            .ToListAsync();
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
            .Where(i => i.UserId == userId && i.IsDeleted)
            .OrderByDescending(i => i.DeletedAt)
            .ToListAsync();
    }
}
