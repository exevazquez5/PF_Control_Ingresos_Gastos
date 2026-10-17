using ExpensesTracker.api.Data;
using ExpensesTracker.api.Dtos.Expense;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;
using static System.Math;

[ApiController]
[Route("api/[controller]")]
public class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenseService;
    private readonly ICategoryService _categoryService;
    private readonly AppDbContext _context;

    public bool TieneCuotas { get; private set; }

    public ExpensesController(IExpenseService expenseService, ICategoryService categoryService, AppDbContext context)
    {
        _expenseService = expenseService;
        _categoryService = categoryService;
        _context = context;
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        // Obtener ID del usuario desde el JWT
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null)
        {
            return Unauthorized("Token inválido: no contiene el claim 'nameidentifier'.");
        }

        if (!int.TryParse(subClaim.Value, out var userId))
        {
            return Unauthorized("Token inválido: el claim 'nameidentifier' no es un entero válido.");
        }
        // Verificar si tiene el rol Admin
        var isAdmin = User.IsInRole("Admin");

        // Obtener gastos según rol
        var expenses = isAdmin
            ? await _expenseService.GetAllAsync()
            : await _expenseService.GetByUserId(userId);

        // Mapear a DTO
        var expenseDtos = await MapExpensesAsync(expenses);

        return Ok(expenseDtos);
    }

    [Authorize]
    [HttpGet("current-month")]
    public async Task<IActionResult> GetCurrentMonthExpenses()
    {
        // Obtener ID del usuario desde el JWT
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null)
        {
            return Unauthorized("Token inválido: no contiene el claim 'nameidentifier'.");
        }

        if (!int.TryParse(subClaim.Value, out var userId))
        {
            return Unauthorized("Token inválido: el claim 'nameidentifier' no es un entero válido.");
        }

        var expenses = await _expenseService.GetByUserIdCurrentMonth(userId);

        // Mapear a DTO
        var expenseDtos = await MapExpensesAsync(expenses);

        return Ok(expenseDtos);

    }

    [Authorize]
    [HttpGet("month/{month:int}/{year:int}")]
    public async Task<ActionResult<IEnumerable<ExpenseDto>>> GetByMonth(int month, int year)
    {
        // Obtener ID del usuario desde el JWT
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null)
        {
            return Unauthorized("Token inválido: no contiene el claim 'nameidentifier'.");
        }

        if (!int.TryParse(subClaim.Value, out var userId))
        {
            return Unauthorized("Token inválido: el claim 'nameidentifier' no es un entero válido.");
        }

        var expenses = await _expenseService.GetByUserIdAndMonth(userId, month, year);

        // Mapear a DTO
        var expenseDtos = await MapExpensesAsync(expenses);

        return Ok(expenseDtos);

    }

    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var expense = await _expenseService.GetByIdAsync(id);
        if (expense == null) return NotFound();

        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userIdFromToken))
            return Unauthorized("Token inválido.");

        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && expense.UserId != userIdFromToken)
            return StatusCode(403, "No puedes acceder a gastos de otro usuario.");


        var dto = new ExpenseDto
        {
            Id = expense.Id,
            Amount = expense.Amount,
            Description = expense.Description,
            Date = expense.Date,
            CategoryId = expense.CategoryId,
            CategoryName = expense.Category?.Name ?? "N/A",
            UserId = expense.UserId,
            Username = expense.User?.Username ?? "N/A",
            CreditCardId = expense.CreditCardId,
            FundingSource = expense.FundingSource.ToString()
        };

        return Ok(dto);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        // ✅ Validar que el monto sea mayor a cero
        if (dto.Amount <= 0)
            return BadRequest("El monto debe ser mayor a cero.");

        // ✅ Validar que el monto no tenga más de 2 decimales
        if (decimal.Round(dto.Amount, 2) != dto.Amount)
            return BadRequest("El monto no puede tener más de 2 decimales.");

        // ✅ Validar que la descripción no esté vacía ni sea solo espacios
        if (string.IsNullOrWhiteSpace(dto.Description))
            return BadRequest("La descripción no puede estar vacía ni contener solo espacios.");

        // ✅ Validar longitud de la descripción (mínimo 3, máximo 100 caracteres)
        if (dto.Description.Length < 3 || dto.Description.Length > 100)
            return BadRequest("La descripción debe tener entre 3 y 100 caracteres.");

        // ✅ Validar que la descripción no contenga caracteres especiales no deseados
        var regex = new Regex(@"^[a-zA-Z0-9\s.,\-()áéíóúÁÉÍÓÚñÑ+]*$");
        if (!regex.IsMatch(dto.Description))
            return BadRequest("La descripción contiene caracteres no permitidos.");

        // ✅ Validar que la fecha no sea futura
        if (dto.Date > DateTime.Now)
            return BadRequest("La fecha no puede ser en el futuro.");


        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var category = await _categoryService.GetByIdAsync(dto.CategoryId);
        if (category == null)
            return BadRequest($"La categoria con id {dto.CategoryId} no existe.");

        var expense = new Expense
        {
            Amount = dto.Amount,
            Description = dto.Description,
            Date = dto.Date,
            CategoryId = dto.CategoryId,
            UserId = userId,
            CreditCardId = dto.CreditCardId,
            FundingSource = dto.FundingSource
        };

        var created = await _expenseService.CreateAsync(expense);

        var resultDto = new ExpenseDto
        {
            Id = created.Id,
            Amount = created.Amount,
            Description = created.Description,
            Date = created.Date,
            CategoryId = created.CategoryId,
            CategoryName = created.Category?.Name ?? "N/A",
            UserId = created.UserId,
            Username = created.User?.Username ?? "N/A",
            CreditCardId = created.CreditCardId,
            FundingSource = created.FundingSource.ToString()
        };

        return CreatedAtAction(nameof(GetById), new { id = resultDto.Id }, resultDto);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateExpenseDto dto)
    {
        if (id != dto.Id) return BadRequest("ID mismatch");
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var originalExpense = await _expenseService.GetByIdAsync(id);
        if (originalExpense == null) return NotFound();

        // ✅ Validar que el monto sea mayor a cero
        if (dto.Amount <= 0)
            return BadRequest("El monto debe ser mayor a cero.");

        // ✅ Validar que el monto no tenga más de 2 decimales
        if (decimal.Round(dto.Amount, 2) != dto.Amount)
            return BadRequest("El monto no puede tener más de 2 decimales.");

        // ✅ Validar que la descripción no esté vacía ni sea solo espacios
        if (string.IsNullOrWhiteSpace(dto.Description))
            return BadRequest("La descripción no puede estar vacía ni contener solo espacios.");

        // ✅ Validar longitud de la descripción (mínimo 3, máximo 100 caracteres)
        if (dto.Description.Length < 3 || dto.Description.Length > 100)
            return BadRequest("La descripción debe tener entre 3 y 100 caracteres.");

        // ✅ Validar que la descripción no contenga caracteres especiales no deseados
        var regex = new Regex(@"^[a-zA-Z0-9\s.,\-()áéíóúÁÉÍÓÚñÑ+]*$");
        if (!regex.IsMatch(dto.Description))
            return BadRequest("La descripción contiene caracteres no permitidos.");

        // ✅ Validar que la fecha no sea futura
        if (dto.Date > DateTime.Now)
            return BadRequest("La fecha no puede ser en el futuro.");

        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userIdFromToken))
            return Unauthorized("Token inválido.");

        var category = await _categoryService.GetByIdAsync(dto.CategoryId);
        if (category == null)
            return BadRequest($"La categoria con id {dto.CategoryId} no existe.");

        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && originalExpense.UserId != userIdFromToken)
            return StatusCode(403, "No puedes modificar gastos de otro usuario.");

        if (await _context.SharedServiceBills.AnyAsync(b => b.ExpenseId == id) || await _context.TaxObligations.AnyAsync(t => t.ExpenseId == id))
            return Conflict("Este gasto está vinculado a una factura o impuesto. Editalo desde su sección para conservar el historial.");

        originalExpense.Amount = dto.Amount;
        originalExpense.Description = dto.Description;
        originalExpense.Date = dto.Date;
        originalExpense.CategoryId = dto.CategoryId;
        originalExpense.CreditCardId = dto.CreditCardId;
        originalExpense.FundingSource = dto.FundingSource;

        var updated = await _expenseService.UpdateAsync(originalExpense);
        if (!updated) return NotFound();

        return Ok(dto);
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var expense = await _expenseService.GetByIdAsync(id);
        if (expense == null) return NotFound();

        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && expense.UserId != userId)
            return StatusCode(403, "No puedes borrar gastos de otro usuario.");

        if (await _context.SharedServiceBills.AnyAsync(b => b.ExpenseId == id) || await _context.TaxObligations.AnyAsync(t => t.ExpenseId == id))
            return Conflict("Este gasto está vinculado a una factura o impuesto. Gestioná el registro desde su sección para conservar el historial.");


        var deleted = await _expenseService.ArchiveAsync(id, userId);
        if (!deleted) return NotFound();

        return NoContent();
    }

    [Authorize]
    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive(int id)
    {
        var expense = await _expenseService.GetByIdAsync(id);
        if (expense == null) return NotFound();

        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var isAdmin = User.IsInRole("Admin");

        if (!isAdmin && expense.UserId != userId)
            return StatusCode(403, "No puedes archivar gastos de otro usuario.");

        var archived = await _expenseService.ArchiveAsync(id, userId);
        if (!archived) return BadRequest("No se pudo archivar el gasto.");

        return NoContent();
    }

    [Authorize]
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> Restore(int id)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var isAdmin = User.IsInRole("Admin");

        var restored = await _expenseService.RestoreAsync(id, userId, isAdmin);
        if (!restored) return NotFound();

        return NoContent();
    }

    [Authorize]
    [HttpGet("deleted")]
    public async Task<IActionResult> GetDeleted()
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var expenses = await _expenseService.GetDeletedByUserId(userId);

        var expenseDtos = expenses.Select(e => new ExpenseDto
        {
            Id = e.Id,
            Amount = e.Amount,
            Description = e.Description,
            Date = e.Date,
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name ?? "N/A",
            UserId = e.UserId,
            Username = e.User?.Username ?? "N/A",
            CreditCardId = e.CreditCardId,
            FundingSource = e.FundingSource.ToString()
        }).ToList();

        return Ok(expenseDtos);
    }

    [Authorize]
    [HttpPost("with-installments")]
    public async Task<IActionResult> CreateExpenseWithInstallments([FromBody] GastoConCuotasDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (dto.Amount <= 0)
            return BadRequest("El monto debe ser mayor a cero.");

        if (dto.Cuotas <= 0)
            return BadRequest("La cantidad de cuotas debe ser mayor a cero.");

        if (!dto.IsInstallments)
            return BadRequest("Este endpoint solo permite crear gastos en cuotas.");

        if (dto.IsInstallments && !dto.CreditCardId.HasValue)
            return BadRequest("La tarjeta de credito es obligatoria para generar cuotas.");

        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var category = await _categoryService.GetByIdAsync(dto.CategoryId);
        if (category == null)
            return BadRequest($"La categoría con id {dto.CategoryId} no existe.");

        CreditCard? creditCard = null;
        if (dto.IsInstallments)
        {
            creditCard = await _context.CreditCards
                .FirstOrDefaultAsync(c => c.Id == dto.CreditCardId.Value && c.UserId == userId);

            if (creditCard == null)
                return BadRequest("La tarjeta seleccionada no existe para este usuario.");
        }

        var gasto = new Expense
        {
            Amount = dto.Amount,
            Description = dto.Description,
            Date = dto.PurchaseDate,
            CategoryId = dto.CategoryId,
            UserId = userId,
            CreditCardId = dto.IsInstallments ? dto.CreditCardId : null,
            FundingSource = dto.FundingSource
        };

        _context.Expenses.Add(gasto);
        await _context.SaveChangesAsync();

        decimal montoPorCuota = Round(dto.Amount / dto.Cuotas, 2);
        var firstDueDate = CalculateFirstDueDate(dto.PurchaseDate, creditCard!.ClosingDay, creditCard.DueDay);
        for (int i = 0; i < dto.Cuotas; i++)
        {
            var dueDate = BuildDueDate(firstDueDate.Year, firstDueDate.Month + i, creditCard.DueDay);
            var cuota = new PagoCuota
            {
                ExpenseId = gasto.Id,
                NroCuota = i + 1,
                MontoCuota = montoPorCuota,
                DueDate = dueDate,
                Status = PagoCuotaStatus.Pending,
                PaidAt = null
            };
            _context.PagosCuotas.Add(cuota);
        }

        await _context.SaveChangesAsync();

        // Crear el DTO para devolver
        var expenseDto = new ExpenseDto
        {
            Id = gasto.Id,
            Amount = gasto.Amount,
            Description = gasto.Description,
            Date = gasto.Date,
            CategoryId = gasto.CategoryId,
            CategoryName = category.Name,
            UserId = gasto.UserId,
            Username = "NoDisponible",
            CreditCardId = gasto.CreditCardId,
            FundingSource = gasto.FundingSource.ToString()
        };

        return CreatedAtAction(nameof(GetById), new { id = gasto.Id }, expenseDto);
    }

    [Authorize]
    [HttpPut("cuotas/{id}/pagar")]
    public async Task<IActionResult> MarcarCuotaPagada(int id)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var cuota = await _context.PagosCuotas
            .Include(pc => pc.Expense)
            .FirstOrDefaultAsync(pc => pc.Id == id);
        if (cuota == null || cuota.Expense == null)
            return NotFound();

        if (cuota.Expense.UserId != userId)
            return NotFound();

        cuota.Status = PagoCuotaStatus.Paid;
        cuota.PaidAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok();
    }

    [Authorize]
    [HttpPut("cuotas/{id}/periodo")]
    public async Task<IActionResult> UpdateInstallmentAccountingDate(int id, [FromBody] UpdateInstallmentAccountingDateRequest request)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return Unauthorized("Token inválido.");

        var cuota = await _context.PagosCuotas
            .Include(pc => pc.Expense)
            .FirstOrDefaultAsync(pc => pc.Id == id);
        if (cuota == null || cuota.Expense == null || cuota.Expense.UserId != userId)
            return NotFound();
        if (cuota.Status != PagoCuotaStatus.Paid || !cuota.PaidAt.HasValue)
            return BadRequest("Solo se puede corregir el período de una cuota ya pagada.");
        if (request.PaidAt.Date > DateTime.UtcNow.Date)
            return BadRequest("La fecha real de pago no puede ser futura.");
        if (request.AccountingDate.Date > DateTime.UtcNow.Date)
            return BadRequest("El período contable no puede ser una fecha futura.");

        cuota.PaidAt = request.PaidAt.Date;
        var accountingMonth = request.AccountingDate;
        var accountingDay = Min(request.PaidAt.Day, DateTime.DaysInMonth(accountingMonth.Year, accountingMonth.Month));
        cuota.AccountingDate = new DateTime(accountingMonth.Year, accountingMonth.Month, accountingDay);
        await _context.SaveChangesAsync();
        return Ok(new { id = cuota.Id, paidAt = cuota.PaidAt, accountingDate = cuota.AccountingDate });
    }

    [Authorize]
    [HttpGet("cuotas/{userId}/{anio}/{mes}")]
    public async Task<IActionResult> GetCuotasDelMes(int userId, int anio, int mes)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var callerId))
            return Unauthorized("Token inválido.");

        if (callerId != userId)
            return NotFound();

        var cuotas = await _context.PagosCuotas
            .Include(pc => pc.Expense)
                .ThenInclude(e => e.Category)
            .Where(pc => pc.Expense.UserId == userId &&
                         pc.DueDate.Month == mes &&
                         pc.DueDate.Year == anio &&
                         pc.Status == PagoCuotaStatus.Pending)
            .ToListAsync();

        var expenseIds = cuotas.Select(pc => pc.ExpenseId).Distinct().ToList();
        var counts = expenseIds.Count == 0
            ? new Dictionary<int, (int Total, int Pagadas)>()
            : await _context.PagosCuotas
                .Where(c => expenseIds.Contains(c.ExpenseId))
                .GroupBy(c => c.ExpenseId)
                .Select(g => new { g.Key, Total = g.Count(), Pagadas = g.Count(c => c.Status == PagoCuotaStatus.Paid) })
                .ToDictionaryAsync(x => x.Key, x => (x.Total, x.Pagadas));

        var resultado = cuotas.Select(pc =>
        {
            counts.TryGetValue(pc.ExpenseId, out var cnt);
            var totalCuotas = cnt.Total;
            var pagadas = cnt.Pagadas;
            var restantes = totalCuotas - pagadas;

            return new CuotaPagadaDto
            {
                Id = pc.Id,
                MontoCuota = pc.MontoCuota,
                DueDate = pc.DueDate,
                PaidAt = pc.PaidAt,
                AccountingDate = pc.AccountingDate,
                Status = pc.Status.ToString(),
                FechaPago = pc.DueDate,
                Estado = pc.Status.ToString().ToLowerInvariant(),
                ExpenseDescription = pc.Expense.Description,
                ExpenseCategoryId = pc.Expense.CategoryId,
                ExpenseCategoryNombre = pc.Expense.Category.Name,
                ExpenseId = pc.ExpenseId,
                ExpenseDate = pc.Expense.Date,

                TotalCuotas = totalCuotas,
                Pagadas = pagadas,
                Restantes = restantes,

                FundingSource = pc.Expense.CreditCardId.HasValue ? "Credit" : pc.Expense.FundingSource.ToString()
            };
        }).ToList();

        return Ok(resultado);
    }

    [Authorize]
    [HttpGet("cuotas/pagadas/{userId}/{anio}/{mes}")]
    public async Task<IActionResult> GetCuotasPagadasDelMes(int userId, int anio, int mes)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var callerId))
            return Unauthorized("Token inválido.");

        if (callerId != userId)
            return NotFound();

        var cuotasPagadas = await _context.PagosCuotas
            .Include(pc => pc.Expense)
                .ThenInclude(e => e.Category)
            .Where(pc =>
                pc.Expense.UserId == userId &&
                (pc.AccountingDate ?? pc.PaidAt).HasValue &&
                (pc.AccountingDate ?? pc.PaidAt)!.Value.Month == mes &&
                (pc.AccountingDate ?? pc.PaidAt)!.Value.Year == anio &&
                pc.Status == PagoCuotaStatus.Paid
            )
            .ToListAsync();

        var expenseIds = cuotasPagadas.Select(pc => pc.ExpenseId).Distinct().ToList();
        var counts = expenseIds.Count == 0
            ? new Dictionary<int, (int Total, int Pagadas)>()
            : await _context.PagosCuotas
                .Where(c => expenseIds.Contains(c.ExpenseId))
                .GroupBy(c => c.ExpenseId)
                .Select(g => new { g.Key, Total = g.Count(), Pagadas = g.Count(c => c.Status == PagoCuotaStatus.Paid) })
                .ToDictionaryAsync(x => x.Key, x => (x.Total, x.Pagadas));

        var resultado = cuotasPagadas.Select(pc =>
        {
            counts.TryGetValue(pc.ExpenseId, out var cnt);
            var totalCuotas = cnt.Total;
            var pagadas = cnt.Pagadas;
            var restantes = totalCuotas - pagadas;

            return new CuotaPagadaDto
            {
                Id = pc.Id,
                MontoCuota = pc.MontoCuota,
                DueDate = pc.DueDate,
                PaidAt = pc.PaidAt,
                AccountingDate = pc.AccountingDate,
                Status = pc.Status.ToString(),
                FechaPago = pc.AccountingDate ?? pc.PaidAt ?? pc.DueDate,
                Estado = pc.Status.ToString().ToLowerInvariant(),
                ExpenseDescription = pc.Expense.Description,
                ExpenseCategoryId = pc.Expense.CategoryId,
                ExpenseCategoryNombre = pc.Expense.Category.Name,
                ExpenseId = pc.ExpenseId,
                ExpenseDate = pc.Expense.Date,

                TotalCuotas = totalCuotas,
                Pagadas = pagadas,
                Restantes = restantes,

                FundingSource = pc.Expense.CreditCardId.HasValue ? "Credit" : pc.Expense.FundingSource.ToString()
            };
        }).ToList();

        return Ok(resultado);
    }

    [Authorize]
    [HttpPut("cuotas/pagar-todas/{userId}/{anio}/{mes}")]
    public async Task<IActionResult> PagarTodasCuotas(int userId, int anio, int mes)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var callerId))
            return Unauthorized("Token inválido.");

        if (callerId != userId)
            return NotFound();

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var cuotas = await _context.PagosCuotas
                .Include(pc => pc.Expense)
                    .ThenInclude(e => e.Category)
                .Where(pc => pc.Expense.UserId == userId
                          && pc.DueDate.Month == mes
                          && pc.DueDate.Year == anio
                          && pc.Status == PagoCuotaStatus.Pending)
                .ToListAsync();

            if (!cuotas.Any())
                return Ok(new { cuotasPagadas = 0, totalPagado = 0 });

            var totalPagado = 0m;
            foreach (var cuota in cuotas)
            {
                cuota.Status = PagoCuotaStatus.Paid;
                cuota.PaidAt = DateTime.UtcNow;
                totalPagado += cuota.MontoCuota;
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { cuotasPagadas = cuotas.Count, totalPagado });
        }
        catch
        {
            await transaction.RollbackAsync();
            return StatusCode(500, "Error al procesar el pago de cuotas");
        }
    }

    private async Task<List<ExpenseDto>> MapExpensesAsync(IEnumerable<Expense> expenses)
    {
        var list = expenses.ToList();
        var pagosInfo = await _expenseService.GetPagosInfoAsync(list.Select(e => e.Id));

        return list.Select(e =>
        {
            var tieneCuotas = pagosInfo.TryGetValue(e.Id, out var info);
            return new ExpenseDto
            {
                Id = e.Id,
                Amount = tieneCuotas ? info.MontoPagado : e.Amount,
                Description = e.Description,
                Date = e.Date,
                CategoryId = e.CategoryId,
                CategoryName = e.Category?.Name ?? "N/A",
                UserId = e.UserId,
                Username = e.User?.Username ?? "N/A",
                TieneCuotas = tieneCuotas,
                CreditCardId = e.CreditCardId,
                FundingSource = e.FundingSource.ToString(),
                IsDeleted = e.IsDeleted,
                DeletedAt = e.DeletedAt
            };
        }).ToList();
    }

    private static DateTime CalculateFirstDueDate(DateTime purchaseDate, int closingDay, int dueDay)
    {
        var baseMonth = purchaseDate.Day <= closingDay
            ? new DateTime(purchaseDate.Year, purchaseDate.Month, 1)
            : new DateTime(purchaseDate.Year, purchaseDate.Month, 1).AddMonths(1);

        var dueMonth = baseMonth.AddMonths(1);
        return BuildDueDate(dueMonth.Year, dueMonth.Month, dueDay);
    }

    private static DateTime BuildDueDate(int year, int month, int dueDay)
    {
        while (month > 12)
        {
            month -= 12;
            year++;
        }

        while (month < 1)
        {
            month += 12;
            year--;
        }

        var daysInMonth = DateTime.DaysInMonth(year, month);
        var safeDay = Min(Max(dueDay, 1), daysInMonth);
        return new DateTime(year, month, safeDay);
    }

}

public record UpdateInstallmentAccountingDateRequest(DateTime PaidAt, DateTime AccountingDate);
