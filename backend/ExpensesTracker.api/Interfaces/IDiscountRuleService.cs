using ExpensesTracker.api.Dtos.DiscountRule;
using ExpensesTracker.api.Models;

namespace ExpensesTracker.api.Interfaces
{
    public interface IDiscountRuleService
    {
        Task<List<DiscountRule>> GetByUserIdAsync(int userId, int? sourceId = null, bool includeArchived = false);
        Task<DiscountRule?> GetByIdAsync(int id);
        Task<(DiscountRule? Rule, string? Error, int StatusCode)> CreateAsync(DiscountRule rule);
        Task<(bool Ok, string? Error, int StatusCode)> UpdateAsync(DiscountRule rule);
        Task<bool> ArchiveAsync(int userId, int id);
        Task<bool> RestoreAsync(int userId, int id);
        Task<ExpenseRuleAssignmentDto> AssignExpenseAsync(int userId, int ruleId, AssignExpenseDto dto);
        Task<bool> UnassignExpenseAsync(int userId, int ruleId, int expenseId, int? pagoCuotaId);
        Task<MonthDiscountsDto> ComputeMonthDiscountsAsync(int userId, int year, int month);
    }
}
