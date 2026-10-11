using ExpensesTracker.api.Dtos.Budget;
using ExpensesTracker.api.Models;

namespace ExpensesTracker.api.Interfaces
{
    public interface IBudgetService
    {
        Task<Budget?> GetCurrentAsync(int userId);
        Task<Budget?> GetByIdAsync(int userId, int budgetId);
        Task<IEnumerable<Budget>> GetAllAsync(int userId);
        Task<Budget> CreateAsync(Budget budget, List<BudgetCategory> categories);
        Task<bool> UpdateAsync(Budget budget, List<BudgetCategory> categories);
        Task<bool> DeleteAsync(int userId, int budgetId);
        Task<BudgetProgressDto?> GetProgressAsync(int userId);
        Task<BudgetProgressDto?> GetProgressAsync(int userId, string period);
        Task<BudgetWithMeta?> GetForPeriodAsync(int userId, string period);
        Task<CanSpendResponse> CanSpendAsync(int userId, CanSpendRequest request);
        Task<bool> ArchiveAsync(int userId, int budgetId);
        Task<bool> RestoreAsync(int budgetId);
        Task<IEnumerable<Budget>> GetDeletedAsync(int userId);
    }
}
