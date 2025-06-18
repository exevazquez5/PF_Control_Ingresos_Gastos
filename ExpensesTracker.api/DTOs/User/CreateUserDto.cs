using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.User;

public class CreateUserDto
{
    [Required]
    [StringLength(20, MinimumLength = 3, ErrorMessage = "El nombre de usuario debe tener entre 3 y 20 caracteres.")]
    [RegularExpression(@"^[a-zA-Z0-9_-]+$", ErrorMessage = "El nombre de usuario solo puede contener letras, números, guiones y guiones bajos, sin espacios.")]
    public string Username { get; set; }

    [Required]
    public string Password { get; set; }

    //public string Role { get; set; } = "Admin"; // Default role is User
}
