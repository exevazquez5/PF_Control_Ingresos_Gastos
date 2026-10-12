using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.Income
{
    public class UpdateIncomeDto
    {
        [Required]
        public int Id { get; set; }
        [Required]
        public decimal Amount { get; set; }
        public decimal? GrossAmount { get; set; }
        public bool IsRecurring { get; set; }
        [Required]
        public string Description { get; set; }
        [Required]
        public DateTime Date { get; set; }
        [Required]
        public int CategoryId { get; set; }
        [Required]
        public int UserId { get; set; }
    }
}
