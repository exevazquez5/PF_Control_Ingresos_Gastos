using ExpensesTracker.api.Dtos.Income;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace ExpensesTracker.api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class IncomesController : ControllerBase
    {
        private readonly IIncomeService _incomeService;
        private readonly ICategoryService _categoryService;
        private readonly IIncomeSourceService _incomeSourceService;
        private readonly IncomeUsdService _incomeUsdService;

        // Límite de monto por ingreso (D5): el literal debe ser idéntico al del frontend
        public const decimal MaxAmount = 10000000m;
        public const string MaxAmountMessage = "El monto no puede exceder $10,000,000";

        public IncomesController(IIncomeService incomeService, ICategoryService categoryService, IIncomeSourceService incomeSourceService, IncomeUsdService incomeUsdService)
        {
            _incomeService = incomeService;
            _categoryService = categoryService;
            _incomeSourceService = incomeSourceService;
            _incomeUsdService = incomeUsdService;

        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult<List<IncomeDto>>> GetAll()
        {
            // Obtener ID del usuario desde el JWT
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null)
            {
                return Unauthorized("Token inv�lido: no contiene el claim 'nameidentifier'.");
            }
            if (!int.TryParse(subClaim.Value, out var userId))
            {
                return Unauthorized("Token inv�lido: el claim 'nameidentifier' no es un entero v�lido.");
            }

            // Verificar si tiene el rol Admin
            var isAdmin = User.IsInRole("Admin");

            // Obtener ingresos seg�n rol
            var incomes = isAdmin
                ? await _incomeService.GetAllAsync()
                : await _incomeService.GetByUserId(userId);

            // Mapear a DTO
            var result = incomes.Select(i => new IncomeDto
            {
                Id = i.Id,
                Amount = i.Amount,
                GrossAmount = i.GrossAmount,
                IsRecurring = i.IsRecurring,
                Description = i.Description,
                Date = i.Date,
                CategoryId = i.CategoryId,
                CategoryName = i.Category?.Name,
                SourceId = i.SourceId,
                SourceName = i.Source?.Name,
                Mode = i.Mode,
                UserId = i.UserId,
                Username = i.User?.Username,
                IsDeleted = i.IsDeleted,
                DeletedAt = i.DeletedAt
            }).ToList();

            return Ok(result);
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<ActionResult<IncomeDto>> Get(int id)
        {
            var income = await _incomeService.GetById(id);
            if (income == null) return NotFound();

            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userIdFromToken))
                return Unauthorized("Token inv�lido.");

            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && income.UserId != userIdFromToken)
                return StatusCode(403, "No puedes acceder a ingresos de otro usuario.");

            var dto = new IncomeDto
            {
                Id = income.Id,
                Amount = income.Amount,
                GrossAmount = income.GrossAmount,
                IsRecurring = income.IsRecurring,
                Description = income.Description,
                Date = income.Date,
                CategoryId = income.CategoryId,
                CategoryName = income.Category?.Name,
                SourceId = income.SourceId,
                SourceName = income.Source?.Name,
                Mode = income.Mode,
                UserId = income.UserId,
                Username = income.User?.Username,
                IsDeleted = income.IsDeleted,
                DeletedAt = income.DeletedAt
            };

            return Ok(dto);
        }


        [Authorize]
        [HttpGet("summary/{userId}")]
        public async Task<ActionResult<object>> GetSummary(int userId)
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userIdFromToken))
                return Unauthorized("Token inv�lido.");

            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && userId != userIdFromToken)
                return StatusCode(403, "No tienes permiso para ver el resumen de otro usuario.");

            var summary = await _incomeService.GetSummaryByUser(userId);
            return Ok(summary);
        }


        [Authorize]
        [HttpGet("filter")]
        public async Task<ActionResult<List<IncomeDto>>> Filter(
            [FromQuery] int? userId,
            [FromQuery] int? categoryId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userIdFromToken))
                return Unauthorized("Token inv�lido.");

            var isAdmin = User.IsInRole("Admin");

            // Validaci�n: si NO es admin, solo puede filtrar su propio userId
            if (!isAdmin)
            {
                if (userId.HasValue && userId != userIdFromToken)
                    return StatusCode(403, "No tienes permiso para filtrar datos de otro usuario.");

                // Si no se especific� userId, lo forzamos al del token
                userId = userIdFromToken;
            }

            var filtered = await _incomeService.Filter(userId, categoryId, from, to);

            var result = filtered.Select(i => new IncomeDto
            {
                Id = i.Id,
                Amount = i.Amount,
                GrossAmount = i.GrossAmount,
                IsRecurring = i.IsRecurring,
                Description = i.Description,
                Date = i.Date,
                CategoryId = i.CategoryId,
                CategoryName = i.Category?.Name,
                UserId = i.UserId,
                Username = i.User?.Username,
                IsDeleted = i.IsDeleted,
                DeletedAt = i.DeletedAt
            }).ToList();

            return Ok(result);
        }


        [Authorize]
        [HttpPost]
        public async Task<ActionResult<IncomeDto>> Create([FromBody] CreateIncomeDto dto)
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return Unauthorized("Token inv�lido.");

            // ? Validar que el monto sea mayor a cero
            if (dto.Amount <= 0)
                return BadRequest("El monto debe ser mayor a cero.");

            // ? Validar que el monto no tenga m�s de 2 decimales
            if (decimal.Round(dto.Amount, 2) != dto.Amount)
                return BadRequest("El monto no puede tener m�s de 2 decimales.");

            // ? Validar l�mite de monto (D5)
            if (dto.Amount > MaxAmount)
                return BadRequest(MaxAmountMessage);

            // ? Validar que la descripci�n no est� vac�a ni sea solo espacios
            if (string.IsNullOrWhiteSpace(dto.Description))
                return BadRequest("La descripci�n no puede estar vac�a ni contener solo espacios.");

            // ? Validar longitud de la descripci�n (m�nimo 3, m�ximo 100 caracteres)
            if (dto.Description.Length < 3 || dto.Description.Length > 100)
                return BadRequest("La descripci�n debe tener entre 3 y 100 caracteres.");

            // ? Validar que la descripci�n no contenga caracteres especiales no deseados
            var regex = new Regex(@"^[a-zA-Z0-9\s.,\-()������������]*$");
            if (!regex.IsMatch(dto.Description))
                return BadRequest("La descripci�n contiene caracteres no permitidos.");

            // ? Validar que la fecha no sea futura
            if (dto.Date > DateTime.Now)
                return BadRequest("La fecha no puede ser en el futuro.");

            var category = await _categoryService.GetByIdAsync(dto.CategoryId);
            if (category == null)
                return BadRequest($"La categoria con id {dto.CategoryId} no existe.");

            // Bruto no puede ser menor que el depositado (D1)
            if (dto.GrossAmount.HasValue && dto.GrossAmount.Value < dto.Amount)
                return BadRequest("El bruto debe ser mayor o igual al monto depositado.");

            // Fuente + snapshot de modo (D1)
            Models.IncomeSource source = null;
            if (dto.SourceId.HasValue)
            {
                source = await _incomeSourceService.GetByIdAsync(dto.SourceId.Value);
                if (source == null || source.UserId != userId)
                    return BadRequest("La fuente de ingreso no existe.");
            }
            else if (!string.IsNullOrWhiteSpace(dto.SourceName))
            {
                // Sin SourceId: resolver por nombre (incluye aliases) o crear la fuente (autocomplete D6/D11)
                source = await _incomeSourceService.FindByNameAsync(userId, dto.SourceName.Trim());
                if (source == null)
                {
                    var (newSource, sourceError, sourceStatus) = await _incomeSourceService.CreateAsync(
                        userId, dto.SourceName.Trim(), dto.Mode ?? Models.IncomeSource.ModeNeto);
                    if (newSource == null)
                        return BadRequest(sourceError);
                    source = newSource;
                }
            }
            var mode = (dto.Mode ?? source?.Mode ?? Models.IncomeSource.ModeNeto).Trim().ToLowerInvariant();
            if (mode != Models.IncomeSource.ModeNeto && mode != Models.IncomeSource.ModeBruto)
                return BadRequest("El modo debe ser \"neto\" o \"bruto\".");

            // En modo bruto no aplica el bruto del recibo (3.5a): lo depositado ES el bruto.
            var grossAmount = mode == Models.IncomeSource.ModeBruto ? (decimal?)null : dto.GrossAmount;

            var income = new Models.Income
            {
                Amount = dto.Amount,
                GrossAmount = grossAmount,
                IsRecurring = dto.IsRecurring,
                Description = dto.Description,
                Date = dto.Date,
                CategoryId = dto.CategoryId,
                SourceId = source?.Id,
                Mode = mode,
                UserId = userId
            };

            var created = await _incomeService.Create(income);
            await _incomeUsdService.CaptureAsync(created);

            var result = new IncomeDto
            {
                Id = created.Id,
                Amount = created.Amount,
                GrossAmount = created.GrossAmount,
                IsRecurring = created.IsRecurring,
                Description = created.Description,
                Date = created.Date,
                CategoryId = created.CategoryId,
                CategoryName = created.Category?.Name ?? "N/A",
                SourceId = created.SourceId,
                SourceName = created.Source?.Name,
                Mode = created.Mode,
                UserId = created.UserId,
                Username = created.User?.Username ?? "N/A",
                IsDeleted = created.IsDeleted,
                DeletedAt = created.DeletedAt
            };

            return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
        }


        [Authorize]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateIncomeDto dto)
        {
            if (id != dto.Id)
                return BadRequest();

            var incomeToUpdate = await _incomeService.GetById(id);
            if (incomeToUpdate == null)
                return NotFound();

            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return Unauthorized();

            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && incomeToUpdate.UserId != userId)
                return StatusCode(403, "No puedes modificar ingresos de otro usuario.");

            // ? Validar que el monto sea mayor a cero
            if (dto.Amount <= 0)
                return BadRequest("El monto debe ser mayor a cero.");

            // ? Validar que el monto no tenga m�s de 2 decimales
            if (decimal.Round(dto.Amount, 2) != dto.Amount)
                return BadRequest("El monto no puede tener m�s de 2 decimales.");

            // ? Validar l�mite de monto (D5)
            if (dto.Amount > MaxAmount)
                return BadRequest(MaxAmountMessage);

            // ? Validar que la descripci�n no est� vac�a ni sea solo espacios
            if (string.IsNullOrWhiteSpace(dto.Description))
                return BadRequest("La descripci�n no puede estar vac�a ni contener solo espacios.");

            // ? Validar longitud de la descripci�n (m�nimo 3, m�ximo 100 caracteres)
            if (dto.Description.Length < 3 || dto.Description.Length > 100)
                return BadRequest("La descripci�n debe tener entre 3 y 100 caracteres.");

            // ? Validar que la descripci�n no contenga caracteres especiales no deseados
            var regex = new Regex(@"^[a-zA-Z0-9\s.,\-()������������]*$");
            if (!regex.IsMatch(dto.Description))
                return BadRequest("La descripci�n contiene caracteres no permitidos.");

            // ? Validar que la fecha no sea futura
            if (dto.Date > DateTime.Now)
                return BadRequest("La fecha no puede ser en el futuro.");

            var category = await _categoryService.GetByIdAsync(dto.CategoryId);
            if (category == null)
                return BadRequest($"La categoria con id {dto.CategoryId} no existe.");

            // Bruto no puede ser menor que el depositado (D1)
            if (dto.GrossAmount.HasValue && dto.GrossAmount.Value < dto.Amount)
                return BadRequest("El bruto debe ser mayor o igual al monto depositado.");

            // Fuente + snapshot de modo (D1)
            Models.IncomeSource source = null;
            if (dto.SourceId.HasValue)
            {
                source = await _incomeSourceService.GetByIdAsync(dto.SourceId.Value);
                if (source == null || source.UserId != userId)
                    return BadRequest("La fuente de ingreso no existe.");
            }
            else if (!string.IsNullOrWhiteSpace(dto.SourceName))
            {
                source = await _incomeSourceService.FindByNameAsync(userId, dto.SourceName.Trim());
                if (source == null)
                {
                    var (newSource, sourceError, _) = await _incomeSourceService.CreateAsync(
                        userId, dto.SourceName.Trim(), dto.Mode ?? Models.IncomeSource.ModeNeto);
                    if (newSource == null)
                        return BadRequest(sourceError);
                    source = newSource;
                }
            }
            var mode = (dto.Mode ?? source?.Mode ?? Models.IncomeSource.ModeNeto).Trim().ToLowerInvariant();
            if (mode != Models.IncomeSource.ModeNeto && mode != Models.IncomeSource.ModeBruto)
                return BadRequest("El modo debe ser \"neto\" o \"bruto\".");

            // En modo bruto no aplica el bruto del recibo (3.5a): lo depositado ES el bruto.
            var grossAmount = mode == Models.IncomeSource.ModeBruto ? (decimal?)null : dto.GrossAmount;

            incomeToUpdate.Amount = dto.Amount;
            incomeToUpdate.GrossAmount = grossAmount;
            incomeToUpdate.IsRecurring = dto.IsRecurring;
            incomeToUpdate.Description = dto.Description;
            incomeToUpdate.Date = dto.Date;
            incomeToUpdate.CategoryId = dto.CategoryId;
            incomeToUpdate.SourceId = source?.Id;
            incomeToUpdate.Mode = mode;

            var updated = await _incomeService.Update(incomeToUpdate);
            if (!updated)
                return StatusCode(500, "Error updating income");

            await _incomeUsdService.CaptureAsync(incomeToUpdate);

            return NoContent();
        }


        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var income = await _incomeService.GetById(id);
            if (income == null) return NotFound();

            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return Unauthorized();

            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && income.UserId != userId)
                return StatusCode(403, "No puedes eliminar ingresos de otro usuario.");

            await _incomeService.ArchiveAsync(id, userId);
            return NoContent();
        }

        [Authorize]
        [HttpPost("{id}/archive")]
        public async Task<IActionResult> Archive(int id)
        {
            var income = await _incomeService.GetById(id);
            if (income == null) return NotFound();

            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return Unauthorized();

            var isAdmin = User.IsInRole("Admin");

            if (!isAdmin && income.UserId != userId)
                return StatusCode(403, "No puedes archivar ingresos de otro usuario.");

            var archived = await _incomeService.ArchiveAsync(id, userId);
            if (!archived) return BadRequest("No se pudo archivar el ingreso.");

            return NoContent();
        }

        [Authorize]
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(int id)
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return Unauthorized();

            var isAdmin = User.IsInRole("Admin");

            var restored = await _incomeService.RestoreAsync(id, userId, isAdmin);
            if (!restored) return NotFound();

            return NoContent();
        }

        [Authorize]
        [HttpGet("overview")]
        public async Task<ActionResult<object>> GetOverview()
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return Unauthorized("Token inválido.");

            var overview = await _incomeService.GetOverviewAsync(userId);
            return Ok(overview);
        }

        [Authorize]
        [HttpGet("usd-overview")]
        public async Task<ActionResult<object>> GetUsdOverview([FromQuery] DateTime from, [FromQuery] DateTime to)
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim == null || !int.TryParse(claim.Value, out var userId)) return Unauthorized();
            if (to < from || (to - from).TotalDays > 4000) return BadRequest("El período solicitado no es válido.");
            var result = await _incomeUsdService.GetOverviewAsync(userId, from.Date, to.Date);
            return Ok(result);
        }

        [Authorize]
        [HttpGet("deleted")]
        public async Task<ActionResult<List<IncomeDto>>> GetDeleted()
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return Unauthorized("Token inválido.");

            var incomes = await _incomeService.GetDeletedByUserId(userId);

            var result = incomes.Select(i => new IncomeDto
            {
                Id = i.Id,
                Amount = i.Amount,
                GrossAmount = i.GrossAmount,
                IsRecurring = i.IsRecurring,
                Description = i.Description,
                Date = i.Date,
                CategoryId = i.CategoryId,
                CategoryName = i.Category?.Name,
                SourceId = i.SourceId,
                SourceName = i.Source?.Name,
                Mode = i.Mode,
                UserId = i.UserId,
                Username = i.User?.Username
            }).ToList();

            return Ok(result);
        }

    }
}
