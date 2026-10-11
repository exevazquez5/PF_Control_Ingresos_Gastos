namespace ExpensesTracker.api.Models
{
    public class BudgetCategory
    {
        public int Id { get; set; }
        public int BudgetId { get; set; }
        public int CategoryId { get; set; }
        public decimal Amount { get; set; }
        public decimal AlertThreshold { get; set; } = 0.7m;

        public Budget Budget { get; set; } = null!;
        public Category Category { get; set; } = null!;
    }
}
