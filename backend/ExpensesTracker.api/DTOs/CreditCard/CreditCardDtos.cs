using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.CreditCard
{
    public class CreditCardDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? Name { get; set; }
        public int ClosingDay { get; set; }
        public int DueDay { get; set; }
    }

    public class CreateCreditCardDto
    {
        public string? Name { get; set; }

        [Range(1, 31)]
        public int ClosingDay { get; set; }

        [Range(1, 31)]
        public int DueDay { get; set; }
    }
}
