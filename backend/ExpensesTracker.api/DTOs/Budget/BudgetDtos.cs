using ExpensesTracker.api.Models;

namespace ExpensesTracker.api.Dtos.Budget
{
    public class BudgetDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Period { get; set; } = string.Empty;
        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }
        public decimal TotalAmount { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public List<BudgetCategoryDto> Categories { get; set; } = new();
    }

    public class BudgetCategoryDto
    {
        public int Id { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public int? ParentCategoryId { get; set; }
        public string? ParentCategoryName { get; set; }
        public decimal Amount { get; set; }
        public decimal AlertThreshold { get; set; }
    }

    public class CreateBudgetDto
    {
        public string Period { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public List<CreateBudgetCategoryDto> Categories { get; set; } = new();
    }

    public class CreateBudgetCategoryDto
    {
        public int CategoryId { get; set; }
        public decimal Amount { get; set; }
        public decimal? AlertThreshold { get; set; }
    }

    public class UpdateBudgetDto
    {
        public decimal? TotalAmount { get; set; }
        public List<UpdateBudgetCategoryDto> Categories { get; set; } = new();
    }

    public class UpdateBudgetCategoryDto
    {
        public int? Id { get; set; }
        public int CategoryId { get; set; }
        public decimal Amount { get; set; }
        public decimal? AlertThreshold { get; set; }
    }

    public class BudgetProgressDto
    {
        public bool IsInherited { get; set; }
        public string Period { get; set; } = string.Empty;
        public BudgetGlobalProgressDto Global { get; set; } = new();
        public List<BudgetCategoryProgressDto> Categories { get; set; } = new();
    }

    public class BudgetGlobalProgressDto
    {
        public decimal TotalBudget { get; set; }
        public decimal Spent { get; set; }
        public decimal Committed { get; set; }
        public decimal Available { get; set; }
        public decimal Percentage { get; set; }
        public decimal TimePercentage { get; set; }
        public int DaysElapsed { get; set; }
        public int DaysTotal { get; set; }
    }

    public class BudgetCategoryProgressDto
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public decimal BudgetLimit { get; set; }
        public decimal Spent { get; set; }
        public decimal Committed { get; set; }
        public decimal Available { get; set; }
        public decimal Percentage { get; set; }
    }

    public class BudgetWithMeta
    {
        public Models.Budget Budget { get; set; } = null!;
        public bool IsInherited { get; set; }
    }

    public class CanSpendRequest
    {
        public string Period { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public int? CategoryId { get; set; }
    }

    public class CanSpendResponse
    {
        public bool CanSpend { get; set; }
        public string Message { get; set; } = string.Empty;
        public string Level { get; set; } = string.Empty;
        public decimal AvailableGlobal { get; set; }
        public decimal? AvailableCategory { get; set; }
    }
}
