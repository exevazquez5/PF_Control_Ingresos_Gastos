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

        /// <summary>Se espera todos los meses → estados Pendiente/Incompleto (D2).</summary>
        public bool IsExpected { get; set; }

        public bool IsArchived { get; set; }
        public DateTime? ArchivedAt { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
