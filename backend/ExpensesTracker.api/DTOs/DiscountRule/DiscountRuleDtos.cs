using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.DiscountRule
{
    public class DiscountRuleDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int IncomeSourceId { get; set; }
        public string IncomeSourceName { get; set; }
        public string Name { get; set; }
        public decimal? Percentage { get; set; }
        public decimal? FixedAmount { get; set; }
        public bool IsExpected { get; set; }
        public bool IsArchived { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateDiscountRuleDto
    {
        [Required]
        public int IncomeSourceId { get; set; }
        [Required]
        public string Name { get; set; }
        public decimal? Percentage { get; set; }
        public decimal? FixedAmount { get; set; }
        public bool IsExpected { get; set; }
        [Required]
        public int UserId { get; set; }
    }

    public class UpdateDiscountRuleDto
    {
        [Required]
        public int Id { get; set; }
        [Required]
        public int IncomeSourceId { get; set; }
        [Required]
        public string Name { get; set; }
        public decimal? Percentage { get; set; }
        public decimal? FixedAmount { get; set; }
        public bool IsExpected { get; set; }
        [Required]
        public int UserId { get; set; }
    }
}
