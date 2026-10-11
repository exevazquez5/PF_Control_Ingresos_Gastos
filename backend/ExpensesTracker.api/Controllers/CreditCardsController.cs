using ExpensesTracker.api.Data;
using ExpensesTracker.api.Dtos.CreditCard;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ExpensesTracker.api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CreditCardsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CreditCardsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetMine()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var cards = await _context.CreditCards
                .Where(c => c.UserId == userId.Value)
                .OrderBy(c => c.Id)
                .Select(c => new CreditCardDto
                {
                    Id = c.Id,
                    UserId = c.UserId,
                    Name = c.Name,
                    ClosingDay = c.ClosingDay,
                    DueDay = c.DueDay
                })
                .ToListAsync();

            return Ok(cards);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateCreditCardDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var entity = new CreditCard
            {
                UserId = userId.Value,
                Name = string.IsNullOrWhiteSpace(dto.Name) ? null : dto.Name.Trim(),
                ClosingDay = dto.ClosingDay,
                DueDay = dto.DueDay
            };

            _context.CreditCards.Add(entity);
            await _context.SaveChangesAsync();

            var result = new CreditCardDto
            {
                Id = entity.Id,
                UserId = entity.UserId,
                Name = entity.Name,
                ClosingDay = entity.ClosingDay,
                DueDay = entity.DueDay
            };

            return CreatedAtAction(nameof(GetMine), new { id = entity.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] CreateCreditCardDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var card = await _context.CreditCards
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId.Value);

            if (card == null) return NotFound();

            card.Name = string.IsNullOrWhiteSpace(dto.Name) ? null : dto.Name.Trim();
            card.ClosingDay = dto.ClosingDay;
            card.DueDay = dto.DueDay;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var card = await _context.CreditCards
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId.Value);

            if (card == null) return NotFound();

            card.IsDeleted = true;
            card.DeletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("{id}/archive")]
        public async Task<IActionResult> Archive(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var card = await _context.CreditCards
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId.Value);

            if (card == null) return NotFound();

            if (card.IsDeleted) return BadRequest("La tarjeta ya está archivada.");

            card.IsDeleted = true;
            card.DeletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(int id)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var card = await _context.CreditCards
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId.Value);

            if (card == null) return NotFound();

            if (!card.IsDeleted) return BadRequest("La tarjeta no está archivada.");

            card.IsDeleted = false;
            card.DeletedAt = null;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeleted()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized("Token inválido.");

            var cards = await _context.CreditCards
                .IgnoreQueryFilters()
                .Where(c => c.UserId == userId.Value && c.IsDeleted)
                .OrderByDescending(c => c.DeletedAt)
                .Select(c => new CreditCardDto
                {
                    Id = c.Id,
                    UserId = c.UserId,
                    Name = c.Name,
                    ClosingDay = c.ClosingDay,
                    DueDay = c.DueDay
                })
                .ToListAsync();

            return Ok(cards);
        }

        private int? GetUserId()
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            {
                return null;
            }

            return userId;
        }
    }
}
