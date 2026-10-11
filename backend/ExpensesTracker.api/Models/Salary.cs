namespace ExpensesTracker.api.Models
{
    public class Salary
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public int IncomeId { get; set; }
        public Income Income { get; set; } = null!;

        public decimal GrossAmount { get; set; }
        public decimal NetAmount { get; set; }

        public DateTime Date { get; set; }
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; }

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }

        public ICollection<SalaryDeduction> Deductions { get; set; } = new List<SalaryDeduction>();
    }
}
