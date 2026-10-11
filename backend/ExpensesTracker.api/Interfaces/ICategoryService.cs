using ExpensesTracker.api.Models;

namespace ExpensesTracker.api.Interfaces
{
    public interface ICategoryService
    {
        Task<IEnumerable<Category>> GetAllAsync();
        Task<IEnumerable<Category>> GetForUserAsync(int userId);
        Task<Category?> GetByIdAsync(int id);
        Task<List<Category>> GetByUserId(int userId);
        Task<Category> CreateAsync(Category category);
        Task<bool> UpdateAsync(Category category);
        Task<bool> DeleteAsync(int id);
        Task<bool> ArchiveAsync(int id, int userId);
        Task<bool> RestoreAsync(int id, int userId);
        Task<IEnumerable<Category>> GetArchivedByUserId(int userId);
        Task SeedSystemCategoriesAsync();
        Task<decimal> GetTotalByCategoryAndPeriodAsync(int categoryId, int userId, DateTime periodStart, DateTime periodEnd);
        Task<decimal> GetCuotasPagadasByCategoryAndPeriodAsync(int categoryId, int userId, DateTime periodStart, DateTime periodEnd);
        Task<decimal> GetCommittedByCategoryAndPeriodAsync(int categoryId, int userId, DateTime periodStart, DateTime periodEnd);
    }
}
