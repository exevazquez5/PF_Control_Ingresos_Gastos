namespace ExpensesTracker.api.Models
{
    public class Income
    {
        public int Id { get; set; }
        public decimal Amount { get; set; }
        public decimal? GrossAmount { get; set; }
        public bool IsRecurring { get; set; }
        public string Description { get; set; }
        public DateTime Date { get; set; }

        public int CategoryId { get; set; }
        public Category Category { get; set; }

        /// <summary>Fuente de ingreso (empresa/extra) del usuario. Null en filas legadas.</summary>
        public int? SourceId { get; set; }
        public IncomeSource? Source { get; set; }

        /// <summary>Snapshot del modo de la fuente al crear: "neto" | "bruto" (D1).</summary>
        public string? Mode { get; set; }

        public int UserId { get; set; }
        public User User { get; set; }

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedByUserId { get; set; }
    }
}
