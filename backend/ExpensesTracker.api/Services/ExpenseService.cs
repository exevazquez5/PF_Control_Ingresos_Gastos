using ExpensesTracker.api.Data;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;

public class ExpenseService : IExpenseService
{
    private readonly AppDbContext _context;

    public ExpenseService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Expense>> GetAllAsync()
    {
        return await _context.Expenses
            .Include(e => e.Category)
            .Include(e => e.User)
            .ToListAsync();
    }

    public async Task<Expense> GetByIdAsync(int id)
    {
        return await _context.Expenses
            .Include(e => e.Category)
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id);
    }

    public async Task<List<Expense>> GetByUserId(int userId)
    {
        return await _context.Expenses
            .Include(e => e.Category)
            .Include(e => e.User)
            .Where(e => e.UserId == userId)
            .ToListAsync();
    }

    public async Task<List<Expense>> GetByUserIdCurrentMonth(int userId)
    {
        var now = DateTime.Now;
        var startDate = new DateTime(now.Year, now.Month, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);

        return await _context.Expenses
            .Include(e => e.Category)
            .Include(e => e.User)
            .Where(e => e.UserId == userId &&
                   e.Date >= startDate &&
                   e.Date <= endDate)
            .OrderByDescending(e => e.Date)
            .ToListAsync();
    }

    public async Task<List<Expense>> GetByUserIdAndMonth(int userId, int month, int year)
    {
        var startDate = new DateTime(year, month, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);

        return await _context.Expenses
            .Include(e => e.Category)
            .Include(e => e.User)
            .Where(e => e.UserId == userId &&
                   e.Date >= startDate &&
                   e.Date <= endDate)
            .OrderByDescending(e => e.Date)
            .ToListAsync();
    }

    public async Task<Expense> CreateAsync(Expense expense)
    {
        _context.Expenses.Add(expense);
        await _context.SaveChangesAsync();

        await _context.Entry(expense).Reference(e => e.Category).LoadAsync();
        await _context.Entry(expense).Reference(e => e.User).LoadAsync();

        return expense;
    }

    public async Task<bool> UpdateAsync(Expense expense)
    {
        var existing = await _context.Expenses.FindAsync(expense.Id);
        if (existing == null) return false;

        existing.Description = expense.Description;
        existing.Amount = expense.Amount;
        existing.Date = expense.Date;
        existing.CategoryId = expense.CategoryId;
        existing.UserId = expense.UserId;
        existing.CreditCardId = expense.CreditCardId;
        existing.FundingSource = expense.FundingSource;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var expense = await _context.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == id);
        if (expense == null) return false;

        _context.Expenses.Remove(expense);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<decimal> CalcularMontoPagado(int expenseId)
    {
        var tieneCuotas = await _context.PagosCuotas.AnyAsync(pc => pc.ExpenseId == expenseId);

        if (!tieneCuotas)
        {
            var gasto = await _context.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == expenseId);
            return gasto?.Amount ?? 0;
        }

        return await _context.PagosCuotas
            .Where(pc => pc.ExpenseId == expenseId && pc.Status == PagoCuotaStatus.Paid)
            .SumAsync(pc => pc.MontoCuota);
    }

    // Batch version of CalcularMontoPagado: resolves the "tiene cuotas" flag and the
    // paid amount for many expenses in a single query (avoids N+1 round-trips to the DB).
    public async Task<Dictionary<int, (bool TieneCuotas, decimal MontoPagado)>> GetPagosInfoAsync(IEnumerable<int> expenseIds)
    {
        var ids = expenseIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<int, (bool, decimal)>();

        var data = await _context.PagosCuotas
            .Where(pc => ids.Contains(pc.ExpenseId))
            .GroupBy(pc => pc.ExpenseId)
            .Select(g => new
            {
                ExpenseId = g.Key,
                Total = g.Count(),
                Pagado = g.Sum(x => x.Status == PagoCuotaStatus.Paid ? x.MontoCuota : 0m)
            })
            .ToListAsync();

        return data.ToDictionary(
            x => x.ExpenseId,
            x => (x.Total > 0, x.Pagado));
    }

    public async Task<bool> ArchiveAsync(int id, int? userId = null)
    {
        var expense = await _context.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == id);
        if (expense == null) return false;

        if (expense.IsDeleted) return false;

        expense.IsDeleted = true;
        expense.DeletedAt = DateTime.UtcNow;
        expense.DeletedByUserId = userId;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RestoreAsync(int id, int userId, bool isAdmin = false)
    {
        var expense = await _context.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == id);
        if (expense == null) return false;

        if (!isAdmin && expense.UserId != userId) return false;

        if (!expense.IsDeleted) return false;

        expense.IsDeleted = false;
        expense.DeletedAt = null;
        expense.DeletedByUserId = null;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<Expense>> GetDeletedByUserId(int userId)
    {
        return await _context.Expenses
            .IgnoreQueryFilters()
            .Include(e => e.Category)
            .Include(e => e.User)
            .Where(e => e.UserId == userId && e.IsDeleted)
            .OrderByDescending(e => e.DeletedAt)
            .ToListAsync();
    }
}
