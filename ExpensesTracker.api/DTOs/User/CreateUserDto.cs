using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.User;

public class CreateUserDto
{
    [Required]
    public string Username { get; set; }

    [Required]
    public string Password { get; set; }
}
