using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Models
{
    public class Category
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Name is required")]
        public string Name { get; set; } = string.Empty;

        public string Type { get; set; } = "gasto";

        public bool IsSystem { get; set; }

        public int? UserId { get; set; }
        public User? User { get; set; }

        public int? ParentCategoryId { get; set; }
        public Category? ParentCategory { get; set; }
        public ICollection<Category> Children { get; set; } = new List<Category>();

        public string? Icon { get; set; }
        public string? Color { get; set; }

        /// <summary>Categoría de ingreso con naturaleza laboral (sueldo, freelance, etc.).</summary>
        public bool IsLabor { get; set; }

        public bool IsArchived { get; set; }
        public DateTime? ArchivedAt { get; set; }

        public DateTime CreatedAt { get; set; }

        public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    }
}
