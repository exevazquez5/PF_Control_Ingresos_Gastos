using ExpensesTracker.api.Data;
using ExpensesTracker.api.Dtos.Budget;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;

namespace ExpensesTracker.api.Services
{
    public class BudgetService : IBudgetService
    {
        private readonly AppDbContext _context;
        private readonly ICategoryService _categoryService;

        public BudgetService(AppDbContext context, ICategoryService categoryService)
        {
            _context = context;
            _categoryService = categoryService;
        }

        public async Task<Budget?> GetCurrentAsync(int userId)
        {
            var currentPeriod = DateTime.UtcNow.ToString("yyyy-MM");
            return await _context.Budgets
                .Include(b => b.Categories)
                .ThenInclude(bc => bc.Category)
                .ThenInclude(c => c!.ParentCategory)
                .FirstOrDefaultAsync(b => b.UserId == userId && b.Period == currentPeriod);
        }

        public async Task<Budget?> GetByIdAsync(int userId, int budgetId)
        {
            return await _context.Budgets
                .Include(b => b.Categories)
                .ThenInclude(bc => bc.Category)
                .ThenInclude(c => c!.ParentCategory)
                .FirstOrDefaultAsync(b => b.Id == budgetId && b.UserId == userId);
        }

        public async Task<IEnumerable<Budget>> GetAllAsync(int userId)
        {
            return await _context.Budgets
                .Include(b => b.Categories)
                .ThenInclude(bc => bc.Category)
                .ThenInclude(c => c!.ParentCategory)
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.PeriodStart)
                .ToListAsync();
        }

        public async Task<Budget> CreateAsync(Budget budget, List<BudgetCategory> categories)
        {
            budget.CreatedAt = DateTime.UtcNow;
            budget.UpdatedAt = DateTime.UtcNow;

            _context.Budgets.Add(budget);
            await _context.SaveChangesAsync();

            foreach (var category in categories)
            {
                category.BudgetId = budget.Id;
            }

            _context.BudgetCategories.AddRange(categories);
            await _context.SaveChangesAsync();

            return await _context.Budgets
                .Include(b => b.Categories)
                .ThenInclude(bc => bc.Category)
                .ThenInclude(c => c!.ParentCategory)
                .FirstOrDefaultAsync(b => b.Id == budget.Id && b.UserId == budget.UserId);
        }

