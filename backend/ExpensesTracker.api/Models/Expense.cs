namespace ExpensesTracker.api.Models
{
    public class Expense
    {
        public int Id { get; set; }
        public decimal Amount { get; set; }
        public string Description { get; set; } = string.Empty;
        public DateTime Date { get; set; }

        public int CategoryId { get; set; }
        public Category Category { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public int? CreditCardId { get; set; }
        public CreditCard? CreditCard { get; set; }

        public FundingSource FundingSource { get; set; } = FundingSource.Income;

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedByUserId { get; set; }
    }
}
