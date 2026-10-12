using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.DTOs.Category
{
    public class CreateCategoryDto
    {
        [Required]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "El nombre debe tener entre 3 y 50 caracteres.")]
        [RegularExpression(@"^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ \-]+$", ErrorMessage = "El nombre solo puede contener letras, espacios y guiones.")]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string Type { get; set; } = string.Empty;

        public int? ParentCategoryId { get; set; }

        public string? Icon { get; set; }
        public string? Color { get; set; }
        public bool IsLabor { get; set; }
    }
}
