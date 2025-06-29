public class CuotaPagadaDto
{
    public int Id { get; set; }
    public decimal MontoCuota { get; set; }
    public DateTime FechaPago { get; set; }
    public string Estado { get; set; }

    public string ExpenseDescription { get; set; }
    public int ExpenseCategoryId { get; set; }
    public string ExpenseCategoryNombre { get; set; }

    public int ExpenseId { get; set; }

    public int TotalCuotas { get; set; }
    public int Pagadas { get; set; }
    public int Restantes { get; set; }
}