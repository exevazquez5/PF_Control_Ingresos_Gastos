namespace ExpensesTracker.api.Dtos.Income
{
    public class UpdateIncomeDto
    {
        public int Id { get; set; }
        public decimal Amount { get; set; }
        public string Description { get; set; }
        public DateTime Date { get; set; }
        public int CategoryId { get; set; }
        public int UserId { get; set; }
    }
}
