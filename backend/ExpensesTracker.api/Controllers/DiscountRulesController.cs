using ExpensesTracker.api.Dtos.DiscountRule;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ExpensesTracker.api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DiscountRulesController : ControllerBase
    {
        private readonly IDiscountRuleService _discountRuleService;

        public DiscountRulesController(IDiscountRuleService discountRuleService)
        {
            _discountRuleService = discountRuleService;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult<List<DiscountRuleDto>>> GetAll([FromQuery] int? sourceId)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var rules = await _discountRuleService.GetByUserIdAsync(userId.Value, sourceId);
            return Ok(rules.Select(Map).ToList());
        }

        [HttpPost]
        [Authorize]
        public async Task<ActionResult<DiscountRuleDto>> Create([FromBody] CreateDiscountRuleDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            // El usuario siempre se deriva del token (consistente con el resto de la API)
            var rule = new Models.DiscountRule
            {
                UserId = userId.Value,
                IncomeSourceId = dto.IncomeSourceId,
                Name = dto.Name,
                Percentage = dto.Percentage,
                FixedAmount = dto.FixedAmount,
                LinkedCategoryId = dto.LinkedCategoryId,
                LinkedDescription = dto.LinkedDescription,
                IsExpected = dto.IsExpected
            };

            var (created, error, statusCode) = await _discountRuleService.CreateAsync(rule);
            if (created == null)
                return statusCode == 404 ? NotFound(error) : BadRequest(error);

            return CreatedAtAction(nameof(GetById), new { id = created.Id }, Map(created));
        }

        [HttpGet("{id}")]
        [Authorize]
        public async Task<ActionResult<DiscountRuleDto>> GetById(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var rule = await _discountRuleService.GetByIdAsync(id);
            if (rule == null || rule.UserId != userId.Value) return NotFound();

            return Ok(Map(rule));
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateDiscountRuleDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            if (id != dto.Id) return BadRequest();

            var rule = new Models.DiscountRule
            {
                Id = dto.Id,
                UserId = userId.Value,
                IncomeSourceId = dto.IncomeSourceId,
                Name = dto.Name,
                Percentage = dto.Percentage,
                FixedAmount = dto.FixedAmount,
                LinkedCategoryId = dto.LinkedCategoryId,
                LinkedDescription = dto.LinkedDescription,
                IsExpected = dto.IsExpected
            };

            var (ok, error, statusCode) = await _discountRuleService.UpdateAsync(rule);
            if (!ok)
                return statusCode == 404 ? NotFound(error) : BadRequest(error);

            return NoContent();
        }

        [HttpPost("{id}/archive")]
        [Authorize]
        public async Task<IActionResult> Archive(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var archived = await _discountRuleService.ArchiveAsync(userId.Value, id);
            if (!archived) return NotFound();

            return NoContent();
        }

        [HttpPost("{id}/restore")]
        [Authorize]
        public async Task<IActionResult> Restore(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var restored = await _discountRuleService.RestoreAsync(userId.Value, id);
            if (!restored) return NotFound("No se pudo restaurar la regla (puede que ya exista otra con ese nombre en la fuente).");

            return NoContent();
        }

        [HttpPost("{id}/assign")]
        [Authorize]
        public async Task<ActionResult<ExpenseRuleAssignmentDto>> Assign(int id, [FromBody] AssignExpenseDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            try
            {
                var assignment = await _discountRuleService.AssignExpenseAsync(userId.Value, id, dto);
                return Ok(assignment);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}/assign")]
        [Authorize]
        public async Task<IActionResult> Unassign(int id, [FromQuery] int expenseId, [FromQuery] int? pagoCuotaId)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var removed = await _discountRuleService.UnassignExpenseAsync(userId.Value, id, expenseId, pagoCuotaId);
            if (!removed) return NotFound("La asignación no existe.");

            return NoContent();
        }

        [HttpGet("totals")]
        [Authorize]
        public async Task<ActionResult<MonthDiscountsDto>> GetTotals([FromQuery] int year, [FromQuery] int month)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            if (year < 2000 || year > 2100 || month < 1 || month > 12)
                return BadRequest("El período indicado no es válido.");

            return Ok(await _discountRuleService.ComputeMonthDiscountsAsync(userId.Value, year, month));
        }

        private static DiscountRuleDto Map(Models.DiscountRule rule)
        {
            return new DiscountRuleDto
            {
                Id = rule.Id,
                UserId = rule.UserId,
                IncomeSourceId = rule.IncomeSourceId,
                IncomeSourceName = rule.IncomeSource?.Name,
                IncomeSourceMode = rule.IncomeSource?.Mode,
                Name = rule.Name,
                Percentage = rule.Percentage,
                FixedAmount = rule.FixedAmount,
                LinkedCategoryId = rule.LinkedCategoryId,
                LinkedCategoryName = rule.LinkedCategory?.Name,
                LinkedDescription = rule.LinkedDescription,
                IsExpected = rule.IsExpected,
                IsArchived = rule.IsArchived,
                CreatedAt = rule.CreatedAt
            };
        }

        private int? GetUserId()
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return null;
            return userId;
        }
    }
}
