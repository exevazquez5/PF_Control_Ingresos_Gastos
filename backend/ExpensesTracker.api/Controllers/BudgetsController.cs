using ExpensesTracker.api.Data;
using ExpensesTracker.api.Dtos.Budget;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace ExpensesTracker.api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BudgetsController : ControllerBase
    {
        private readonly IBudgetService _budgetService;
        private readonly AppDbContext _context;

        public BudgetsController(IBudgetService budgetService, AppDbContext context)
        {
            _budgetService = budgetService;
            _context = context;
        }

        [HttpGet("current")]
        public async Task<IActionResult> GetCurrent()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var budget = await _budgetService.GetCurrentAsync(userId.Value);
            if (budget == null) return NotFound("No hay presupuesto activo para el período actual.");

            return Ok(MapToDto(budget));
        }

        [HttpGet("progress")]
        public async Task<IActionResult> GetProgress()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var progress = await _budgetService.GetProgressAsync(userId.Value);
            if (progress == null) return NotFound("No hay presupuesto activo para el período actual.");

            return Ok(progress);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var budgets = await _budgetService.GetAllAsync(userId.Value);
            var dtos = budgets.Select(MapToDto);

            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var budget = await _budgetService.GetByIdAsync(userId.Value, id);
            if (budget == null) return NotFound();

            return Ok(MapToDto(budget));
        }

        [HttpGet("by-period/{period}")]
        public async Task<IActionResult> GetByPeriod(string period)
        {
            if (!Regex.IsMatch(period, @"^\d{4}-\d{2}$"))
                return BadRequest("Formato de período inválido. Usá YYYY-MM.");

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var budgetMeta = await _budgetService.GetForPeriodAsync(userId.Value, period);
            if (budgetMeta == null)
                return NotFound("No hay presupuesto configurado ni heredado para este período.");

            var dto = MapToDto(budgetMeta.Budget);
            Response.Headers["X-Budget-Inherited"] = budgetMeta.IsInherited.ToString();

            return Ok(dto);
        }

        [HttpGet("{period}/progress")]
        public async Task<IActionResult> GetProgressByPeriod(string period)
        {
            if (!Regex.IsMatch(period, @"^\d{4}-\d{2}$"))
                return BadRequest("Formato de período inválido. Usá YYYY-MM.");

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var progress = await _budgetService.GetProgressAsync(userId.Value, period);
            if (progress == null)
                return NotFound("No hay presupuesto activo para el período.");

            return Ok(progress);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBudgetDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            if (!Regex.IsMatch(dto.Period, @"^\d{4}-\d{2}$"))
                return BadRequest("Formato de período inválido. Usá YYYY-MM.");

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var duplicate = await _context.Budgets
                .AnyAsync(b => b.UserId == userId.Value && b.Period == dto.Period);

            if (duplicate)
                return BadRequest("Ya existe un presupuesto para ese período.");

            var (periodStart, periodEnd) = PeriodToDates(dto.Period);

            var budget = new Budget
            {
                UserId = userId.Value,
                Period = dto.Period,
                PeriodStart = periodStart,
                PeriodEnd = periodEnd,
                TotalAmount = dto.TotalAmount
            };

            var categories = dto.Categories.Select(c => new BudgetCategory
            {
                CategoryId = c.CategoryId,
                Amount = c.Amount,
                AlertThreshold = c.AlertThreshold ?? 0.7m
            }).ToList();

            var created = await _budgetService.CreateAsync(budget, categories);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, MapToDto(created));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateBudgetDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var existing = await _budgetService.GetByIdAsync(userId.Value, id);
            if (existing == null) return NotFound();

            existing.TotalAmount = dto.TotalAmount ?? existing.TotalAmount;

            var categories = dto.Categories.Select(c => new BudgetCategory
            {
                Id = c.Id ?? 0,
                CategoryId = c.CategoryId,
                Amount = c.Amount,
                AlertThreshold = c.AlertThreshold ?? 0.7m
            }).ToList();

            var updated = await _budgetService.UpdateAsync(existing, categories);
            if (!updated) return BadRequest("No se pudo actualizar el presupuesto.");

            var refreshed = await _budgetService.GetByIdAsync(userId.Value, id);
            return Ok(MapToDto(refreshed!));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var deleted = await _budgetService.ArchiveAsync(userId.Value, id);
            if (!deleted) return NotFound();

            return NoContent();
        }

        [HttpPost("{id}/archive")]
        public async Task<IActionResult> Archive(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var archived = await _budgetService.ArchiveAsync(userId.Value, id);
            if (!archived) return NotFound();

            return NoContent();
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var restored = await _budgetService.RestoreAsync(userId.Value, id);
            if (!restored) return NotFound();

            return NoContent();
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeleted()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var budgets = await _budgetService.GetDeletedAsync(userId.Value);
            var dtos = budgets.Select(MapToDto);

            return Ok(dtos);
        }

        [HttpPost("can-spend")]
        public async Task<IActionResult> CanSpend([FromBody] CanSpendRequest request)
        {
            if (!Regex.IsMatch(request.Period, @"^\d{4}-\d{2}$"))
                return BadRequest("Formato de período inválido. Usá YYYY-MM.");

            if (request.Amount <= 0)
                return BadRequest("El monto debe ser mayor a cero.");

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var result = await _budgetService.CanSpendAsync(userId.Value, request);
            return Ok(result);
        }

        private int? GetUserId()
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return null;
            return userId;
        }

        private static (DateTime Start, DateTime End) PeriodToDates(string period)
        {
            var parts = period.Split('-');
            var year = int.Parse(parts[0]);
            var month = int.Parse(parts[1]);
            var start = new DateTime(year, month, 1);
            var end = start.AddMonths(1).AddDays(-1);
            return (start, end);
        }

        private static BudgetDto MapToDto(Budget budget)
        {
            return new BudgetDto
            {
                Id = budget.Id,
                UserId = budget.UserId,
                Period = budget.Period,
                PeriodStart = budget.PeriodStart,
                PeriodEnd = budget.PeriodEnd,
                TotalAmount = budget.TotalAmount,
                CreatedAt = budget.CreatedAt,
                UpdatedAt = budget.UpdatedAt,
                IsDeleted = budget.IsDeleted,
                DeletedAt = budget.DeletedAt,
                Categories = budget.Categories.Select(c => new BudgetCategoryDto
                {
                    Id = c.Id,
                    CategoryId = c.CategoryId,
                    CategoryName = c.Category.Name,
                    ParentCategoryId = c.Category.ParentCategoryId,
                    ParentCategoryName = c.Category.ParentCategory?.Name,
                    Amount = c.Amount,
                    AlertThreshold = c.AlertThreshold
                }).ToList()
            };
        }
    }
}
