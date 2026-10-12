using ExpensesTracker.api.Dtos.IncomeSource;
using ExpensesTracker.api.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ExpensesTracker.api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class IncomeSourcesController : ControllerBase
    {
        private readonly IIncomeSourceService _incomeSourceService;
        private readonly IIncomeService _incomeService;

        public IncomeSourcesController(IIncomeSourceService incomeSourceService, IIncomeService incomeService)
        {
            _incomeSourceService = incomeSourceService;
            _incomeService = incomeService;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult<List<IncomeSourceDto>>> GetAll()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var sources = await _incomeSourceService.GetByUserIdAsync(userId.Value);
            var aliases = await _incomeSourceService.GetAliasesByUserIdAsync(userId.Value);
            var incomes = await _incomeService.GetByUserId(userId.Value);

            var result = sources.Select(s => new IncomeSourceDto
            {
                Id = s.Id,
                Name = s.Name,
                Mode = s.Mode,
                IsArchived = s.IsArchived,
                CreatedAt = s.CreatedAt,
                Aliases = aliases.Where(a => a.IncomeSourceId == s.Id).Select(a => a.Name).ToList(),
                IncomeCount = incomes.Count(i => i.SourceId == s.Id)
            }).ToList();

            return Ok(result);
        }

        [HttpPost]
        [Authorize]
        public async Task<ActionResult<IncomeSourceDto>> Create([FromBody] CreateIncomeSourceDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var (source, error, statusCode) = await _incomeSourceService.CreateAsync(userId.Value, dto.Name, dto.Mode);
            if (source == null)
                return statusCode == 400 ? BadRequest(error) : StatusCode(statusCode, error);

            var result = new IncomeSourceDto
            {
                Id = source.Id,
                Name = source.Name,
                Mode = source.Mode,
                IsArchived = source.IsArchived,
                CreatedAt = source.CreatedAt,
                Aliases = new List<string>(),
                IncomeCount = 0
            };

            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpGet("{id}")]
        [Authorize]
        public async Task<ActionResult<IncomeSourceDto>> GetById(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var source = await _incomeSourceService.GetByIdAsync(id);
            if (source == null || source.UserId != userId.Value) return NotFound();

            var aliases = await _incomeSourceService.GetAliasesByUserIdAsync(userId.Value);
            var incomes = await _incomeService.GetByUserId(userId.Value);

            var result = new IncomeSourceDto
            {
                Id = source.Id,
                Name = source.Name,
                Mode = source.Mode,
                IsArchived = source.IsArchived,
                CreatedAt = source.CreatedAt,
                Aliases = aliases.Where(a => a.IncomeSourceId == source.Id).Select(a => a.Name).ToList(),
                IncomeCount = incomes.Count(i => i.SourceId == source.Id)
            };

            return Ok(result);
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateIncomeSourceDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var (ok, error, statusCode) = await _incomeSourceService.RenameAsync(userId.Value, id, dto.Name);
            if (!ok)
                return statusCode == 404 ? NotFound(error) : BadRequest(error);

            var (modeOk, modeError, modeStatus) = await _incomeSourceService.SetModeAsync(userId.Value, id, dto.Mode);
            if (!modeOk)
                return modeStatus == 404 ? NotFound(modeError) : BadRequest(modeError);

            return NoContent();
        }

        [HttpPost("merge")]
        [Authorize]
        public async Task<IActionResult> Merge([FromBody] MergeIncomeSourceDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var (ok, error, statusCode) = await _incomeSourceService.MergeAsync(userId.Value, dto.SourceId, dto.TargetSourceId);
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

            var archived = await _incomeSourceService.ArchiveAsync(userId.Value, id);
            if (!archived) return NotFound();

            return NoContent();
        }

        [HttpPost("{id}/restore")]
        [Authorize]
        public async Task<IActionResult> Restore(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized("Token inválido.");

            var restored = await _incomeSourceService.RestoreAsync(userId.Value, id);
            if (!restored) return NotFound("No se pudo restaurar la fuente (puede que ya exista otra fuente o alias con ese nombre).");

            return NoContent();
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
