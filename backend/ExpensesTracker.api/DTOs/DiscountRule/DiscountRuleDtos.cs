using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.DiscountRule
{
    public class DiscountRuleDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int IncomeSourceId { get; set; }
        public string IncomeSourceName { get; set; }
        public string IncomeSourceMode { get; set; }
        public string Name { get; set; }
        public decimal? Percentage { get; set; }
        public decimal? FixedAmount { get; set; }
        public int? LinkedCategoryId { get; set; }
        public string? LinkedCategoryName { get; set; }
        public string? LinkedDescription { get; set; }
        public bool IsExpected { get; set; }
        public bool IsArchived { get; set; }
        /// <summary>Vigencia desde (inclusive).</summary>
        public DateTime ValidFrom { get; set; }
        /// <summary>Vigencia hasta (inclusive). Null = sin fin.</summary>
        public DateTime? ValidTo { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateDiscountRuleDto
    {
        [Required]
        public int IncomeSourceId { get; set; }
        [Required]
        public string Name { get; set; }
        public decimal? Percentage { get; set; }
        public decimal? FixedAmount { get; set; }
        public int? LinkedCategoryId { get; set; }
        public string? LinkedDescription { get; set; }
        public bool IsExpected { get; set; }
        /// <summary>Vigencia desde. Si se omite, se usa el primer día del mes de creación.</summary>
        public DateTime? ValidFrom { get; set; }
        /// <summary>Vigencia hasta (inclusive). Null = sin fin.</summary>
        public DateTime? ValidTo { get; set; }
        [Required]
        public int UserId { get; set; }
    }

    public class UpdateDiscountRuleDto
    {
        [Required]
        public int Id { get; set; }
        [Required]
        public int IncomeSourceId { get; set; }
        [Required]
        public string Name { get; set; }
        public decimal? Percentage { get; set; }
        public decimal? FixedAmount { get; set; }
        public int? LinkedCategoryId { get; set; }
        public string? LinkedDescription { get; set; }
        public bool IsExpected { get; set; }
        /// <summary>Vigencia desde. Si se omite, conserva la vigencia existente.</summary>
        public DateTime? ValidFrom { get; set; }
        /// <summary>Vigencia hasta (inclusive). Null = sin fin.</summary>
        public DateTime? ValidTo { get; set; }
        [Required]
        public int UserId { get; set; }
    }

    public class AssignExpenseDto
    {
        [Required]
        public int ExpenseId { get; set; }
        public int? PagoCuotaId { get; set; }
        [Required]
        public int Year { get; set; }
        [Required]
        public int Month { get; set; }
    }

    public class ExpenseRuleAssignmentDto
    {
        public int Id { get; set; }
        public int RuleId { get; set; }
        public string RuleName { get; set; }
        public int ExpenseId { get; set; }
        public int? PagoCuotaId { get; set; }
        public int Year { get; set; }
        public int Month { get; set; }
    }

    public class DiscountLineDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Tipo { get; set; }
        public decimal? Porcentaje { get; set; }
        public decimal? Fijo { get; set; }
        public decimal? Monto { get; set; }
        public bool Deduce { get; set; }
        public bool RequiereBruto { get; set; }
        public bool IsExpected { get; set; }
        public int GastosVinculados { get; set; }
    }

    public class SourceDiscountsDto
    {
        public int SourceId { get; set; }
        public string SourceName { get; set; }
        public string Mode { get; set; }
        public bool TieneIngresos { get; set; }
        public decimal IngresosBruto { get; set; }
        public decimal IngresosNeto { get; set; }
        public decimal? GrossTotal { get; set; }
        public decimal Descuentos { get; set; }
        public decimal? OtrosSinDetallar { get; set; }
        public bool AvisoOtros { get; set; }
        /// <summary>Neto de la fuente. Null cuando la fuente no tiene ingresos en el mes (se omite).</summary>
        public decimal? Neto { get; set; }
        /// <summary>True cuando los descuentos superan el ingreso del mes (neto negativo).</summary>
        public bool AvisoNeto { get; set; }
        public List<DiscountLineDto> Reglas { get; set; } = new();
    }

    public class MonthDiscountsDto
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public decimal Total { get; set; }
        public decimal Descuentos { get; set; }
        /// <summary>Null en meses sin ingreso (se omite el neto).</summary>
        public decimal? Neto { get; set; }
        public List<SourceDiscountsDto> Fuentes { get; set; } = new();
    }
}
