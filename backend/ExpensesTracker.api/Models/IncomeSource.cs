using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Models
{
    public class IncomeSource
    {
        public const string ModeNeto = "neto";
        public const string ModeBruto = "bruto";

        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        /// <summary>Modo por defecto: "neto" (depositado) o "bruto" (recibo). D1.</summary>
        public string Mode { get; set; } = ModeNeto;

        public bool IsArchived { get; set; }
        public DateTime? ArchivedAt { get; set; }

        public DateTime CreatedAt { get; set; }

        public ICollection<Income> Incomes { get; set; } = new List<Income>();
        public ICollection<DiscountRule> DiscountRules { get; set; } = new List<DiscountRule>();
    }
}
