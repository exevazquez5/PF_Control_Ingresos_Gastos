using ExpensesTracker.api.Data;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;

namespace ExpensesTracker.api.Services
{
    public class IncomeSourceService : IIncomeSourceService
    {
        private readonly AppDbContext _context;

        public IncomeSourceService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<IncomeSource>> GetByUserIdAsync(int userId, bool includeArchived = false)
        {
            var query = includeArchived
                ? _context.IncomeSources.IgnoreQueryFilters().Where(s => s.UserId == userId)
                : _context.IncomeSources.Where(s => s.UserId == userId);

            return await query
                .Include(s => s.DiscountRules)
                .OrderBy(s => s.Name)
                .ToListAsync();
        }

        public async Task<IncomeSource?> GetByIdAsync(int id)
        {
            return await _context.IncomeSources
                .Include(s => s.DiscountRules)
                .FirstOrDefaultAsync(s => s.Id == id);
        }

        public async Task<IncomeSource?> FindByNameAsync(int userId, string name)
        {
            var normalized = Normalize(name);
            var direct = await _context.IncomeSources
                .FirstOrDefaultAsync(s => s.UserId == userId && s.Name == normalized);
            if (direct != null) return direct;

            var alias = await _context.IncomeSourceAliases
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Name == normalized);
            if (alias == null) return null;

            return await _context.IncomeSources.FindAsync(alias.IncomeSourceId);
        }

        public async Task<(IncomeSource? Source, string? Error, int StatusCode)> CreateAsync(int userId, string name, string mode)
        {
            var error = ValidateNameAndMode(name, mode, out var normalized, out var normalizedMode);
            if (error != null) return (null, error, 400);

            if (await NameTakenAsync(userId, normalized))
                return (null, "Ya existe una fuente o alias con ese nombre.", 400);

            var source = new IncomeSource
            {
                UserId = userId,
                Name = normalized,
                Mode = normalizedMode,
                CreatedAt = DateTime.UtcNow
            };

            _context.IncomeSources.Add(source);
            await _context.SaveChangesAsync();

            return (source, null, 200);
        }

        public async Task<(bool Ok, string? Error, int StatusCode)> RenameAsync(int userId, int id, string newName)
        {
            var source = await _context.IncomeSources.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
            if (source == null) return (false, "La fuente de ingreso no existe.", 404);

            var normalized = Normalize(newName);
            if (normalized.Length < 2 || normalized.Length > 60)
                return (false, "El nombre debe tener entre 2 y 60 caracteres.", 400);

            if (normalized == source.Name)
                return (true, null, 200);

            if (await NameTakenAsync(userId, normalized))
                return (false, "Ya existe una fuente o alias con ese nombre.", 400);

            // D11: el nombre anterior queda como alias para no perder historial ni autocomplete
            _context.IncomeSourceAliases.Add(new IncomeSourceAlias
            {
                IncomeSourceId = source.Id,
                UserId = userId,
                Name = source.Name,
                CreatedAt = DateTime.UtcNow
            });

            source.Name = normalized;
            await _context.SaveChangesAsync();

            return (true, null, 200);
        }

        public async Task<(bool Ok, string? Error, int StatusCode)> SetModeAsync(int userId, int id, string mode)
        {
            if (!IsValidMode(mode, out var normalizedMode))
                return (false, "El modo debe ser \"neto\" o \"bruto\".", 400);

            var source = await _context.IncomeSources.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
            if (source == null) return (false, "La fuente de ingreso no existe.", 404);

            source.Mode = normalizedMode;
            await _context.SaveChangesAsync();

            return (true, null, 200);
        }

