using ExpensesTracker.api.Models;

namespace ExpensesTracker.api.Interfaces
{
    public interface IExpenseService
    {
        Task<IEnumerable<Expense>> GetAllAsync();
        Task<Expense> GetByIdAsync(int id);
        Task<List<Expense>> GetByUserId(int userId);
        Task<List<Expense>> GetByUserIdCurrentMonth(int userId);
        Task<List<Expense>> GetByUserIdAndMonth(int userId, int month, int year);
        Task<Expense> CreateAsync(Expense expense);
        Task<bool> UpdateAsync(Expense expense);
        Task<bool> DeleteAsync(int id);
        Task<decimal> CalcularMontoPagado(int expenseId);
        Task<Dictionary<int, (bool TieneCuotas, decimal MontoPagado)>> GetPagosInfoAsync(IEnumerable<int> expenseIds);
        Task<bool> ArchiveAsync(int id, int? userId = null);
        Task<bool> RestoreAsync(int id, int userId, bool isAdmin = false);
        Task<List<Expense>> GetDeletedByUserId(int userId);
    }
}
