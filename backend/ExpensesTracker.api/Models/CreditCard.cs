namespace ExpensesTracker.api.Models
{
    public class CreditCard
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? Name { get; set; }
        public int ClosingDay { get; set; }
        public int DueDay { get; set; }

        public User? User { get; set; }
        public ICollection<Expense> Expenses { get; set; } = new List<Expense>();

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
    }
}
