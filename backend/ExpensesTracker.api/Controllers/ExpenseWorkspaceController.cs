using System.Security.Claims;
using ExpensesTracker.api.Data;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExpensesTracker.api.Controllers;

[ApiController]
[Authorize]
[Route("api/expense-workspace")]
public class ExpenseWorkspaceController(AppDbContext db) : ControllerBase
{
    private int? CurrentUserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

    [HttpGet("services")]
    public async Task<IActionResult> GetServices()
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var services = await db.SharedServices.Where(s => s.UserId == userId)
            .Include(s => s.Participants).OrderBy(s => s.Name).ToListAsync();
        return Ok(services.Select(ToServiceDto));
    }

    [HttpPost("services")]
    public async Task<IActionResult> CreateService(ServiceInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var error = ValidateService(input);
        if (error is not null) return BadRequest(error);
        if (!await OwnsCategory(userId, input.CategoryId)) return BadRequest("La categoría no existe o no está disponible.");
        var service = new SharedService { UserId = userId };
        ApplyService(service, input);
        db.SharedServices.Add(service);
        await db.SaveChangesAsync();
        return Ok(ToServiceDto(service));
    }

    [HttpPut("services/{id:int}")]
    public async Task<IActionResult> UpdateService(int id, ServiceInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var service = await db.SharedServices.Include(s => s.Participants).FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId && !s.IsArchived);
        if (service is null) return NotFound();
        var error = ValidateService(input);
        if (error is not null) return BadRequest(error);
        if (!await OwnsCategory(userId, input.CategoryId)) return BadRequest("La categoría no existe o no está disponible.");
        ApplyService(service, input);
        await db.SaveChangesAsync();
        return Ok(ToServiceDto(service));
    }

    [HttpDelete("services/{id:int}")]
    public async Task<IActionResult> ArchiveService(int id)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var service = await db.SharedServices.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
        if (service is null) return NotFound();
        service.IsArchived = true;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("services/{id:int}/restore")]
    public async Task<IActionResult> RestoreService(int id)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var service = await db.SharedServices.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
        if (service is null) return NotFound();
        service.IsArchived = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("bills")]
    public async Task<IActionResult> GetBills([FromQuery] int? year)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var query = db.SharedServiceBills.Where(b => b.UserId == userId);
        if (year.HasValue) query = query.Where(b => b.Period.Year == year.Value);
        var bills = await query.Include(b => b.Shares).Include(b => b.Reimbursements)
            .OrderByDescending(b => b.Period).ToListAsync();
        return Ok(bills.Select(ToBillDto));
    }

    [HttpGet("reimbursements")]
    public async Task<IActionResult> GetReimbursements([FromQuery] int? year, [FromQuery] int? month)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var query = db.SharedServiceReimbursements.Where(r => r.UserId == userId);
        if (year.HasValue) query = query.Where(r => r.Date.Year == year.Value);
        if (month.HasValue) query = query.Where(r => r.Date.Month == month.Value);
        var reimbursements = await query.Include(r => r.Bill).OrderByDescending(r => r.Date).ToListAsync();
        return Ok(reimbursements.Select(r => new { r.Id, r.UserId, r.BillId, r.ParticipantName, r.Amount, r.Date, r.Note, Bill = new { r.Bill.ServiceNameSnapshot, r.Bill.Period } }));
    }

    [HttpPost("bills")]
    public async Task<IActionResult> CreateBill(BillInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        if (input.GrossAmount <= 0 || decimal.Round(input.GrossAmount, 2) != input.GrossAmount) return BadRequest("Ingresá un importe válido mayor a cero.");
        var service = await db.SharedServices.Include(s => s.Participants).FirstOrDefaultAsync(s => s.Id == input.ServiceId && s.UserId == userId && !s.IsArchived);
        if (service is null) return BadRequest("El servicio no existe.");
        var period = new DateTime(input.Period.Year, input.Period.Month, 1);
        if (await db.SharedServiceBills.AnyAsync(b => b.ServiceId == service.Id && b.Period == period)) return Conflict("Ya existe una factura para ese servicio y período.");

        Expense? existingExpense = null;
        if (input.ExistingExpenseId.HasValue)
        {
            existingExpense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == input.ExistingExpenseId.Value && e.UserId == userId);
            if (existingExpense is null) return BadRequest("El gasto seleccionado no existe.");
            if (await db.PagosCuotas.AnyAsync(p => p.ExpenseId == existingExpense.Id)) return BadRequest("Vinculá una compra directa, no un gasto en cuotas.");
            if (existingExpense.CategoryId != service.CategoryId) return BadRequest("Elegí un gasto de la categoría configurada para este servicio.");
            if (existingExpense.Amount != input.GrossAmount) return BadRequest("El total de la factura debe coincidir con el gasto que vas a vincular.");
            if (await db.SharedServiceBills.AnyAsync(b => b.ExpenseId == existingExpense.Id) || await db.TaxObligations.AnyAsync(t => t.ExpenseId == existingExpense.Id)) return Conflict("Ese gasto ya está vinculado a otro registro.");
        }

        var bill = new SharedServiceBill
        {
            UserId = userId, ServiceId = service.Id, Period = period,
            ServiceNameSnapshot = service.Name, ProviderSnapshot = service.Provider,
            GrossAmount = input.GrossAmount, DueDate = input.DueDate.Date,
            ExpenseId = existingExpense?.Id, PaidAt = existingExpense?.Date.Date
        };
        foreach (var participant in service.Participants.Where(p => !p.IsOwner))
            bill.Shares.Add(new SharedServiceBillShare { ParticipantNameSnapshot = participant.Name, AgreedAmount = decimal.Round(input.GrossAmount * participant.SharePercent / 100m, 2) });
        db.SharedServiceBills.Add(bill);
        await db.SaveChangesAsync();
        return Ok(ToBillDto(await db.SharedServiceBills.Include(b => b.Shares).Include(b => b.Reimbursements).FirstAsync(b => b.Id == bill.Id)));
    }

    [HttpPost("bills/import-history")]
    public async Task<IActionResult> ImportBillHistory(ImportBillsInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        if (input.Items is null || input.Items.Count is 0 or > 120) return BadRequest("Seleccioná entre 1 y 120 gastos para importar.");
        if (input.Items.Select(i => i.ExpenseId).Distinct().Count() != input.Items.Count) return BadRequest("Un gasto no puede importarse más de una vez.");

        var serviceIds = input.Items.Select(i => i.ServiceId).Distinct().ToList();
        var services = await db.SharedServices.Include(s => s.Participants)
            .Where(s => s.UserId == userId && serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);
        if (services.Count != serviceIds.Count || services.Values.Any(s => s.IsArchived)) return BadRequest("Alguno de los servicios seleccionados no está disponible.");

        var expenseIds = input.Items.Select(i => i.ExpenseId).ToList();
        var expenses = await db.Expenses.Where(e => e.UserId == userId && expenseIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id);
        if (expenses.Count != expenseIds.Count) return BadRequest("Alguno de los gastos seleccionados no existe.");
        if (await db.PagosCuotas.AnyAsync(p => expenseIds.Contains(p.ExpenseId))) return BadRequest("La importación solo admite gastos directos, no cuotas.");
        if (await db.SharedServiceBills.AnyAsync(b => b.ExpenseId.HasValue && expenseIds.Contains(b.ExpenseId.Value)) ||
            await db.TaxObligations.AnyAsync(t => t.ExpenseId.HasValue && expenseIds.Contains(t.ExpenseId.Value)))
            return Conflict("Alguno de los gastos ya está vinculado a otro registro.");

        var normalizedPeriods = input.Items.Select(i => new DateTime(i.Period.Year, i.Period.Month, 1)).ToList();
        if (input.Items.Select((item, index) => $"{item.ServiceId}:{normalizedPeriods[index]:yyyy-MM}").Distinct().Count() != input.Items.Count)
            return Conflict("Hay más de un gasto asignado al mismo servicio y período.");
        var existingPeriods = await db.SharedServiceBills.Where(b => b.UserId == userId && serviceIds.Contains(b.ServiceId))
            .Select(b => new { b.ServiceId, b.Period }).ToListAsync();
        if (input.Items.Any(i => existingPeriods.Any(b => b.ServiceId == i.ServiceId && b.Period == new DateTime(i.Period.Year, i.Period.Month, 1))))
            return Conflict("Alguno de los servicios ya tiene una factura registrada en ese período. Actualizá la lista antes de importar.");

        foreach (var item in input.Items)
        {
            var service = services[item.ServiceId];
            var expense = expenses[item.ExpenseId];
            if (expense.CategoryId != service.CategoryId) return BadRequest($"El gasto '{expense.Description}' no pertenece a la categoría configurada para {service.Name}.");
            if (expense.Amount <= 0 || decimal.Round(expense.Amount, 2) != expense.Amount) return BadRequest("Todos los gastos deben tener un importe válido.");
        }

        await using var tx = await db.Database.BeginTransactionAsync();
        foreach (var item in input.Items)
        {
            var service = services[item.ServiceId];
            var expense = expenses[item.ExpenseId];
            var period = new DateTime(item.Period.Year, item.Period.Month, 1);
            var dueDay = Math.Min(service.DueDay, DateTime.DaysInMonth(period.Year, period.Month));
            var grossAmount = expense.Amount;
            if (input.ExpenseAmountsAreOwnerShare)
            {
                var ownerSharePercent = 100m - service.Participants.Where(p => !p.IsOwner).Sum(p => p.SharePercent);
                if (ownerSharePercent <= 0) return BadRequest($"No se puede reconstruir el total de {service.Name}: tu parte está configurada en 0%.");
                grossAmount = decimal.Round(expense.Amount * 100m / ownerSharePercent, 2);
            }
            var bill = new SharedServiceBill
            {
                UserId = userId, ServiceId = service.Id, Period = period,
                ServiceNameSnapshot = service.Name, ProviderSnapshot = service.Provider,
                GrossAmount = grossAmount, DueDate = new DateTime(period.Year, period.Month, dueDay),
                ExpenseId = expense.Id, PaidAt = expense.Date.Date,
                OwnerShareWasHistoricalAmount = input.ExpenseAmountsAreOwnerShare
            };
            foreach (var participant in service.Participants.Where(p => !p.IsOwner))
                bill.Shares.Add(new SharedServiceBillShare { ParticipantNameSnapshot = participant.Name, AgreedAmount = decimal.Round(grossAmount * participant.SharePercent / 100m, 2) });
            db.SharedServiceBills.Add(bill);
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(new { imported = input.Items.Count });
    }

    [HttpPost("bills/{id:int}/correct-historical-owner-share")]
    public async Task<IActionResult> CorrectHistoricalOwnerShare(int id)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var bill = await db.SharedServiceBills.Include(b => b.Shares).Include(b => b.Reimbursements)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
        if (bill is null) return NotFound();
        if (bill.OwnerShareWasHistoricalAmount) return Conflict("Este importe histórico ya fue corregido.");
        if (!bill.ExpenseId.HasValue || !bill.PaidAt.HasValue) return BadRequest("Solo se pueden corregir facturas históricas vinculadas a un gasto ya pagado.");
        var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == bill.ExpenseId.Value && e.UserId == userId);
        if (expense is null) return BadRequest("No se encontró el gasto histórico vinculado.");
        var oldOwnerShare = bill.GrossAmount - bill.Shares.Sum(s => s.AgreedAmount);
        if (oldOwnerShare <= 0 || bill.GrossAmount <= 0) return BadRequest("No se puede reconstruir la factura porque tu parte configurada es 0.");

        var oldGross = bill.GrossAmount;
        var correctedGross = decimal.Round(expense.Amount * oldGross / oldOwnerShare, 2);
        foreach (var share in bill.Shares)
            share.AgreedAmount = decimal.Round(correctedGross * share.AgreedAmount / oldGross, 2);
        bill.GrossAmount = correctedGross;
        bill.OwnerShareWasHistoricalAmount = true;
        await db.SaveChangesAsync();
        return Ok(ToBillDto(bill));
    }

    [HttpPost("bills/{id:int}/pay")]
    public async Task<IActionResult> PayBill(int id, PayInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var bill = await db.SharedServiceBills.Include(b => b.Service).FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
        if (bill is null) return NotFound();
        if (bill.PaidAt.HasValue) return Conflict("Esta factura ya figura como pagada.");
        if (input.PaidAt.Date > DateTime.Today) return BadRequest("La fecha de pago no puede ser futura.");
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == bill.Service.CategoryId && (c.IsSystem || c.UserId == userId));
        if (category is null) return BadRequest("La categoría del servicio ya no está disponible. Editá el servicio y elegí otra.");
        var expense = new Expense { UserId = userId, CategoryId = category.Id, Amount = bill.GrossAmount, Description = $"{bill.ServiceNameSnapshot} - {bill.Period:MM/yyyy}", Date = input.PaidAt.Date, FundingSource = FundingSource.Income };
        await using var tx = await db.Database.BeginTransactionAsync();
        db.Expenses.Add(expense);
        await db.SaveChangesAsync();
        bill.ExpenseId = expense.Id;
        bill.PaidAt = input.PaidAt.Date;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(ToBillDto(await db.SharedServiceBills.Include(b => b.Shares).Include(b => b.Reimbursements).FirstAsync(b => b.Id == id)));
    }

    [HttpPut("bills/{id:int}/amount")]
    public async Task<IActionResult> UpdateBillAmount(int id, UpdateBillAmountInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        if (input.GrossAmount <= 0 || decimal.Round(input.GrossAmount, 2) != input.GrossAmount)
            return BadRequest("Ingresá un importe válido mayor a cero, con hasta dos decimales.");

        var bill = await db.SharedServiceBills.Include(b => b.Shares).Include(b => b.Reimbursements)
            .FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
        if (bill is null) return NotFound();
        if (bill.GrossAmount <= 0) return Conflict("No se puede recalcular una factura con un total anterior inválido.");

        var correctedShares = bill.Shares.Select(share => new
        {
            Share = share,
            Amount = decimal.Round(input.GrossAmount * share.AgreedAmount / bill.GrossAmount, 2)
        }).ToList();
        foreach (var corrected in correctedShares)
        {
            var received = bill.Reimbursements.Where(r => r.ParticipantName == corrected.Share.ParticipantNameSnapshot)
                .Sum(r => r.Amount);
            if (corrected.Amount < received)
                return Conflict($"El nuevo total dejaría la parte de {corrected.Share.ParticipantNameSnapshot} por debajo de los reintegros ya registrados. Corregí primero esos reintegros o ingresá un total mayor.");
        }

        Expense? linkedExpense = null;
        if (bill.ExpenseId.HasValue)
        {
            linkedExpense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == bill.ExpenseId.Value && e.UserId == userId);
            if (linkedExpense is null) return Conflict("No se encontró el gasto asociado a esta factura. El total no se modificó.");
        }

        await using var tx = await db.Database.BeginTransactionAsync();
        bill.GrossAmount = input.GrossAmount;
        foreach (var corrected in correctedShares)
            corrected.Share.AgreedAmount = corrected.Amount;
        if (linkedExpense is not null)
            linkedExpense.Amount = input.GrossAmount;

        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(ToBillDto(bill));
    }

    [HttpPut("bills/{id:int}/shares")]
    public async Task<IActionResult> UpdateShares(int id, SharesInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var bill = await db.SharedServiceBills.Include(b => b.Shares).FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
        if (bill is null) return NotFound();
        if (bill.PaidAt.HasValue) return Conflict("Las partes quedan congeladas al pagar la factura.");
        if (input.Shares.Any(s => string.IsNullOrWhiteSpace(s.Name) || s.Amount < 0) || input.Shares.Sum(s => s.Amount) > bill.GrossAmount)
            return BadRequest("Las partes deben tener nombre, ser positivas y no superar el total de la factura.");
        db.SharedServiceBillShares.RemoveRange(bill.Shares);
        foreach (var share in input.Shares.Where(s => s.Amount > 0)) bill.Shares.Add(new SharedServiceBillShare { ParticipantNameSnapshot = share.Name.Trim(), AgreedAmount = decimal.Round(share.Amount, 2) });
        await db.SaveChangesAsync();
        return Ok(ToBillDto(bill));
    }

    [HttpPost("bills/{id:int}/reimbursements")]
    public async Task<IActionResult> AddReimbursement(int id, ReimbursementInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var bill = await db.SharedServiceBills.Include(b => b.Shares).Include(b => b.Reimbursements).FirstOrDefaultAsync(b => b.Id == id && b.UserId == userId);
        if (bill is null) return NotFound();
        if (!bill.PaidAt.HasValue) return BadRequest("Primero registrá que pagaste la factura.");
        if (string.IsNullOrWhiteSpace(input.ParticipantName) || input.Amount <= 0 || decimal.Round(input.Amount, 2) != input.Amount || input.Date.Date > DateTime.Today) return BadRequest("Revisá el nombre, monto y fecha del reintegro.");
        var owed = bill.Shares.Where(s => s.ParticipantNameSnapshot == input.ParticipantName).Sum(s => s.AgreedAmount);
        var received = bill.Reimbursements.Where(r => r.ParticipantName == input.ParticipantName).Sum(r => r.Amount);
        if (owed == 0 || received + input.Amount > owed) return BadRequest("El reintegro supera la parte pendiente de esa persona.");
        var reimbursement = new SharedServiceReimbursement { UserId = userId, BillId = bill.Id, ParticipantName = input.ParticipantName.Trim(), Amount = input.Amount, Date = input.Date.Date, Note = input.Note?.Trim() };
        db.SharedServiceReimbursements.Add(reimbursement);
        await db.SaveChangesAsync();
        return Ok(new
        {
            reimbursement.Id,
            reimbursement.UserId,
            reimbursement.BillId,
            reimbursement.ParticipantName,
            reimbursement.Amount,
            reimbursement.Date,
            reimbursement.Note,
            Bill = new { bill.ServiceNameSnapshot, bill.Period }
        });
    }

    [HttpGet("taxes")]
    public async Task<IActionResult> GetTaxes()
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        return Ok(await db.TaxObligations.Where(t => t.UserId == userId).OrderByDescending(t => t.Period).ToListAsync());
    }

    [HttpPost("taxes")]
    public async Task<IActionResult> CreateTax(TaxInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        if (input.Type is not ("Monotributo" or "VEP") || input.Amount <= 0 || decimal.Round(input.Amount, 2) != input.Amount || string.IsNullOrWhiteSpace(input.Description)) return BadRequest("Completá tipo, descripción e importe válido.");
        var period = new DateTime(input.Period.Year, input.Period.Month, 1);
        if (input.Type == "Monotributo" && await db.TaxObligations.AnyAsync(t => t.UserId == userId && t.Type == input.Type && t.Period == period)) return Conflict("Ya existe un Monotributo para ese período.");
        Expense? existingExpense = null;
        if (input.ExistingExpenseId.HasValue)
        {
            existingExpense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == input.ExistingExpenseId.Value && e.UserId == userId);
            if (existingExpense is null) return BadRequest("El gasto seleccionado no existe.");
            if (await db.PagosCuotas.AnyAsync(p => p.ExpenseId == existingExpense.Id)) return BadRequest("Vinculá una compra directa, no un gasto en cuotas.");
            var taxCategory = await db.Categories.FirstOrDefaultAsync(c => c.Id == existingExpense.CategoryId && c.Type == "gasto" && (c.IsSystem || c.UserId == userId));
            if (!string.Equals(taxCategory?.Name, "Impuestos", StringComparison.OrdinalIgnoreCase)) return BadRequest("Elegí un gasto de la categoría Impuestos.");
            if (existingExpense.Amount != input.Amount) return BadRequest("El importe debe coincidir con el gasto que vas a vincular.");
            if (await db.TaxObligations.AnyAsync(t => t.ExpenseId == existingExpense.Id) || await db.SharedServiceBills.AnyAsync(b => b.ExpenseId == existingExpense.Id)) return Conflict("Ese gasto ya está vinculado a otro registro.");
        }
        var tax = new TaxObligation { UserId = userId, Type = input.Type, Description = input.Description.Trim(), Period = period, DueDate = input.DueDate.Date, Amount = input.Amount, ExpenseId = existingExpense?.Id, PaidAt = existingExpense?.Date.Date };
        db.TaxObligations.Add(tax);
        await db.SaveChangesAsync();
        return Ok(tax);
    }

    [HttpPost("taxes/{id:int}/pay")]
    public async Task<IActionResult> PayTax(int id, PayTaxInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var tax = await db.TaxObligations.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (tax is null) return NotFound();
        if (tax.PaidAt.HasValue) return Conflict("Este impuesto ya figura como pagado.");
        if (input.PaidAt.Date > DateTime.Today) return BadRequest("La fecha de pago no puede ser futura.");
        if (!await OwnsCategory(userId, input.CategoryId)) return BadRequest("Elegí una categoría de gasto válida.");
        await using var tx = await db.Database.BeginTransactionAsync();
        var expense = new Expense { UserId = userId, CategoryId = input.CategoryId, Amount = tax.Amount, Description = tax.Description, Date = input.PaidAt.Date, FundingSource = FundingSource.Income };
        db.Expenses.Add(expense);
        await db.SaveChangesAsync();
        tax.ExpenseId = expense.Id;
        tax.PaidAt = input.PaidAt.Date;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return Ok(tax);
    }

    [HttpPut("taxes/{id:int}")]
    public async Task<IActionResult> UpdateTax(int id, TaxInput input)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var tax = await db.TaxObligations.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (tax is null) return NotFound();
        if (tax.PaidAt.HasValue) return Conflict("Para mantener el historial, un impuesto pagado no se puede editar.");
        if (input.Type is not ("Monotributo" or "VEP") || input.Amount <= 0 || string.IsNullOrWhiteSpace(input.Description)) return BadRequest("Completá tipo, descripción e importe válido.");
        var period = new DateTime(input.Period.Year, input.Period.Month, 1);
        if (input.Type == "Monotributo" && await db.TaxObligations.AnyAsync(t => t.Id != id && t.UserId == userId && t.Type == input.Type && t.Period == period)) return Conflict("Ya existe un Monotributo para ese período.");
        tax.Type = input.Type; tax.Description = input.Description.Trim(); tax.Period = period; tax.DueDate = input.DueDate.Date; tax.Amount = input.Amount;
        await db.SaveChangesAsync();
        return Ok(tax);
    }

    [HttpDelete("taxes/{id:int}")]
    public async Task<IActionResult> DeleteTax(int id)
    {
        if (CurrentUserId is not int userId) return Unauthorized();
        var tax = await db.TaxObligations.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId && !t.PaidAt.HasValue);
        if (tax is null) return NotFound();
        db.TaxObligations.Remove(tax); await db.SaveChangesAsync(); return NoContent();
    }

    private async Task<bool> OwnsCategory(int userId, int categoryId) => await db.Categories.AnyAsync(c => c.Id == categoryId && c.Type == "gasto" && (c.IsSystem || c.UserId == userId));
    private static string? ValidateService(ServiceInput x) => string.IsNullOrWhiteSpace(x.Name) || x.Name.Length > 100 || string.IsNullOrWhiteSpace(x.Provider) || x.DueDay is < 1 or > 31 || x.CategoryId <= 0 || x.Participants.Count(p => p.IsOwner) != 1 || x.Participants.Any(p => string.IsNullOrWhiteSpace(p.Name) || p.SharePercent < 0) || x.Participants.Where(p => !p.IsOwner).Sum(p => p.SharePercent) > 100 ? "Completá el servicio, proveedor, vencimiento y partes válidas (las partes no deben superar el 100%)." : null;
    private static void ApplyService(SharedService service, ServiceInput input)
    {
        service.Name = input.Name.Trim(); service.Provider = input.Provider.Trim(); service.DueDay = input.DueDay; service.CategoryId = input.CategoryId;
        service.Participants.Clear();
        foreach (var p in input.Participants) service.Participants.Add(new SharedServiceParticipant { Name = p.Name.Trim(), SharePercent = p.IsOwner ? 0 : p.SharePercent, IsOwner = p.IsOwner });
    }

    private static object ToServiceDto(SharedService service) => new
    {
        service.Id, service.Name, service.Provider, service.CategoryId, service.DueDay, service.IsArchived,
        Participants = service.Participants.Select(p => new { p.Id, p.Name, p.SharePercent, p.IsOwner })
    };

    private static object ToBillDto(SharedServiceBill bill) => new
    {
        bill.Id, bill.ServiceId, bill.Period, bill.ServiceNameSnapshot, bill.ProviderSnapshot,
        bill.GrossAmount, bill.DueDate, bill.PaidAt, bill.ExpenseId, bill.OwnerShareWasHistoricalAmount,
        Shares = bill.Shares.Select(s => new { s.Id, s.ParticipantNameSnapshot, s.AgreedAmount }),
        Reimbursements = bill.Reimbursements.Select(r => new { r.Id, r.BillId, r.ParticipantName, r.Amount, r.Date, r.Note })
    };

    public record ParticipantInput(string Name, decimal SharePercent, bool IsOwner);
    public record ServiceInput(string Name, string Provider, int CategoryId, int DueDay, List<ParticipantInput> Participants);
    public record BillInput(int ServiceId, DateTime Period, decimal GrossAmount, DateTime DueDate, int? ExistingExpenseId = null);
    public record ImportBillItem(int ExpenseId, int ServiceId, DateTime Period);
    public record ImportBillsInput(List<ImportBillItem> Items, bool ExpenseAmountsAreOwnerShare = false);
    public record PayInput(DateTime PaidAt);
    public record UpdateBillAmountInput(decimal GrossAmount);
    public record ShareInput(string Name, decimal Amount);
    public record SharesInput(List<ShareInput> Shares);
    public record ReimbursementInput(string ParticipantName, decimal Amount, DateTime Date, string? Note);
    public record TaxInput(string Type, string Description, DateTime Period, DateTime DueDate, decimal Amount, int? ExistingExpenseId = null);
    public record PayTaxInput(DateTime PaidAt, int CategoryId);
}
