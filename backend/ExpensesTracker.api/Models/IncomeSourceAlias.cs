using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Models
{
    public class IncomeSourceAlias
    {
        public int Id { get; set; }

        public int IncomeSourceId { get; set; }
        public IncomeSource IncomeSource { get; set; }

        public int UserId { get; set; }
        public User User { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
    }
}