        public async Task<bool> UpdateAsync(Budget budget, List<BudgetCategory> categories)
        {
            var existing = await _context.Budgets
                .Include(b => b.Categories)
                .ThenInclude(bc => bc.Category)
                .ThenInclude(c => c!.ParentCategory)
                .FirstOrDefaultAsync(b => b.Id == budget.Id && b.UserId == budget.UserId);

            if (existing == null) return false;

            existing.TotalAmount = budget.TotalAmount;
            existing.UpdatedAt = DateTime.UtcNow;

            var existingCategoryIds = existing.Categories.Select(c => c.Id).ToHashSet();
            var incomingCategoryIds = categories.Where(c => c.Id > 0).Select(c => c.Id).ToHashSet();

            var toRemove = existing.Categories
                .Where(c => !incomingCategoryIds.Contains(c.Id))
                .ToList();

            _context.BudgetCategories.RemoveRange(toRemove);

            foreach (var incoming in categories)
            {
                if (incoming.Id > 0 && existingCategoryIds.Contains(incoming.Id))
                {
                    var existingCat = existing.Categories.First(c => c.Id == incoming.Id);
                    existingCat.CategoryId = incoming.CategoryId;
                    existingCat.Amount = incoming.Amount;
                    existingCat.AlertThreshold = incoming.AlertThreshold;
                }
                else
                {
                    incoming.BudgetId = existing.Id;
                    _context.BudgetCategories.Add(incoming);
                }
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteAsync(int userId, int budgetId)
        {
            return await ArchiveAsync(userId, budgetId);
        }

        public async Task<BudgetProgressDto?> GetProgressAsync(int userId)
        {
            var currentPeriod = DateTime.UtcNow.ToString("yyyy-MM");
            return await GetProgressAsync(userId, currentPeriod);
        }

        public async Task<BudgetProgressDto?> GetProgressAsync(int userId, string period)
        {
            var budgetMeta = await GetForPeriodAsync(userId, period);
            if (budgetMeta == null) return null;

            var budget = budgetMeta.Budget;
            var periodStart = budget.PeriodStart;
            var periodEnd = budget.PeriodEnd;
            var now = DateTime.UtcNow.Date;
            var daysElapsed = Max(0, Math.Min((now - periodStart).Days + 1, (periodEnd - periodStart).Days + 1));
            var daysTotal = (periodEnd - periodStart).Days + 1;
            var timePercentage = daysTotal > 0 ? Math.Round((decimal)daysElapsed / daysTotal * 100, 2) : 0;

            // Preload child categories + aggregate expenses/cuotas per category with a few
            // bulk queries. The old code ran 3 DB round-trips per budget category (N+1).
            var childrenByParent = (await _context.Categories
                    .Where(c => c.ParentCategoryId != null)
                    .Select(c => new { c.Id, ParentId = c.ParentCategoryId!.Value })
                    .ToListAsync())
                .GroupBy(c => c.ParentId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

            var expensesByCategory = (await _context.Expenses
                    .Where(e => e.UserId == userId
                        && e.Date >= periodStart
                        && e.Date <= periodEnd
                        && e.FundingSource == FundingSource.Income
                        && !_context.PagosCuotas.Any(pc => pc.ExpenseId == e.Id))
                    .GroupBy(e => e.CategoryId)
                    .Select(g => new { CategoryId = g.Key, Total = g.Sum(e => e.Amount) })
                    .ToListAsync())
                .ToDictionary(x => x.CategoryId, x => x.Total);

            var cuotasPagadasByCategory = (await _context.PagosCuotas
                    .Where(pc => pc.Expense.UserId == userId
                        && pc.Expense.FundingSource != FundingSource.Savings
                        && pc.Status == PagoCuotaStatus.Paid
                        && pc.PaidAt.HasValue
                        && pc.PaidAt >= periodStart
                        && pc.PaidAt <= periodEnd)
                    .GroupBy(pc => pc.Expense.CategoryId)
                    .Select(g => new { CategoryId = g.Key, Total = g.Sum(pc => pc.MontoCuota) })
                    .ToListAsync())
                .ToDictionary(x => x.CategoryId, x => x.Total);

            var committedByCategory = (await _context.PagosCuotas
                    .Where(pc => pc.Expense.UserId == userId
                        && pc.Expense.FundingSource != FundingSource.Savings
                        && pc.Status == PagoCuotaStatus.Pending
                        && pc.DueDate >= periodStart
                        && pc.DueDate <= periodEnd)
                    .GroupBy(pc => pc.Expense.CategoryId)
                    .Select(g => new { CategoryId = g.Key, Total = g.Sum(pc => pc.MontoCuota) })
                    .ToListAsync())
                .ToDictionary(x => x.CategoryId, x => x.Total);

            decimal SumForCategory(Dictionary<int, decimal> map, int categoryId)
            {
                var total = map.TryGetValue(categoryId, out var direct) ? direct : 0m;
                if (childrenByParent.TryGetValue(categoryId, out var childIds))
                {
                    foreach (var childId in childIds)
                    {
                        if (map.TryGetValue(childId, out var childTotal))
                            total += childTotal;
                    }
                }
                return total;
            }

            var expensesSpent = expensesByCategory.Values.Sum();
            var cuotasPagadas = cuotasPagadasByCategory.Values.Sum();

            var globalSpent = expensesSpent + cuotasPagadas;

            var committed = committedByCategory.Values.Sum();

            var totalUsed = globalSpent + committed;
            var available = budget.TotalAmount - totalUsed;
            var globalPercentage = budget.TotalAmount > 0
                ? Math.Round(totalUsed / budget.TotalAmount * 100, 2)
                : 0;

            var categoryProgress = new List<BudgetCategoryProgressDto>();

            foreach (var bc in budget.Categories)
            {
                var catExpenses = SumForCategory(expensesByCategory, bc.CategoryId);

                var catCuotasPagadas = SumForCategory(cuotasPagadasByCategory, bc.CategoryId);

                var catSpent = catExpenses + catCuotasPagadas;

                var catCommitted = SumForCategory(committedByCategory, bc.CategoryId);

                var catAvailable = bc.Amount - (catSpent + catCommitted);
                var catPercentage = bc.Amount > 0
                    ? Math.Round((catSpent + catCommitted) / bc.Amount * 100, 2)
                    : 0;

                categoryProgress.Add(new BudgetCategoryProgressDto
                {
                    CategoryId = bc.CategoryId,
                    CategoryName = bc.Category.Name,
                    BudgetLimit = bc.Amount,
                    Spent = catSpent,
                    Committed = catCommitted,
                    Available = catAvailable,
                    Percentage = catPercentage
                });
            }

            return new BudgetProgressDto
            {
                IsInherited = budgetMeta.IsInherited,
                Period = budget.Period,
                Global = new BudgetGlobalProgressDto
                {
                    TotalBudget = budget.TotalAmount,
                    Spent = globalSpent,
                    Committed = committed,
                    Available = available,
                    Percentage = globalPercentage,
                    TimePercentage = timePercentage,
                    DaysElapsed = daysElapsed,
                    DaysTotal = daysTotal
                },
                Categories = categoryProgress
            };
        }

        public async Task<BudgetWithMeta?> GetForPeriodAsync(int userId, string period)
        {
            var explicitBudget = await _context.Budgets
                .Include(b => b.Categories).ThenInclude(bc => bc.Category).ThenInclude(c => c!.ParentCategory)
                .FirstOrDefaultAsync(b => b.UserId == userId && b.Period == period);

            if (explicitBudget != null)
                return new BudgetWithMeta { Budget = explicitBudget, IsInherited = false };

            var lastBudget = await _context.Budgets
                .IgnoreQueryFilters()
                .Include(b => b.Categories).ThenInclude(bc => bc.Category).ThenInclude(c => c!.ParentCategory)
                .Where(b => b.UserId == userId && b.Period.CompareTo(period) < 0 && !b.IsDeleted)
                .OrderByDescending(b => b.Period)
                .FirstOrDefaultAsync();

            if (lastBudget == null)
                return null;

            var cloned = CloneBudgetForPeriod(lastBudget, period);
            return new BudgetWithMeta { Budget = cloned, IsInherited = true };
        }

        private static Budget CloneBudgetForPeriod(Budget source, string period)
        {
            var (start, end) = PeriodToDates(period);

            return new Budget
            {
                Id = 0,
                UserId = source.UserId,
                Period = period,
                PeriodStart = start,
                PeriodEnd = end,
                TotalAmount = source.TotalAmount,
                CreatedAt = source.CreatedAt,
                UpdatedAt = source.UpdatedAt,
                Categories = source.Categories.Select(c => new BudgetCategory
                {
                    Id = 0,
                    BudgetId = 0,
                    CategoryId = c.CategoryId,
                    Amount = c.Amount,
                    AlertThreshold = c.AlertThreshold,
                    Category = new Category
                    {
                        Id = c.Category.Id,
                        Name = c.Category.Name,
                        ParentCategoryId = c.Category.ParentCategoryId,
                        ParentCategory = c.Category.ParentCategory
                    }
                }).ToList()
            };
        }

        private static (DateTime Start, DateTime End) PeriodToDates(string period)
        {
            var parts = period.Split('-');
            var year = int.Parse(parts[0]);
            var month = int.Parse(parts[1]);
            var start = new DateTime(year, month, 1);
            var end = start.AddMonths(1).AddDays(-1);
            return (start, end);
        }

        public async Task<CanSpendResponse> CanSpendAsync(int userId, CanSpendRequest request)
        {
            var progress = await GetProgressAsync(userId, request.Period);

            if (progress == null)
                return new CanSpendResponse
                {
                    CanSpend = true,
                    Message = "No hay presupuesto configurado. Podés gastar libremente.",
                    Level = "ok",
                    AvailableGlobal = 0,
                    AvailableCategory = null
                };

            var g = progress.Global;
            var remainingGlobal = g.Available - request.Amount;

            decimal? remainingCategory = null;
            if (request.CategoryId.HasValue)
            {
                var catProgress = progress.Categories
                    .FirstOrDefault(c => c.CategoryId == request.CategoryId.Value);

                if (catProgress != null)
                    remainingCategory = catProgress.Available - request.Amount;
            }

            if (remainingCategory < 0)
                return new CanSpendResponse
                {
                    CanSpend = false,
                    Message = $"No podés gastar {FormatCurrency(request.Amount)} en esta categoría. Te pasás por {FormatCurrency(Math.Abs(remainingCategory.Value))}.",
                    Level = "danger",
                    AvailableGlobal = g.Available,
                    AvailableCategory = remainingCategory
                };

            if (remainingGlobal < 0)
                return new CanSpendResponse
                {
                    CanSpend = false,
                    Message = $"No podés gastar {FormatCurrency(request.Amount)}. Te pasás del presupuesto global por {FormatCurrency(Math.Abs(remainingGlobal))}.",
                    Level = "danger",
                    AvailableGlobal = g.Available,
                    AvailableCategory = remainingCategory
                };

            var timeRemaining = 100 - g.TimePercentage;
            var budgetRemaining = 100 - g.Percentage;

            if (budgetRemaining < timeRemaining && g.Percentage > 70)
                return new CanSpendResponse
                {
                    CanSpend = true,
                    Message = $"Podés gastar {FormatCurrency(request.Amount)}, pero vas justo para fin de mes. Llevás gastado {g.Percentage:F0}% en {g.TimePercentage:F0}% del mes.",
                    Level = "warning",
                    AvailableGlobal = g.Available,
                    AvailableCategory = remainingCategory
                };

            return new CanSpendResponse
            {
                CanSpend = true,
                Message = $"Sí, estás dentro del presupuesto. Disponible: {FormatCurrency(g.Available)}.",
                Level = "ok",
                AvailableGlobal = g.Available,
                AvailableCategory = remainingCategory
            };
        }

        public async Task<bool> ArchiveAsync(int userId, int budgetId)
        {
            var budget = await _context.Budgets
                .IgnoreQueryFilters()
                .Include(b => b.Categories)
                .ThenInclude(bc => bc.Category)
                .ThenInclude(c => c!.ParentCategory)
                .FirstOrDefaultAsync(b => b.Id == budgetId && b.UserId == userId);

            if (budget == null) return false;

            if (budget.IsDeleted) return false;

            budget.IsDeleted = true;
            budget.DeletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RestoreAsync(int userId, int budgetId)
        {
            var budget = await _context.Budgets
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => b.Id == budgetId && b.UserId == userId);

            if (budget == null) return false;

            if (!budget.IsDeleted) return false;

            budget.IsDeleted = false;
            budget.DeletedAt = null;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<Budget>> GetDeletedAsync(int userId)
        {
            return await _context.Budgets
                .IgnoreQueryFilters()
                .Include(b => b.Categories)
                .ThenInclude(bc => bc.Category)
                .ThenInclude(c => c!.ParentCategory)
                .Where(b => b.UserId == userId && b.IsDeleted)
                .OrderByDescending(b => b.DeletedAt)
                .ToListAsync();
        }

        private static string FormatCurrency(decimal amount)
        {
            return amount.ToString("N0", System.Globalization.CultureInfo.CreateSpecificCulture("es-AR"));
        }

        private static int Max(int a, int b) => a > b ? a : b;
    }
}
