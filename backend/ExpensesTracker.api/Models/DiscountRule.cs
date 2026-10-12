using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Models
{
    public class DiscountRule
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; }

        public int IncomeSourceId { get; set; }
        public IncomeSource IncomeSource { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        /// <summary>Porcentaje del bruto (ej. 11 = 11%). Exactamente uno de Percentage/FixedAmount.</summary>
        public decimal? Percentage { get; set; }

        /// <summary>Monto fijo por mes (ej. 2500).</summary>
        public decimal? FixedAmount { get; set; }

        /// <summary>Se espera todos los meses → estados Pendiente/Incompleto (D2). Solo válida si la regla está vinculada a gastos.</summary>
        public bool IsExpected { get; set; }

        /// <summary>Categoría de gasto vinculada (match AND con LinkedDescription, D1/D2 Fase 3.5a).</summary>
        public int? LinkedCategoryId { get; set; }
        public Category? LinkedCategory { get; set; }

        /// <summary>Subcadena que debe contener la descripción del gasto (3-100, insensible a mayúsculas/acentos).</summary>
        public string? LinkedDescription { get; set; }

        /// <summary>Desde cuándo aplica la regla (inclusive). Obligatorio; por defecto, el primer día del mes de creación.</summary>
        public DateTime ValidFrom { get; set; }

        /// <summary>Hasta cuándo aplica la regla (inclusive). Null = sin fin.</summary>
        public DateTime? ValidTo { get; set; }

        public bool IsArchived { get; set; }

        /// <summary>Tiene vínculo a gastos (categoría y/o descripción) → elegible para auto-match y asignación manual.</summary>
        public bool IsLinked => LinkedCategoryId.HasValue || !string.IsNullOrWhiteSpace(LinkedDescription);
        public DateTime? ArchivedAt { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
