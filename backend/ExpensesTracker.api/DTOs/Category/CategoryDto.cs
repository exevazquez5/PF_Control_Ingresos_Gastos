using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.DTOs.Category
{
    public class CategoryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public bool IsSystem { get; set; }
        public int? UserId { get; set; }
        public int? ParentCategoryId { get; set; }
        public string? ParentCategoryName { get; set; }
        public List<CategoryDto> Children { get; set; } = new();
        public string? Icon { get; set; }
        public string? Color { get; set; }
        public bool IsArchived { get; set; }
        public DateTime? ArchivedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
