using ExpensesTracker.api.Data;
using ExpensesTracker.api.Dtos.DiscountRule;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ExpensesTracker.api.Services
{
    public class DiscountRuleService : IDiscountRuleService
    {
        private readonly AppDbContext _context;

        private const string MsgRuleNotFound = "La regla no existe.";
        private const string MsgLinkedOnlyBruto = "Las reglas vinculadas a gastos y las reglas esperadas solo pueden crearse en fuentes de modo Bruto.";
        private const string MsgLinkedCategoryInvalid = "La categoría vinculada no existe o no es de tipo gasto.";
        private static readonly Regex LinkedDescriptionRx = new(@"^[a-zA-Z0-9\s.,\-()áéíóúÁÉÍÓÚñÑ+]*$");

        public DiscountRuleService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<DiscountRule>> GetByUserIdAsync(int userId, int? sourceId = null)
        {
            var query = _context.DiscountRules
                .Include(r => r.IncomeSource)
                .Include(r => r.LinkedCategory)
                .Where(r => r.UserId == userId);

            if (sourceId.HasValue)
                query = query.Where(r => r.IncomeSourceId == sourceId);

            return await query.OrderBy(r => r.Name).ToListAsync();
        }

        public async Task<DiscountRule?> GetByIdAsync(int id)
        {
            return await _context.DiscountRules
                .Include(r => r.IncomeSource)
                .Include(r => r.LinkedCategory)
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        public async Task<(DiscountRule? Rule, string? Error, int StatusCode)> CreateAsync(DiscountRule rule)
        {
            var source = await _context.IncomeSources
                .FirstOrDefaultAsync(s => s.Id == rule.IncomeSourceId && s.UserId == rule.UserId);
            if (source == null)
                return (null, "La fuente de ingreso no existe.", 404);

            // Vigencia: si no se indica, arranca el primer día del mes de creación.
            rule.ValidFrom = rule.ValidFrom == default
                ? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1)
                : rule.ValidFrom.Date;

            var (error, statusCode) = Validate(rule, source);
            if (error != null) return (null, error, statusCode);

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
            if (existing == null) return (false, MsgRuleNotFound, 404);

            IncomeSource? source;
            if (rule.IncomeSourceId != existing.IncomeSourceId)
            {
                source = await _context.IncomeSources
                    .FirstOrDefaultAsync(s => s.Id == rule.IncomeSourceId && s.UserId == rule.UserId);
                if (source == null)
                    return (false, "La fuente de ingreso no existe.", 404);
            }
            else
            {
                source = await _context.IncomeSources
                    .FirstOrDefaultAsync(s => s.Id == rule.IncomeSourceId);
            }
            if (source == null) return (false, "La fuente de ingreso no existe.", 404);

            // Vigencia: si el cliente no la envía (default), se conserva la existente.
            rule.ValidFrom = rule.ValidFrom == default ? existing.ValidFrom : rule.ValidFrom.Date;

            var (error, statusCode) = Validate(rule, source);
            if (error != null) return (false, error, statusCode);

            var newName = rule.Name.Trim();
            if (await _context.DiscountRules.AnyAsync(r =>
                    r.IncomeSourceId == rule.IncomeSourceId && r.Name == newName && r.Id != rule.Id))
                return (false, "Ya existe una regla con ese nombre en esta fuente.", 400);

            existing.IncomeSourceId = rule.IncomeSourceId;
            existing.Name = newName;
            existing.Percentage = rule.Percentage;
            existing.FixedAmount = rule.FixedAmount;
            existing.LinkedCategoryId = rule.LinkedCategoryId;
            existing.LinkedDescription = string.IsNullOrWhiteSpace(rule.LinkedDescription) ? null : rule.LinkedDescription.Trim();
            existing.IsExpected = rule.IsExpected;
            existing.ValidFrom = rule.ValidFrom;
            existing.ValidTo = rule.ValidTo;

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

        public async Task<ExpenseRuleAssignmentDto> AssignExpenseAsync(int userId, int ruleId, AssignExpenseDto dto)
        {
            var rule = await _context.DiscountRules
                .FirstOrDefaultAsync(r => r.Id == ruleId && r.UserId == userId);
            if (rule == null)
                throw new KeyNotFoundException(MsgRuleNotFound);

            if (!rule.IsLinked)
                throw new InvalidOperationException("Solo las reglas vinculadas a gastos admiten reasignación manual.");

            var expense = await _context.Expenses
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(e => e.Id == dto.ExpenseId && e.UserId == userId && !e.IsDeleted);
            if (expense == null)
                throw new KeyNotFoundException("El gasto no existe.");

            var tieneCuotas = await _context.PagosCuotas.AnyAsync(pc => pc.ExpenseId == expense.Id);

            if (!tieneCuotas && dto.PagoCuotaId.HasValue)
                throw new InvalidOperationException("El gasto no tiene cuotas.");

            if (tieneCuotas)
            {
                if (!dto.PagoCuotaId.HasValue)
                    throw new InvalidOperationException("El gasto posee cuotas; debe indicar la cuota puntual a asignar.");
                var cuota = await _context.PagosCuotas.FirstOrDefaultAsync(pc => pc.Id == dto.PagoCuotaId.Value && pc.ExpenseId == expense.Id);
                if (cuota == null)
                    throw new KeyNotFoundException("La cuota no existe.");
            }

            if (dto.Year < 2000 || dto.Year > 2100 || dto.Month < 1 || dto.Month > 12)
                throw new InvalidOperationException("El período indicado no es válido.");

            var alreadyAssigned = dto.PagoCuotaId.HasValue
                ? await _context.ExpenseRuleAssignments.AnyAsync(a => a.PagoCuotaId == dto.PagoCuotaId.Value)
                : await _context.ExpenseRuleAssignments.AnyAsync(a => a.ExpenseId == expense.Id && a.PagoCuotaId == null);
            if (alreadyAssigned)
                throw new InvalidOperationException(dto.PagoCuotaId.HasValue
                    ? "La cuota ya está asignada a una regla."
                    : "El gasto ya está asignado a una regla.");

            var assignment = new ExpenseRuleAssignment
            {
                UserId = userId,
                RuleId = ruleId,
                ExpenseId = expense.Id,
                PagoCuotaId = dto.PagoCuotaId,
                Year = dto.Year,
                Month = dto.Month,
                CreatedAt = DateTime.UtcNow
            };

            _context.ExpenseRuleAssignments.Add(assignment);
            await _context.SaveChangesAsync();

            return MapAssignment(assignment);
        }

        public async Task<bool> UnassignExpenseAsync(int userId, int ruleId, int expenseId, int? pagoCuotaId)
        {
            var q = _context.ExpenseRuleAssignments.AsQueryable();
            if (pagoCuotaId.HasValue)
                q = q.Where(a => a.PagoCuotaId == pagoCuotaId.Value);
            else
                q = q.Where(a => a.ExpenseId == expenseId && a.PagoCuotaId == null);

            var assignment = await q.FirstOrDefaultAsync(a => a.UserId == userId && a.RuleId == ruleId);
            if (assignment == null) return false;

            _context.ExpenseRuleAssignments.Remove(assignment);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<MonthDiscountsDto> ComputeMonthDiscountsAsync(int userId, int year, int month)
        {
            var start = new DateTime(year, month, 1);
            var end = start.AddMonths(1);

            var incomes = await _context.Incomes
                .IgnoreQueryFilters()
                .Include(i => i.Source)
                .Where(i => i.UserId == userId && !i.IsDeleted && i.Date >= start && i.Date < end)
                .ToListAsync();

            // Solo las reglas vigentes en el mes (ValidFrom/ValidTo).
            var rules = await _context.DiscountRules
                .Where(r => r.UserId == userId
                    && r.ValidFrom < end
                    && (r.ValidTo == null || r.ValidTo >= start))
                .Include(r => r.IncomeSource)
                .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id)
                .ToListAsync();

            var allAssignments = await _context.ExpenseRuleAssignments
                .Where(a => a.UserId == userId)
                .ToListAsync();

            var monthAssignments = allAssignments
                .Where(a => a.Year == year && a.Month == month)
                .ToList();

            var nonCuotaExpenses = await _context.Expenses
                .IgnoreQueryFilters()
                .Where(e => e.UserId == userId && !e.IsDeleted
                    && e.Date >= start && e.Date < end
                    && !_context.PagosCuotas.Any(pc => pc.ExpenseId == e.Id))
                .ToListAsync();

            // Cuotas del mes: SOLO las pagadas, por fecha de pago (PaidAt), igual que el
            // Dashboard (/Expenses/cuotas/pagadas). El vencimiento (DueDate) no decide.
            var pagosDelMes = await _context.PagosCuotas
                .Include(pc => pc.Expense)
                .Where(pc => pc.Expense != null && !pc.Expense.IsDeleted && pc.Expense.UserId == userId
                    && pc.Status == PagoCuotaStatus.Paid
                    && pc.PaidAt.HasValue && pc.PaidAt.Value >= start && pc.PaidAt.Value < end)
                .ToListAsync();

            // ── Agregado de ingresos por fuente (clasificando por el snapshot de modo) ──
            var sourcesById = new Dictionary<int, SourceDiscountsDto>();
            var netoConBrutoBySource = new Dictionary<int, decimal>();
            const int syntheticSourceId = -1;

            foreach (var income in incomes)
            {
                var sourceId = income.SourceId ?? syntheticSourceId;
                if (!sourcesById.TryGetValue(sourceId, out var s))
                    sourcesById[sourceId] = s = new SourceDiscountsDto
                    {
                        SourceId = sourceId,
                        SourceName = income.Source?.Name ?? "Sin fuente",
                        // El modo de la fuente solo se muestra; la deducción se decide por mes.
                        Mode = income.Source?.Mode
                            ?? (string.Equals(income.Mode?.Trim(), IncomeSource.ModeBruto, StringComparison.OrdinalIgnoreCase) ? IncomeSource.ModeBruto : IncomeSource.ModeNeto),
                        Reglas = new List<DiscountLineDto>()
                    };

                // Cada ingreso se clasifica por su propio snapshot de modo (D1).
                var incomeMode = string.IsNullOrWhiteSpace(income.Mode)
                    ? (income.Source?.Mode ?? IncomeSource.ModeNeto)
                    : (string.Equals(income.Mode.Trim(), IncomeSource.ModeBruto, StringComparison.OrdinalIgnoreCase) ? IncomeSource.ModeBruto : IncomeSource.ModeNeto);

                if (incomeMode == IncomeSource.ModeBruto) s.IngresosBruto += income.Amount;
                else
                {
                    s.IngresosNeto += income.Amount;
                    if (income.GrossAmount.HasValue)
                    {
                        s.GrossTotal = (s.GrossTotal ?? 0m) + income.GrossAmount.Value;
                        // OtrosSinDetallar resta solo los netos que TAMBIÉN traen bruto del recibo.
                        netoConBrutoBySource[sourceId] = netoConBrutoBySource.GetValueOrDefault(sourceId) + income.Amount;
                    }
                }
            }

            foreach (var s in sourcesById.Values)
                s.TieneIngresos = s.IngresosBruto > 0 || s.IngresosNeto > 0;

            // Una fuente "deduce" este mes solo si tuvo ingresos brutos ese mes. No importa el
            // modo actual de la fuente (los ingresos con snapshot Neto nunca se restan), así un
            // cambio de modo no altera meses históricos.
            bool SourceDeduce(int sourceId) =>
                sourcesById.TryGetValue(sourceId, out var s) && s.IngresosBruto > 0;

            var candidates = new List<CandidateExpense>();
            foreach (var e in nonCuotaExpenses)
                candidates.Add(new CandidateExpense(new CandidateKey(e.Id, null), e.Amount, e.CategoryId, e.Description));
            foreach (var pc in pagosDelMes)
                candidates.Add(new CandidateExpense(new CandidateKey(pc.ExpenseId, pc.Id), pc.MontoCuota, pc.Expense!.CategoryId, pc.Expense.Description));

            var excludedExpenseIds = allAssignments.Where(a => a.PagoCuotaId == null).Select(a => a.ExpenseId).ToHashSet();
            var excludedCuotaIds = allAssignments.Where(a => a.PagoCuotaId != null).Select(a => a.PagoCuotaId!.Value).ToHashSet();

            var autoMatches = new Dictionary<int, decimal>();
            var autoCounts = new Dictionary<int, int>();
            var consumed = new HashSet<CandidateKey>();

            // Auto-match: solo reglas vinculadas de fuentes que deducen este mes. Una fuente
            // sin ingreso (o sin bruto) ese mes no consume gastos para otras reglas.
            foreach (var rule in rules.Where(r => r.IsLinked && SourceDeduce(r.IncomeSourceId)))
            {
                var amount = 0m;
                var count = 0;
                foreach (var cand in candidates.Where(c => !consumed.Contains(c.Key) && !IsTaken(c.Key, excludedExpenseIds, excludedCuotaIds)))
                {
                    if (Matches(rule, cand))
                    {
                        amount += cand.Amount;
                        count++;
                        consumed.Add(cand.Key);
                    }
                }
                if (count > 0)
                {
                    autoMatches[rule.Id] = amount;
                    autoCounts[rule.Id] = count;
                }
            }

            foreach (var rule in rules)
            {
                if (!sourcesById.TryGetValue(rule.IncomeSourceId, out var s))
                    sourcesById[rule.IncomeSourceId] = s = new SourceDiscountsDto
                    {
                        SourceId = rule.IncomeSourceId,
                        SourceName = rule.IncomeSource?.Name ?? "Fuente n/o",
                        Mode = rule.IncomeSource?.Mode ?? IncomeSource.ModeNeto,
                        Reglas = new List<DiscountLineDto>()
                    };

                // Deduce solo si la fuente tiene ingresos brutos ese mes (no por el modo actual).
                var deduce = s.IngresosBruto > 0;
                decimal? monto = null;
                var requiereBruto = false;
                var gastosVinculados = 0;

                if (rule.FixedAmount.HasValue)
                {
                    monto = rule.FixedAmount;
                }
                else if (rule.Percentage.HasValue)
                {
                    // El % aplica sobre el bruto del mes; si no hay, sobre el bruto del recibo
                    // (informativo, no deduce).
                    var baseImporte = s.IngresosBruto > 0 ? s.IngresosBruto : (s.GrossTotal ?? 0m);
                    if (baseImporte > 0)
                        monto = Math.Round(baseImporte * rule.Percentage.Value / 100m, 2);
                    else
                        requiereBruto = true;
                }
                else if (rule.IsLinked)
                {
                    var manual = monthAssignments.Where(a => a.RuleId == rule.Id).ToList();
                    var manualAmount = await ExpenseRuleAssignmentAmountAsync(manual);
                    var auto = autoMatches.ContainsKey(rule.Id) ? autoMatches[rule.Id] : 0m;
                    gastosVinculados = manual.Count + (autoCounts.ContainsKey(rule.Id) ? autoCounts[rule.Id] : 0);
                    if (gastosVinculados > 0)
                        monto = manualAmount + auto;
                }

                s.Reglas.Add(new DiscountLineDto
                {
                    Id = rule.Id,
                    Name = rule.Name,
                    Tipo = rule.FixedAmount.HasValue ? "fija" : rule.Percentage.HasValue ? "porcentaje" : "vinculada",
                    Porcentaje = rule.Percentage,
                    Fijo = rule.FixedAmount,
                    Monto = monto,
                    Deduce = deduce,
                    RequiereBruto = requiereBruto,
                    GastosVinculados = gastosVinculados
                });

                if (deduce && monto.HasValue)
                    s.Descuentos += monto.Value;
            }

            foreach (var s in sourcesById.Values)
            {
                if (s.GrossTotal.HasValue)
                {
                    // Resta solo los netos con bruto del recibo, no todos los netos (D8).
                    var netoConBruto = netoConBrutoBySource.GetValueOrDefault(s.SourceId);
                    var explicado = s.Reglas.Where(r => r.Monto.HasValue).Sum(r => r.Monto!.Value);
                    var otros = (s.GrossTotal.Value - netoConBruto) - explicado;
                    s.OtrosSinDetallar = Math.Round(otros, 2);
                    s.AvisoOtros = otros < 0;
                }
                // Neto real por fuente: puede ser negativo si los descuentos superan el ingreso.
                // Solo se omite (null) cuando la fuente no tiene ingresos en el mes.
                s.TieneIngresos = s.IngresosBruto > 0 || s.IngresosNeto > 0;
                if (s.TieneIngresos)
                {
                    s.Neto = s.IngresosBruto - s.Descuentos + s.IngresosNeto;
                    s.AvisoNeto = s.Neto < 0;
                }
                else
                {
                    s.Neto = null;
                    s.AvisoNeto = false;
                }
            }

            var total = incomes.Sum(i => i.Amount);
            var descuentos = sourcesById.Values.Sum(s => s.Descuentos);

            return new MonthDiscountsDto
            {
                Year = year,
                Month = month,
                Total = total,
                Descuentos = descuentos,
                // Invariante: Neto del mes == Total - Descuentos (meses con ingreso).
                Neto = incomes.Count == 0 ? (decimal?)null : total - descuentos,
                Fuentes = sourcesById.Values
                    .Where(s => s.TieneIngresos || s.Reglas.Count > 0)
                    .OrderBy(s => s.SourceId == syntheticSourceId).ThenBy(s => s.SourceName)
                    .ToList()
            };
        }

        private async Task<decimal> ExpenseRuleAssignmentAmountAsync(List<ExpenseRuleAssignment> assignments)
        {
            var total = 0m;
            foreach (var a in assignments)
            {
                if (a.PagoCuotaId.HasValue)
                {
                    var cuota = await _context.PagosCuotas.FirstOrDefaultAsync(pc => pc.Id == a.PagoCuotaId.Value);
                    if (cuota != null) total += cuota.MontoCuota;
                }
                else
                {
                    var expense = await _context.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == a.ExpenseId);
                    if (expense != null && !expense.IsDeleted) total += expense.Amount;
                }
            }
            return total;
        }

        private static bool IsTaken(CandidateKey key, HashSet<int> excludedExpenseIds, HashSet<int> excludedCuotaIds)
        {
            if (key.PagoCuotaId.HasValue)
                return excludedCuotaIds.Contains(key.PagoCuotaId.Value) || excludedExpenseIds.Contains(key.ExpenseId);
            return excludedExpenseIds.Contains(key.ExpenseId);
        }

        private static bool Matches(DiscountRule rule, CandidateExpense cand)
        {
            if (rule.LinkedCategoryId.HasValue && cand.CategoryId != rule.LinkedCategoryId.Value)
                return false;
            if (!string.IsNullOrWhiteSpace(rule.LinkedDescription))
            {
                if (!Normalize(cand.Description).Contains(Normalize(rule.LinkedDescription), StringComparison.OrdinalIgnoreCase))
                    return false;
            }
            return true;
        }

        private static string Normalize(string value)
        {
            var normalized = value.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var ch in normalized)
                if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                    sb.Append(ch);
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }

        private static ExpenseRuleAssignmentDto MapAssignment(ExpenseRuleAssignment a)
        {
            return new ExpenseRuleAssignmentDto
            {
                Id = a.Id,
                RuleId = a.RuleId,
                ExpenseId = a.ExpenseId,
                PagoCuotaId = a.PagoCuotaId,
                Year = a.Year,
                Month = a.Month
            };
        }

        private (string? Error, int StatusCode) Validate(DiscountRule rule, IncomeSource source)
        {
            if (string.IsNullOrWhiteSpace(rule.Name) || rule.Name.Trim().Length < 2 || rule.Name.Trim().Length > 60)
                return ("El nombre debe tener entre 2 y 60 caracteres.", 400);

            var hasPercentage = rule.Percentage.HasValue;
            var hasFixed = rule.FixedAmount.HasValue;
            var isLinked = rule.LinkedCategoryId.HasValue || !string.IsNullOrWhiteSpace(rule.LinkedDescription);

            // Una regla es fija, porcentual o vinculada a gastos (mutuamente excluyentes).
            if (isLinked)
            {
                if (hasPercentage || hasFixed)
                    return ("Una regla vinculada a gastos no puede tener porcentaje ni monto fijo.", 400);
            }
            else if (hasPercentage == hasFixed)
            {
                return ("Solo se puede indicar un porcentaje o un monto fijo.", 400);
            }

            if (hasPercentage)
            {
                var pct = rule.Percentage!.Value;
                if (pct <= 0 || pct >= 100)
                    return ("El porcentaje debe ser mayor a 0 y menor a 100.", 400);
                if (decimal.Round(pct, 2) != pct)
                    return ("El porcentaje no puede tener más de 2 decimales.", 400);
            }

            if (hasFixed)
            {
                var fixedAmount = rule.FixedAmount!.Value;
                if (fixedAmount <= 0)
                    return ("El monto fijo debe ser mayor a cero.", 400);
                if (decimal.Round(fixedAmount, 2) != fixedAmount)
                    return ("El monto fijo no puede tener más de 2 decimales.", 400);
            }

            if (rule.ValidTo.HasValue && rule.ValidTo.Value.Date < rule.ValidFrom.Date)
                return ("La fecha de fin de vigencia no puede ser anterior a la de inicio.", 400);

            var esBruto = string.Equals(source.Mode?.Trim(), IncomeSource.ModeBruto, StringComparison.OrdinalIgnoreCase);

            if (!esBruto && (isLinked || rule.IsExpected))
                return (MsgLinkedOnlyBruto, 400);

            if (rule.IsExpected && !isLinked)
                return ("Las reglas esperadas deben vincularse a un gasto (categoría y/o descripción).", 400);

            if (rule.LinkedCategoryId.HasValue)
            {
                var category = _context.Categories.IgnoreQueryFilters()
                    .FirstOrDefault(c => c.Id == rule.LinkedCategoryId.Value);
                if (category == null || !string.Equals(category.Type, "gasto", StringComparison.OrdinalIgnoreCase)
                    || (category.UserId.HasValue && category.UserId.Value != rule.UserId))
                    return (MsgLinkedCategoryInvalid, 404);
            }

            if (!string.IsNullOrWhiteSpace(rule.LinkedDescription))
            {
                var desc = rule.LinkedDescription.Trim();
                if (desc.Length < 3 || desc.Length > 100)
                    return ("La descripción vinculada debe tener entre 3 y 100 caracteres.", 400);
                if (!LinkedDescriptionRx.IsMatch(desc))
                    return ("La descripción vinculada contiene caracteres no permitidos.", 400);
            }

            return (null, 200);
        }

        private readonly record struct CandidateKey(int ExpenseId, int? PagoCuotaId);

        private readonly record struct CandidateExpense(CandidateKey Key, decimal Amount, int CategoryId, string Description);
    }
}