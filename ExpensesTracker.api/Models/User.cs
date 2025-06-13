namespace ExpensesTracker.api.Models
{
    public class User
    {
        public int Id { get; set; }  // Clave primaria
        public string Username { get; set; } = string.Empty;
        public byte[] PasswordHash { get; set; }  // Contraseña encriptada
        public ICollection<Expense> Expenses { get; set; }
    }
}
