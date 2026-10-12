using System.ComponentModel.DataAnnotations;

namespace ExpensesTracker.api.Dtos.Income
{
    public class CreateIncomeDto
    {
        [Required]
        public decimal Amount { get; set; }
        public decimal? GrossAmount { get; set; }
        public bool IsRecurring { get; set; }
        [Required]
        public string Description { get; set; }
        [Required]
        public DateTime Date { get; set; }
        [Required]
        public int CategoryId { get; set; }
        /// <summary>Fuente de ingreso del usuario. Opcional: al elegir una fuente se snapshottea su modo.</summary>
        public int? SourceId { get; set; }
        /// <summary>Nombre de la fuente (existente o nueva). Si no hay SourceId, se resuelve o crea por nombre.</summary>
        public string? SourceName { get; set; }
        /// <summary>Modo del ingreso ("neto" | "bruto"). Si no viene, se usa el modo de la fuente (D1).</summary>
        public string? Mode { get; set; }
        [Required]
        public int UserId { get; set; }
    }
}
