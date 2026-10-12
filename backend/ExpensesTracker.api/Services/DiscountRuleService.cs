using ExpensesTracker.api.Data;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;

namespace ExpensesTracker.api.Services
{
    public class DiscountRuleService : IDiscountRuleService
    {
        private readonly AppDbContext _context;

        public DiscountRuleService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<DiscountRule>> GetByUserIdAsync(int userId, int? sourceId = null)
        {
            var query = _context.DiscountRules
                .Include(r => r.IncomeSource)
                .Where(r => r.UserId == userId);

            if (sourceId.HasValue)
                query = query.Where(r => r.IncomeSourceId == sourceId);

            return await query.OrderBy(r => r.Name).ToListAsync();
        }

        public async Task<DiscountRule?> GetByIdAsync(int id)
        {
            return await _context.DiscountRules
                .Include(r => r.IncomeSource)
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        public async Task<(DiscountRule? Rule, string? Error, int StatusCode)> CreateAsync(DiscountRule rule)
        {
            var source = await _context.IncomeSources
                .FirstOrDefaultAsync(s => s.Id == rule.IncomeSourceId && s.UserId == rule.UserId);
            if (source == null)
                return (null, "La fuente de ingreso no existe.", 404);

            var error = Validate(rule);
            if (error != null) return (null, error, 400);

            rule.Name = rule.Name.Trim();
            if (await _context.DiscountRules.AnyAsync(r =>
                    r.IncomeSourceId == rule.IncomeSourceId && r.Name == rule.Name))
                return (null, "Ya existe una regla con ese nombre en esta fuente.", 400);

            rule.CreatedAt = DateTime.UtcNow;
            _context.DiscountRules.Add(rule);
            await _context.SaveChangesAsync();

            return (rule, null, 200);
        }

        public async Task<(bool Ok, string? Error, int StatusCode)> UpdateAsync(DiscountRule rule)
        {
            var existing = await _context.DiscountRules
                .FirstOrDefaultAsync(r => r.Id == rule.Id && r.UserId == rule.UserId);
            if (existing == null) return (false, "La regla no existe.", 404);

            if (rule.IncomeSourceId != existing.IncomeSourceId)
            {
                var source = await _context.IncomeSources
                    .FirstOrDefaultAsync(s => s.Id == rule.IncomeSourceId && s.UserId == rule.UserId);
                if (source == null)
                    return (false, "La fuente de ingreso no existe.", 404);
            }

            var error = Validate(rule);
            if (error != null) return (false, error, 400);

            var newName = rule.Name.Trim();
            if (await _context.DiscountRules.AnyAsync(r =>
                    r.IncomeSourceId == rule.IncomeSourceId && r.Name == newName && r.Id != rule.Id))
                return (false, "Ya existe una regla con ese nombre en esta fuente.", 400);

            existing.IncomeSourceId = rule.IncomeSourceId;
            existing.Name = newName;
            existing.Percentage = rule.Percentage;
            existing.FixedAmount = rule.FixedAmount;
            existing.IsExpected = rule.IsExpected;

            await _context.SaveChangesAsync();
            return (true, null, 200);
        }

        public async Task<bool> ArchiveAsync(int userId, int id)
        {
            var rule = await _context.DiscountRules.IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
            if (rule == null || rule.IsArchived) return false;

            rule.IsArchived = true;
            rule.ArchivedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RestoreAsync(int userId, int id)
        {
            var rule = await _context.DiscountRules.IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
            if (rule == null || !rule.IsArchived) return false;

            var nameTaken = await _context.DiscountRules.AnyAsync(r =>
                r.IncomeSourceId == rule.IncomeSourceId && r.Name == rule.Name && r.Id != rule.Id);
            if (nameTaken) return false;

            rule.IsArchived = false;
            rule.ArchivedAt = null;
            await _context.SaveChangesAsync();
            return true;
        }

        private static string? Validate(DiscountRule rule)
        {
            if (string.IsNullOrWhiteSpace(rule.Name) || rule.Name.Trim().Length < 2 || rule.Name.Trim().Length > 60)
                return "El nombre debe tener entre 2 y 60 caracteres.";

            var hasPercentage = rule.Percentage.HasValue;
            var hasFixed = rule.FixedAmount.HasValue;

            if (hasPercentage == hasFixed)
                return "Solo se puede indicar un porcentaje o un monto fijo.";

            if (hasPercentage)
            {
                var pct = rule.Percentage!.Value;
                if (pct <= 0 || pct >= 100)
                    return "El porcentaje debe ser mayor a 0 y menor a 100.";
                if (decimal.Round(pct, 2) != pct)
                    return "El porcentaje no puede tener más de 2 decimales.";
            }

            if (hasFixed)
            {
                var fixedAmount = rule.FixedAmount!.Value;
                if (fixedAmount <= 0)
                    return "El monto fijo debe ser mayor a cero.";
                if (decimal.Round(fixedAmount, 2) != fixedAmount)
                    return "El monto fijo no puede tener más de 2 decimales.";
            }

            return null;
        }
    }
}
