using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.DTOs.Category
{
    public class UpdateCategoryDto
    {
        [Required]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; }
    }
}
