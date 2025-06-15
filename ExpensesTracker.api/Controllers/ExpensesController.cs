using ExpensesTracker.api.Dtos.Expense;
using ExpensesTracker.api.Interfaces;
using ExpensesTracker.api.Models;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenseService;

    public ExpensesController(IExpenseService expenseService)
    {
        _expenseService = expenseService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var expenses = await _expenseService.GetAllAsync();

        var expenseDtos = expenses.Select(e => new ExpenseDto
        {
            Id = e.Id,
            Amount = e.Amount,
            Description = e.Description,
            Date = e.Date,
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name ?? "N/A",
            UserId = e.UserId,
            Username = e.User?.Username ?? "N/A"
        });

        return Ok(expenseDtos);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var e = await _expenseService.GetByIdAsync(id);
        if (e == null) return NotFound();

        var expenseDto = new ExpenseDto
        {
            Id = e.Id,
            Amount = e.Amount,
            Description = e.Description,
            Date = e.Date,
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name ?? "N/A",
            UserId = e.UserId,
            Username = e.User?.Username ?? "N/A"
        };

        return Ok(expenseDto);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var expense = new Expense
        {
            Amount = dto.Amount,
            Description = dto.Description,
            Date = dto.Date,
            CategoryId = dto.CategoryId,
            UserId = dto.UserId
        };

        var created = await _expenseService.CreateAsync(expense);

        var resultDto = new ExpenseDto
        {
            Id = created.Id,
            Amount = created.Amount,
            Description = created.Description,
            Date = created.Date,
            CategoryId = created.CategoryId,
            CategoryName = created.Category?.Name ?? "N/A",
            UserId = created.UserId,
            Username = created.User?.Username ?? "N/A"
        };

        return CreatedAtAction(nameof(GetById), new { id = resultDto.Id }, resultDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateExpenseDto dto)
    {
        if (id != dto.Id) return BadRequest("ID mismatch");
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var expense = new Expense
        {
            Id = dto.Id,
            Amount = dto.Amount,
            Description = dto.Description,
            Date = dto.Date,
            CategoryId = dto.CategoryId,
            UserId = dto.UserId
        };

        var updated = await _expenseService.UpdateAsync(expense);
        if (!updated) return NotFound();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _expenseService.DeleteAsync(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
