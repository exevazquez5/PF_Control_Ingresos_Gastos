using ExpensesTracker.api.Data;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _context;

    private static readonly List<(string Name, string Type)> DefaultSystemCategories = new()
    {
        ("Alimentación", "gasto"),
        ("Transporte", "gasto"),
        ("Entretenimiento", "gasto"),
        ("Salud", "gasto"),
        ("Educación", "gasto"),
        ("Hogar", "gasto"),
        ("Ropa", "gasto"),
        ("Servicios", "gasto"),
        ("Suscripciones", "gasto"),
        ("Mascotas", "gasto"),
        ("Regalos", "gasto"),
        ("Otros", "gasto"),
        ("Salario", "ingreso"),
        ("Freelance", "ingreso"),
        ("Inversiones", "ingreso"),
        ("Ventas", "ingreso"),
        ("Otros ingresos", "ingreso"),
    };

    // Categorías de ingreso con naturaleza laboral (join explícito, reemplaza la heurística de nombres)
    private static readonly HashSet<string> LaborCategoryNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Salario",
        "Freelance"
    };

    public CategoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Category>> GetAllAsync()
    {
        return await _context.Categories
            .Include(c => c.Expenses)
            .ThenInclude(e => e.User)
            .ToListAsync();
    }

    public async Task<IEnumerable<Category>> GetForUserAsync(int userId)
    {
        return await _context.Categories
            .Include(c => c.ParentCategory)
            .Where(c => c.IsSystem || (c.UserId == userId && !c.IsArchived))
            .OrderBy(c => c.IsSystem ? 0 : 1)
            .ThenBy(c => c.Name)
            .ToListAsync();
    }

    public async Task<Category?> GetByIdAsync(int id)
    {
        return await _context.Categories
            .Include(c => c.ParentCategory)
            .Include(c => c.Children)
            .Include(c => c.Expenses)
            .ThenInclude(e => e.User)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<List<Category>> GetByUserId(int userId)
    {
        return await _context.Categories
            .Include(c => c.ParentCategory)
            .Include(c => c.Children)
            .Include(c => c.Expenses.Where(e => e.UserId == userId))
            .ThenInclude(e => e.User)
            .Where(c => (c.IsSystem || c.UserId == userId) && !c.IsArchived)
            .ToListAsync();
    }

    public async Task<Category> CreateAsync(Category category)
    {
        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return category;
    }

    public async Task<bool> UpdateAsync(Category category)
    {
        var existing = await _context.Categories.FindAsync(category.Id);
        if (existing == null) return false;

        existing.Name = category.Name;
        existing.Type = category.Type;
        existing.ParentCategoryId = category.ParentCategoryId;
        existing.Icon = category.Icon;
        existing.Color = category.Color;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return false;

        bool usedInExpenses = await _context.Expenses.AnyAsync(e => e.CategoryId == id);
        bool usedInIncomes = await _context.Incomes.AnyAsync(i => i.CategoryId == id);

        if (usedInExpenses || usedInIncomes)
            return false;

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ArchiveAsync(int id, int userId)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return false;

        if (category.IsSystem)
            return false;

        if (category.UserId != userId)
            return false;

        if (category.IsArchived)
            return false;

        category.IsArchived = true;
        category.ArchivedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RestoreAsync(int id, int userId)
    {
        var category = await _context.Categories.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == id);
        if (category == null) return false;

        if (category.IsSystem)
            return false;

        if (category.UserId != userId)
            return false;

        if (!category.IsArchived)
            return false;

        category.IsArchived = false;
        category.ArchivedAt = null;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<Category>> GetArchivedByUserId(int userId)
    {
        return await _context.Categories
            .IgnoreQueryFilters()
            .Where(c => c.UserId == userId && c.IsArchived)
            .OrderByDescending(c => c.ArchivedAt)
            .ToListAsync();
    }

    public async Task SeedSystemCategoriesAsync()
    {
        var existingSystemCategories = await _context.Categories
            .Where(c => c.IsSystem)
            .ToListAsync();

        if (existingSystemCategories.Any())
            return;

            foreach (var (name, type) in DefaultSystemCategories)
            {
                _context.Categories.Add(new Category
                {
                    Name = name,
                    Type = type,
                    IsSystem = true,
                    IsLabor = type == "ingreso" && LaborCategoryNames.Contains(name),
                    UserId = null,
                    CreatedAt = DateTime.UtcNow
                });
            }

        await _context.SaveChangesAsync();
    }

    public async Task<decimal> GetTotalByCategoryAndPeriodAsync(int categoryId, int userId, DateTime periodStart, DateTime periodEnd)
    {
        var childIds = await _context.Categories
            .Where(c => c.ParentCategoryId == categoryId)
            .Select(c => c.Id)
            .ToListAsync();

        var allCategoryIds = new List<int> { categoryId };
        allCategoryIds.AddRange(childIds);

        return await _context.Expenses
            .Where(e => e.UserId == userId
                && allCategoryIds.Contains(e.CategoryId)
                && e.Date >= periodStart
                && e.Date <= periodEnd
                && e.FundingSource == FundingSource.Income
                && !_context.PagosCuotas.Any(pc => pc.ExpenseId == e.Id))
            .SumAsync(e => (decimal?)e.Amount) ?? 0;
    }

    public async Task<decimal> GetCuotasPagadasByCategoryAndPeriodAsync(int categoryId, int userId, DateTime periodStart, DateTime periodEnd)
    {
        var childIds = await _context.Categories
            .Where(c => c.ParentCategoryId == categoryId)
            .Select(c => c.Id)
            .ToListAsync();

        var allCategoryIds = new List<int> { categoryId };
        allCategoryIds.AddRange(childIds);

        return await _context.PagosCuotas
            .Include(pc => pc.Expense)
            .Where(pc => pc.Expense.UserId == userId
                && allCategoryIds.Contains(pc.Expense.CategoryId)
                && pc.Expense.FundingSource != FundingSource.Savings
                && pc.Status == PagoCuotaStatus.Paid
                && pc.PaidAt.HasValue
                && pc.PaidAt >= periodStart
                && pc.PaidAt <= periodEnd)
            .SumAsync(pc => (decimal?)pc.MontoCuota) ?? 0;
    }

    public async Task<decimal> GetCommittedByCategoryAndPeriodAsync(int categoryId, int userId, DateTime periodStart, DateTime periodEnd)
    {
        var childIds = await _context.Categories
            .Where(c => c.ParentCategoryId == categoryId)
            .Select(c => c.Id)
            .ToListAsync();

        var allCategoryIds = new List<int> { categoryId };
        allCategoryIds.AddRange(childIds);

        return await _context.PagosCuotas
            .Include(pc => pc.Expense)
            .Where(pc => pc.Expense.UserId == userId
                && allCategoryIds.Contains(pc.Expense.CategoryId)
                && pc.Expense.FundingSource != FundingSource.Savings
                && pc.Status == PagoCuotaStatus.Pending
                && pc.DueDate >= periodStart
                && pc.DueDate <= periodEnd)
            .SumAsync(pc => (decimal?)pc.MontoCuota) ?? 0;
    }
}
