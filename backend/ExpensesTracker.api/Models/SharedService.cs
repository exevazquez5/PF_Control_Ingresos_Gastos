namespace ExpensesTracker.api.Models;

public class SharedService
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public int DueDay { get; set; } = 10;
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<SharedServiceParticipant> Participants { get; set; } = new List<SharedServiceParticipant>();
}

public class SharedServiceParticipant
{
    public int Id { get; set; }
    public int ServiceId { get; set; }
    public SharedService Service { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public decimal SharePercent { get; set; }
    public bool IsOwner { get; set; }
}

public class SharedServiceBill
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int ServiceId { get; set; }
    public SharedService Service { get; set; } = null!;
    public DateTime Period { get; set; }
    public string ServiceNameSnapshot { get; set; } = string.Empty;
    public string ProviderSnapshot { get; set; } = string.Empty;
    public decimal GrossAmount { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public int? ExpenseId { get; set; }
    public bool OwnerShareWasHistoricalAmount { get; set; }
    public Expense? Expense { get; set; }
    public ICollection<SharedServiceBillShare> Shares { get; set; } = new List<SharedServiceBillShare>();
    public ICollection<SharedServiceReimbursement> Reimbursements { get; set; } = new List<SharedServiceReimbursement>();
}

public class SharedServiceBillShare
{
    public int Id { get; set; }
    public int BillId { get; set; }
    public SharedServiceBill Bill { get; set; } = null!;
    public string ParticipantNameSnapshot { get; set; } = string.Empty;
    public decimal AgreedAmount { get; set; }
}

public class SharedServiceReimbursement
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int BillId { get; set; }
    public SharedServiceBill Bill { get; set; } = null!;
    public string ParticipantName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime Date { get; set; }
    public string? Note { get; set; }
}

public class TaxObligation
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; } = "Monotributo";
    public string Description { get; set; } = string.Empty;
    public DateTime Period { get; set; }
    public DateTime DueDate { get; set; }
    public decimal Amount { get; set; }
    public DateTime? PaidAt { get; set; }
    public int? ExpenseId { get; set; }
    public Expense? Expense { get; set; }
}
