namespace ExpensesTracker.api.DTOs.Salary
{
    public class SalaryDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int IncomeId { get; set; }
        public decimal GrossAmount { get; set; }
        public decimal NetAmount { get; set; }
        public decimal TotalDeductions { get; set; }
        public DateTime Date { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<SalaryDeductionDto> Deductions { get; set; } = new();
    }

    public class SalaryDeductionDto
    {
        public int Id { get; set; }
        public int ExpenseId { get; set; }
        public string? ExpenseDescription { get; set; }
        public DateTime? ExpenseDate { get; set; }
        public string? ExpenseCategoryName { get; set; }
        public decimal Amount { get; set; }
    }
}
