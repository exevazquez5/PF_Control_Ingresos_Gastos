using ExpensesTracker.api.Models;

namespace ExpensesTracker.api.Interfaces
{
    public interface IIncomeSourceService
    {
        Task<List<IncomeSource>> GetByUserIdAsync(int userId, bool includeArchived = false);
        Task<IncomeSource?> GetByIdAsync(int id);
        Task<IncomeSource?> FindByNameAsync(int userId, string name);
        Task<(IncomeSource? Source, string? Error, int StatusCode)> CreateAsync(int userId, string name, string mode);
        Task<(bool Ok, string? Error, int StatusCode)> RenameAsync(int userId, int id, string newName);
        Task<(bool Ok, string? Error, int StatusCode)> SetModeAsync(int userId, int id, string mode);
        Task<bool> ArchiveAsync(int userId, int id);
        Task<bool> RestoreAsync(int userId, int id);
        Task<(bool Ok, string? Error, int StatusCode)> MergeAsync(int userId, int sourceId, int targetSourceId);
        Task<List<IncomeSourceAlias>> GetAliasesByUserIdAsync(int userId);
    }
}
