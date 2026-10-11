using ExpensesTracker.api.Data;
using ExpensesTracker.api.DTOs.Salary;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ExpensesTracker.api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SalariesController : ControllerBase
    {
        private readonly ISalaryService _salaryService;

        public SalariesController(ISalaryService salaryService)
        {
            _salaryService = salaryService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var salaries = await _salaryService.GetAllAsync(userId.Value);
            return Ok(salaries.Select(MapToDto));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var salary = await _salaryService.GetByIdAsync(userId.Value, id);
            if (salary == null) return NotFound();

            return Ok(MapToDto(salary));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateSalaryDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            try
            {
                var created = await _salaryService.CreateAsync(userId.Value, dto);
                if (created == null) return BadRequest("No se pudo crear el sueldo.");

                return CreatedAtAction(nameof(GetById), new { id = created.Id }, MapToDto(created));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateSalaryDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            try
            {
                var updated = await _salaryService.UpdateAsync(userId.Value, id, dto);
                if (updated == null) return NotFound();

                return Ok(MapToDto(updated));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var deleted = await _salaryService.DeleteAsync(userId.Value, id);
            if (!deleted) return NotFound();

            return NoContent();
        }

        private int? GetUserId()
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
                return null;
            return userId;
        }

        private static SalaryDto MapToDto(Salary salary)
        {
            return new SalaryDto
            {
                Id = salary.Id,
                UserId = salary.UserId,
                IncomeId = salary.IncomeId,
                GrossAmount = salary.GrossAmount,
                NetAmount = salary.NetAmount,
                TotalDeductions = salary.Deductions.Sum(d => d.Amount),
                Date = salary.Date,
                Notes = salary.Notes,
                CreatedAt = salary.CreatedAt,
                Deductions = salary.Deductions
                    .Select(d => new SalaryDeductionDto
                    {
                        Id = d.Id,
                        ExpenseId = d.ExpenseId,
                        ExpenseDescription = d.Expense?.Description ?? "(gasto eliminado)",
                        ExpenseDate = d.Expense?.Date,
                        ExpenseCategoryName = d.Expense?.Category?.Name,
                        Amount = d.Amount
                    })
                    .OrderBy(d => d.ExpenseDate)
                    .ToList()
            };
        }
    }
}
