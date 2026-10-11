using ExpensesTracker.api.DTOs.Salary;
using ExpensesTracker.api.Models;

namespace ExpensesTracker.api.Interfaces
{
    public interface ISalaryService
    {
        Task<IEnumerable<Salary>> GetAllAsync(int userId);
        Task<Salary?> GetByIdAsync(int userId, int id);
        Task<Salary?> CreateAsync(int userId, CreateSalaryDto dto);
        Task<Salary?> UpdateAsync(int userId, int id, UpdateSalaryDto dto);
        Task<bool> DeleteAsync(int userId, int id);
    }
}
