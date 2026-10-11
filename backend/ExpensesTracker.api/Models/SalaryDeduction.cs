namespace ExpensesTracker.api.Models
{
    public class SalaryDeduction
    {
        public int Id { get; set; }

        public int SalaryId { get; set; }
        public Salary Salary { get; set; } = null!;

        public int ExpenseId { get; set; }
        public Expense Expense { get; set; } = null!;

        public decimal Amount { get; set; }
    }
}
