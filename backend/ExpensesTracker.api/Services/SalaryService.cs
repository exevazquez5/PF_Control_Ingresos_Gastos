using ExpensesTracker.api.Data;
using ExpensesTracker.api.DTOs.Salary;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;

namespace ExpensesTracker.api.Services
{
    public class SalaryService : ISalaryService
    {
        private readonly AppDbContext _context;

        public SalaryService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Salary>> GetAllAsync(int userId)
        {
            return await _context.Salaries
                .Include(s => s.Deductions)
                .ThenInclude(d => d.Expense)
                .ThenInclude(e => e!.Category)
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.Date)
                .ThenByDescending(s => s.Id)
                .ToListAsync();
        }

        public async Task<Salary?> GetByIdAsync(int userId, int id)
        {
            return await QueryOwned(userId)
                .FirstOrDefaultAsync(s => s.Id == id);
        }

        public async Task<Salary?> CreateAsync(int userId, CreateSalaryDto dto)
        {
            var categoryId = await GetSalarioCategoryIdAsync();

            await ValidateDeductionsAsync(userId, dto.Deductions);
            var totalDeductions = dto.Deductions.Sum(d => d.Amount);

            if (totalDeductions > dto.GrossAmount)
                throw new ArgumentException("Las deducciones no pueden superar el bruto.");

            var income = new Income
            {
                Amount = dto.GrossAmount,
                Description = $"Sueldo {dto.Date:MM/yyyy}",
                Date = dto.Date,
                CategoryId = categoryId,
                UserId = userId
            };
            _context.Incomes.Add(income);
            await _context.SaveChangesAsync();

            var salary = new Salary
            {
                UserId = userId,
                IncomeId = income.Id,
                GrossAmount = dto.GrossAmount,
                NetAmount = dto.GrossAmount - totalDeductions,
                Date = dto.Date,
                Notes = dto.Notes,
                CreatedAt = DateTime.UtcNow,
                Deductions = dto.Deductions
                    .Select(d => new SalaryDeduction
                    {
                        ExpenseId = d.ExpenseId,
                        Amount = d.Amount
                    })
                    .ToList()
            };
            _context.Salaries.Add(salary);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(userId, salary.Id);
        }

        public async Task<Salary?> UpdateAsync(int userId, int id, UpdateSalaryDto dto)
        {
            var salary = await QueryOwned(userId)
                .Include(s => s.Income)
                .Include(s => s.Deductions)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (salary == null) return null;

            await ValidateDeductionsAsync(userId, dto.Deductions);
            var totalDeductions = dto.Deductions.Sum(d => d.Amount);

            if (totalDeductions > dto.GrossAmount)
                throw new ArgumentException("Las deducciones no pueden superar el bruto.");

            salary.Income.Amount = dto.GrossAmount;
            salary.Income.Date = dto.Date;
            salary.Income.Description = $"Sueldo {dto.Date:MM/yyyy}";

            salary.GrossAmount = dto.GrossAmount;
            salary.NetAmount = dto.GrossAmount - totalDeductions;
            salary.Date = dto.Date;
            salary.Notes = dto.Notes;

            _context.SalaryDeductions.RemoveRange(salary.Deductions);
            salary.Deductions = dto.Deductions
                .Select(d => new SalaryDeduction
                {
                    ExpenseId = d.ExpenseId,
                    Amount = d.Amount
                })
                .ToList();

            await _context.SaveChangesAsync();

            return await GetByIdAsync(userId, id);
        }

        public async Task<bool> DeleteAsync(int userId, int id)
        {
            var salary = await QueryOwned(userId)
                .Include(s => s.Income)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (salary == null) return false;

            var now = DateTime.UtcNow;

            salary.IsDeleted = true;
            salary.DeletedAt = now;

            salary.Income.IsDeleted = true;
            salary.Income.DeletedAt = now;
            salary.Income.DeletedByUserId = userId;

            await _context.SaveChangesAsync();
            return true;
        }

        private IQueryable<Salary> QueryOwned(int userId)
        {
            return _context.Salaries
                .Include(s => s.Deductions)
                .ThenInclude(d => d.Expense)
                .ThenInclude(e => e!.Category)
                .Where(s => s.UserId == userId);
        }

        private async Task<int> GetSalarioCategoryIdAsync()
        {
            var category = await _context.Categories
                .FirstOrDefaultAsync(c => c.IsSystem && c.Type == "ingreso" && c.Name == "Salario");

            if (category == null)
                throw new InvalidOperationException("No existe la categoría sistema 'Salario'.");

            return category.Id;
        }

        private async Task ValidateDeductionsAsync(int userId, List<SalaryDeductionInput> deductions)
        {
            var ids = deductions.Select(d => d.ExpenseId).Distinct().ToList();

            var owned = ids.Count == 0
                ? new List<int>()
                : await _context.Expenses
                    .Where(e => e.UserId == userId && ids.Contains(e.Id))
                    .Select(e => e.Id)
                    .ToListAsync();

            if (owned.Count != ids.Count)
                throw new ArgumentException("Algunos gastos seleccionados no existen o no te pertenecen.");
        }
    }
}
