using ExpensesTracker.api.Models;

public class PagoCuota
{
    public int Id { get; set; }
    public int ExpenseId { get; set; }
    public int NroCuota { get; set; }
    public decimal MontoCuota { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public PagoCuotaStatus Status { get; set; } = PagoCuotaStatus.Pending;
    public Expense? Expense { get; set; }

}