        public async Task<bool> ArchiveAsync(int userId, int id)
        {
            var source = await _context.IncomeSources.IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
            if (source == null || source.IsArchived) return false;

            source.IsArchived = true;
            source.ArchivedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RestoreAsync(int userId, int id)
        {
            var source = await _context.IncomeSources.IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
            if (source == null || !source.IsArchived) return false;

            if (await NameTakenAsync(userId, source.Name, excludeSourceId: source.Id))
                return false;

            source.IsArchived = false;
            source.ArchivedAt = null;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<(bool Ok, string? Error, int StatusCode)> MergeAsync(int userId, int sourceId, int targetSourceId)
        {
            if (sourceId == targetSourceId)
                return (false, "No se puede fusionar una fuente consigo misma.", 400);

            var source = await _context.IncomeSources.FirstOrDefaultAsync(s => s.Id == sourceId && s.UserId == userId);
            var target = await _context.IncomeSources.FirstOrDefaultAsync(s => s.Id == targetSourceId && s.UserId == userId);
            if (source == null || target == null)
                return (false, "La fuente de ingreso no existe.", 404);

            var incomes = await _context.Incomes.IgnoreQueryFilters()
                .Where(i => i.SourceId == source.Id)
                .ToListAsync();
            foreach (var income in incomes)
                income.SourceId = target.Id;

            var sourceAliases = await _context.IncomeSourceAliases
                .Where(a => a.IncomeSourceId == source.Id)
                .ToListAsync();
            foreach (var alias in sourceAliases)
                alias.IncomeSourceId = target.Id;

            // El nombre de la fuente fusionada queda como alias del sobreviviente (D11)
            _context.IncomeSourceAliases.Add(new IncomeSourceAlias
            {
                IncomeSourceId = target.Id,
                UserId = userId,
                Name = source.Name,
                CreatedAt = DateTime.UtcNow
            });

            var rules = await _context.DiscountRules
                .Where(r => r.IncomeSourceId == source.Id)
                .ToListAsync();
            foreach (var rule in rules)
            {
                var nameTaken = await _context.DiscountRules.AnyAsync(r =>
                    r.IncomeSourceId == target.Id && r.Name == rule.Name && r.Id != rule.Id);
                if (nameTaken)
                {
                    rule.IsArchived = true;
                    rule.ArchivedAt = DateTime.UtcNow;
                    continue;
                }
                rule.IncomeSourceId = target.Id;
            }

            _context.IncomeSources.Remove(source);
            await _context.SaveChangesAsync();

            return (true, null, 200);
        }

        public async Task<List<IncomeSourceAlias>> GetAliasesByUserIdAsync(int userId)
        {
            return await _context.IncomeSourceAliases
                .Where(a => a.UserId == userId)
                .OrderBy(a => a.Name)
                .ToListAsync();
        }

        private async Task<bool> NameTakenAsync(int userId, string normalizedName, int? excludeSourceId = null)
        {
            var sourceTaken = await _context.IncomeSources.IgnoreQueryFilters()
                .AnyAsync(s => s.UserId == userId && s.Name == normalizedName && s.Id != excludeSourceId);
            if (sourceTaken) return true;

            return await _context.IncomeSourceAliases
                .AnyAsync(a => a.UserId == userId && a.Name == normalizedName);
        }

        private static string? ValidateNameAndMode(string name, string mode, out string normalizedName, out string normalizedMode)
        {
            normalizedName = Normalize(name);
            normalizedMode = IncomeSource.ModeNeto;

            if (normalizedName.Length < 2 || normalizedName.Length > 60)
                return "El nombre debe tener entre 2 y 60 caracteres.";

            if (!IsValidMode(mode, out normalizedMode))
                return "El modo debe ser \"neto\" o \"bruto\".";

            return null;
        }

        private static bool IsValidMode(string mode, out string normalizedMode)
        {
            normalizedMode = (mode ?? string.Empty).Trim().ToLowerInvariant();
            return normalizedMode == IncomeSource.ModeNeto || normalizedMode == IncomeSource.ModeBruto;
        }

        private static string Normalize(string name)
        {
            return (name ?? string.Empty).Trim();
        }
    }
}
