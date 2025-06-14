using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Models
{
    public class Category
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Name is required")]
        public string Name { get; set; } = string.Empty;

        public ICollection<Expense>? Expenses { get; set; } = null;
    }
}
