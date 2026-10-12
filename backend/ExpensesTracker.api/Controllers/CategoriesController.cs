using ExpensesTracker.api.DTOs.Category;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;

    public CategoriesController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    private int? GetUserId()
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (subClaim == null || !int.TryParse(subClaim.Value, out var userId))
            return null;
        return userId;
    }

    private string Capitalizar(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return input;
        return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(input.ToLower());
    }

    private CategoryDto MapToDto(Category c)
    {
        return new CategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            Type = c.Type,
            IsSystem = c.IsSystem,
            UserId = c.UserId,
            ParentCategoryId = c.ParentCategoryId,
            ParentCategoryName = c.ParentCategory?.Name,
            Icon = c.Icon,
            Color = c.Color,
            IsLabor = c.IsLabor,
            IsArchived = c.IsArchived,
            ArchivedAt = c.ArchivedAt,
            CreatedAt = c.CreatedAt,
            Children = c.Children?.Select(MapToDto).ToList() ?? new()
        };
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var categories = await _categoryService.GetForUserAsync(userId.Value);

        var roots = categories.Where(c => c.ParentCategoryId == null);
        var dtos = roots.Select(MapToDto).ToList();

        return Ok(dtos);
    }

    [Authorize]
    [HttpGet("flat")]
    public async Task<IActionResult> GetAllFlat()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var categories = await _categoryService.GetForUserAsync(userId.Value);

        var dtos = categories.Select(c => new CategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            Type = c.Type,
            IsSystem = c.IsSystem,
            UserId = c.UserId,
            ParentCategoryId = c.ParentCategoryId,
            ParentCategoryName = c.ParentCategory?.Name,
            Icon = c.Icon,
            Color = c.Color,
            IsLabor = c.IsLabor,
            IsArchived = c.IsArchived,
            ArchivedAt = c.ArchivedAt,
            CreatedAt = c.CreatedAt
        }).ToList();

        return Ok(dtos);
    }

    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var category = await _categoryService.GetByIdAsync(id);
        if (category == null) return NotFound();

        return Ok(MapToDto(category));
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var nombreNormalizadoLower = dto.Name.Trim().ToLower();

        var palabrasReservadas = new[] { "general", "default", "por defecto" };
        if (palabrasReservadas.Contains(nombreNormalizadoLower))
            return BadRequest("Ese nombre está reservado y no puede usarse.");

        var categoriasExistentes = await _categoryService.GetForUserAsync(userId.Value);
        var yaExiste = categoriasExistentes.Any(c =>
            !c.IsArchived &&
            c.Name.Trim().ToLower() == nombreNormalizadoLower);

        if (yaExiste)
            return BadRequest("Ya existe una categoría con ese nombre.");

        if (dto.ParentCategoryId.HasValue)
        {
            var parent = await _categoryService.GetByIdAsync(dto.ParentCategoryId.Value);
            if (parent == null)
                return BadRequest("La categoría padre no existe.");

            if (parent.IsSystem && dto.ParentCategoryId.HasValue)
            {
                var parentOwnedByUser = parent.UserId == userId.Value;
                if (!parentOwnedByUser)
                    return BadRequest("No podés usar una categoría del sistema como padre.");
            }

            if (parent.ParentCategoryId.HasValue)
                return BadRequest("Solo se permite un nivel de jerarquía. La categoría padre ya tiene un padre.");
        }

        var nombreCapitalizado = Capitalizar(dto.Name.Trim());

        var category = new Category
        {
            Name = nombreCapitalizado,
            Type = dto.Type.ToLower(),
            IsSystem = false,
            UserId = userId.Value,
            ParentCategoryId = dto.ParentCategoryId,
            Icon = dto.Icon,
            Color = dto.Color,
            IsLabor = dto.IsLabor,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _categoryService.CreateAsync(category);

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, MapToDto(created));
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCategoryDto dto)
    {
        if (id != dto.Id) return BadRequest("ID mismatch.");
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var originalCategory = await _categoryService.GetByIdAsync(id);
        if (originalCategory == null) return NotFound();

        if (originalCategory.IsSystem)
        {
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin)
                return StatusCode(403, "Las categorías del sistema no pueden ser modificadas por usuarios.");
        }
        else
        {
            if (originalCategory.UserId != userId.Value)
                return StatusCode(403, "No puedes modificar categorías de otro usuario.");

            if (originalCategory.IsArchived)
                return BadRequest("No se puede modificar una categoría archivada.");
        }

        var nombreNormalizadoLower = dto.Name.Trim().ToLower();

        var palabrasReservadas = new[] { "general", "default", "por defecto" };
        if (palabrasReservadas.Contains(nombreNormalizadoLower))
            return BadRequest("Ese nombre está reservado y no puede usarse.");

        if (dto.Name.Trim().Length < 3 || dto.Name.Trim().Length > 50)
            return BadRequest("El nombre debe tener entre 3 y 50 caracteres.");

        if (!Regex.IsMatch(dto.Name.Trim(), @"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s-]+$"))
            return BadRequest("El nombre contiene caracteres inválidos.");

        var categoriasExistentes = await _categoryService.GetForUserAsync(userId.Value);
        var yaExiste = categoriasExistentes.Any(c =>
            c.Id != dto.Id &&
            !c.IsArchived &&
            c.Name.Trim().ToLower() == nombreNormalizadoLower);

        if (yaExiste)
            return BadRequest("Ya existe otra categoría con ese nombre.");

        if (dto.ParentCategoryId.HasValue)
        {
            if (dto.ParentCategoryId.Value == id)
                return BadRequest("Una categoría no puede ser su propio padre.");

            var parent = await _categoryService.GetByIdAsync(dto.ParentCategoryId.Value);
            if (parent == null)
                return BadRequest("La categoría padre no existe.");

            if (parent.ParentCategoryId.HasValue)
                return BadRequest("Solo se permite un nivel de jerarquía.");

            var existingChildren = await _categoryService.GetByIdAsync(id);
            if (existingChildren?.Children.Any(c => c.Id == dto.ParentCategoryId.Value) == true)
                return BadRequest("No podés asignar como padre a una subcategoría existente.");
        }

        var nombreCapitalizado = Capitalizar(dto.Name.Trim());

        var category = new Category
        {
            Id = dto.Id,
            Name = nombreCapitalizado,
            Type = dto.Type.ToLower(),
            ParentCategoryId = dto.ParentCategoryId,
            Icon = dto.Icon ?? originalCategory.Icon,
            Color = dto.Color ?? originalCategory.Color,
            IsLabor = dto.IsLabor
        };

        var updated = await _categoryService.UpdateAsync(category);
        if (!updated) return StatusCode(500, "Error al actualizar la categoría.");

        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var originalCategory = await _categoryService.GetByIdAsync(id);
        if (originalCategory == null) return NotFound();

        if (originalCategory.IsSystem)
        {
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin)
                return StatusCode(403, "Las categorías del sistema no pueden ser eliminadas por usuarios.");

            var deleted = await _categoryService.DeleteAsync(id);
            if (!deleted) return BadRequest("No se puede eliminar la categoría porque está siendo utilizada.");
            return NoContent();
        }

        if (originalCategory.UserId != userId.Value)
            return StatusCode(403, "No puedes eliminar categorías de otro usuario.");

        var archived = await _categoryService.ArchiveAsync(id, userId.Value);
        if (!archived) return BadRequest("No se pudo archivar la categoría.");

        return NoContent();
    }

    [Authorize]
    [HttpPost("{id}/archive")]
    public async Task<IActionResult> Archive(int id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var originalCategory = await _categoryService.GetByIdAsync(id);
        if (originalCategory == null) return NotFound();

        if (originalCategory.IsSystem)
            return BadRequest("Las categorías del sistema no pueden ser archivadas.");

        if (originalCategory.UserId != userId.Value)
            return StatusCode(403, "No puedes archivar categorías de otro usuario.");

        var archived = await _categoryService.ArchiveAsync(id, userId.Value);
        if (!archived) return BadRequest("No se pudo archivar la categoría.");

        return NoContent();
    }

    [Authorize]
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> Restore(int id)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var restored = await _categoryService.RestoreAsync(id, userId.Value);
        if (!restored) return NotFound();

        return NoContent();
    }

    [Authorize]
    [HttpGet("archived")]
    public async Task<IActionResult> GetArchived()
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        var categories = await _categoryService.GetArchivedByUserId(userId.Value);

        var dtos = categories.Select(c => new CategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            Type = c.Type,
            IsSystem = c.IsSystem,
            UserId = c.UserId,
            ParentCategoryId = c.ParentCategoryId,
            Icon = c.Icon,
            Color = c.Color,
            IsLabor = c.IsLabor,
            IsArchived = c.IsArchived,
            ArchivedAt = c.ArchivedAt,
            CreatedAt = c.CreatedAt
        });

        return Ok(dtos);
    }

    [Authorize]
    [HttpGet("by-type/{type}")]
    public async Task<IActionResult> GetByType(string type)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized("Token inválido.");

        type = type.ToLower();
        if (type != "ingreso" && type != "gasto")
            return BadRequest("El tipo debe ser 'ingreso' o 'gasto'.");

        var all = await _categoryService.GetForUserAsync(userId.Value);
        var filtered = all
            .Where(c => c.Type.ToLower() == type)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Type = c.Type,
                IsSystem = c.IsSystem,
                UserId = c.UserId,
                ParentCategoryId = c.ParentCategoryId,
                ParentCategoryName = c.ParentCategory?.Name,
                Icon = c.Icon,
                Color = c.Color,
            IsLabor = c.IsLabor,
                IsArchived = c.IsArchived,
                CreatedAt = c.CreatedAt
            });

        return Ok(filtered);
    }
}
