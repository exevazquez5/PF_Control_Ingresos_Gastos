using System.ComponentModel.DataAnnotations;
using ExpensesTracker.api.Models;

public class GastoConCuotasDto : IValidatableObject
{
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public DateTime PurchaseDate { get; set; }
    public int Cuotas { get; set; }
    public bool IsInstallments { get; set; } = true;
    public int? CreditCardId { get; set; }
    public FundingSource FundingSource { get; set; } = FundingSource.Income;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (IsInstallments && !CreditCardId.HasValue)
        {
            yield return new ValidationResult(
                "CreditCardId es obligatorio cuando IsInstallments es true.",
                new[] { nameof(CreditCardId) }
            );
        }
    }
}
