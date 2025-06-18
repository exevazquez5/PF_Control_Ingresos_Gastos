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
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var isAdmin = User.IsInRole("Admin");
        if (!isAdmin)
        {
            return StatusCode(403, "Solo un Admin puede crear categorías.");
        }

        // 🔸 Normalizar el nombre: trim y pasar a minúsculas para validaciones
        var nombreNormalizadoLower = dto.Name.Trim().ToLower();

        // 🔸 Palabras reservadas no permitidas
        var palabrasReservadas = new[] { "general", "default", "por defecto" };
        if (palabrasReservadas.Contains(nombreNormalizadoLower))
        {
            return BadRequest("Ese nombre está reservado y no puede usarse.");
        }

        // 🔸 Validar si ya existe la categoría (case-insensitive)
        var categoriasExistentes = await _categoryService.GetAllAsync();
        var yaExiste = categoriasExistentes.Any(c =>
            c.Name.Trim().ToLower() == nombreNormalizadoLower);

        if (yaExiste)
        {
            return BadRequest("Ya existe una categoría con ese nombre.");
        }

        // 🔸 Capitalizar el nombre antes de guardar
        var nombreCapitalizado = Capitalizar(dto.Name.Trim());

        var category = new Category
        {
            Name = nombreCapitalizado
        };

        var created = await _categoryService.CreateAsync(category);

        var result = new CategoryDto
        {
            Id = created.Id,
            Name = created.Name
        };

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }
    private string Capitalizar(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return input;
        return CultureInfo.CurrentCulture.TextInfo.ToTitleCase(input.ToLower());
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

        // 🔎 Validaciones

        var nombreNormalizadoLower = dto.Name.Trim().ToLower();

        // ✔️ Palabras reservadas
        var palabrasReservadas = new[] { "general", "default", "por defecto" };
        if (palabrasReservadas.Contains(nombreNormalizadoLower))
            return BadRequest("Ese nombre está reservado y no puede usarse.");

        // ✔️ Longitud mínima/máxima
        if (dto.Name.Trim().Length < 3 || dto.Name.Trim().Length > 50)
            return BadRequest("El nombre debe tener entre 3 y 50 caracteres.");

        // ✔️ Validar caracteres permitidos (solo letras, espacios y guiones)
        if (!Regex.IsMatch(dto.Name.Trim(), @"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s-]+$"))
            return BadRequest("El nombre contiene caracteres inválidos.");

        // ✔️ Verificar duplicado (ignorando el actual)
        var categoriasExistentes = await _categoryService.GetAllAsync();
        var yaExiste = categoriasExistentes.Any(c =>
            c.Id != dto.Id &&
            c.Name.Trim().ToLower() == nombreNormalizadoLower);

        if (yaExiste)
            return BadRequest("Ya existe otra categoría con ese nombre.");

        // ✨ Capitalizar y normalizar antes de guardar
        var nombreCapitalizado = Capitalizar(dto.Name.Trim());

        var category = new Category
        {
            Id = dto.Id,
            Name = nombreCapitalizado
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