using ExpensesTracker.api.DTOs.Category;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;

    public CategoriesController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _categoryService.GetAllAsync();

        var categoryDtos = categories.Select(c => new CategoryDto
        {
            Id = c.Id,
            Name = c.Name
        });

        return Ok(categoryDtos);
    }

    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var category = await _categoryService.GetByIdAsync(id);
        if (category == null) return NotFound();

        var dto = new CategoryDto
        {
            Id = category.Id,
            Name = category.Name
        };

        return Ok(dto);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryDto dto)
    {
        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin)
        {
            return StatusCode(403, "Solo un Admin puede crear categorías.");
        }

        var category = new Category
        {
            Name = dto.Name
        };

        var created = await _categoryService.CreateAsync(category);

        var result = new CategoryDto
        {
            Id = created.Id,
            Name = created.Name
        };

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCategoryDto dto)
    {
        if (id != dto.Id) return BadRequest("ID mismatch.");
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var originalCategory = await _categoryService.GetByIdAsync(id);
        if (originalCategory == null) return NotFound();

        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin)
            return StatusCode(403, "Solo un Admin puede modificar categorías.");

        var category = new Category
        {
            Id = dto.Id,
            Name = dto.Name
        };

        var updated = await _categoryService.UpdateAsync(category);
        if (!updated) return StatusCode(500, "Error al actualizar la categoría.");

        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var originalCategory = await _categoryService.GetByIdAsync(id);
        if (originalCategory == null) return NotFound();

        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin)
            return StatusCode(403, "Solo un Admin puede eliminar categorías.");

        var deleted = await _categoryService.DeleteAsync(id);
        if (!deleted) return StatusCode(500, "Error al eliminar la categoría.");

        return NoContent();
    }
}