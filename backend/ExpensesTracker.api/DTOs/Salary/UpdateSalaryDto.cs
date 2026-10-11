using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.DTOs.Salary
{
    public class UpdateSalaryDto
    {
        [Required]
        public DateTime Date { get; set; }

        [Range(0.01, double.MaxValue, ErrorMessage = "El bruto debe ser mayor a cero.")]
        public decimal GrossAmount { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public List<SalaryDeductionInput> Deductions { get; set; } = new();
    }
}
