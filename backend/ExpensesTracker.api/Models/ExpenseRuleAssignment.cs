namespace ExpensesTracker.api.Models
{
    /// <summary>
    /// Reasignación manual de un gasto a una regla en un mes concreto.
    /// Prioridad manual &gt; auto-match; cada gasto (sin cuotas) o cada cuota se
    /// asigna a una sola regla (índices únicos), y queda excluido del auto-match.
    /// </summary>
    public class ExpenseRuleAssignment
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public int RuleId { get; set; }
        public DiscountRule Rule { get; set; } = null!;

        public int ExpenseId { get; set; }
        public Expense Expense { get; set; } = null!;

        /// <summary>Cuota puntual para gastos en cuotas; null en gastos de un solo pago.</summary>
        public int? PagoCuotaId { get; set; }

        public int Year { get; set; }
        public int Month { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}