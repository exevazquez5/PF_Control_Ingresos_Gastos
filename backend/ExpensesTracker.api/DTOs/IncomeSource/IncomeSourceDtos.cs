using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.IncomeSource
{
    public class IncomeSourceDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Mode { get; set; }
        public bool IsArchived { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<string> Aliases { get; set; } = new();
        public int IncomeCount { get; set; }
    }

    public class CreateIncomeSourceDto
    {
        [Required]
        public string Name { get; set; }
        public string Mode { get; set; } = "neto";
    }

    public class UpdateIncomeSourceDto
    {
        [Required]
        public string Name { get; set; }
        public string Mode { get; set; } = "neto";
    }

    public class MergeIncomeSourceDto
    {
        [Required]
        public int SourceId { get; set; }
        [Required]
        public int TargetSourceId { get; set; }
    }
}
