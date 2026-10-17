using ExpensesTracker.api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ExpensesTracker.api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Expense> Expenses { get; set; }
        public DbSet<Income> Incomes { get; set; }
        public DbSet<IncomeSource> IncomeSources { get; set; }
        public DbSet<IncomeSourceAlias> IncomeSourceAliases { get; set; }
        public DbSet<DiscountRule> DiscountRules { get; set; }
        public DbSet<ExpenseRuleAssignment> ExpenseRuleAssignments { get; set; }
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }

        public DbSet<PagoCuota> PagosCuotas { get; set; }
        public DbSet<CreditCard> CreditCards { get; set; }
        public DbSet<Budget> Budgets { get; set; }
        public DbSet<BudgetCategory> BudgetCategories { get; set; }
        public DbSet<SharedService> SharedServices { get; set; }
        public DbSet<SharedServiceParticipant> SharedServiceParticipants { get; set; }
        public DbSet<SharedServiceBill> SharedServiceBills { get; set; }
        public DbSet<SharedServiceBillShare> SharedServiceBillShares { get; set; }
        public DbSet<SharedServiceReimbursement> SharedServiceReimbursements { get; set; }
        public DbSet<TaxObligation> TaxObligations { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<PagoCuota>()
                .Property(p => p.Status)
                .HasConversion<string>();

            modelBuilder.Entity<CreditCard>()
                .HasOne(cc => cc.User)
                .WithMany()
                .HasForeignKey(cc => cc.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Expense>()
                .HasOne(e => e.CreditCard)
                .WithMany(cc => cc.Expenses)
                .HasForeignKey(e => e.CreditCardId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Budget>()
                .HasOne(b => b.User)
                .WithMany()
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Budget>()
                .HasIndex(b => new { b.UserId, b.Period })
                .IsUnique()
                .HasFilter(null);

            modelBuilder.Entity<Budget>()
                .HasIndex(b => new { b.UserId, b.PeriodStart });

            modelBuilder.Entity<BudgetCategory>()
                .HasOne(bc => bc.Budget)
                .WithMany(b => b.Categories)
                .HasForeignKey(bc => bc.BudgetId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<BudgetCategory>()
                .HasOne(bc => bc.Category)
                .WithMany()
                .HasForeignKey(bc => bc.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<BudgetCategory>()
                .HasIndex(bc => new { bc.BudgetId, bc.CategoryId })
                .IsUnique();

            modelBuilder.Entity<Category>()
                .HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Category>()
                .HasOne(c => c.ParentCategory)
                .WithMany(c => c.Children)
                .HasForeignKey(c => c.ParentCategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Category>()
                .HasIndex(c => new { c.UserId, c.Name })
                .IsUnique()
                .HasFilter("userid IS NOT NULL");

            modelBuilder.Entity<Expense>()
                .HasQueryFilter(e => !e.IsDeleted);

            modelBuilder.Entity<Income>()
                .HasQueryFilter(i => !i.IsDeleted);

            modelBuilder.Entity<Budget>()
                .HasQueryFilter(b => !b.IsDeleted);

            modelBuilder.Entity<CreditCard>()
                .HasQueryFilter(cc => !cc.IsDeleted);

            modelBuilder.Entity<Category>()
                .HasQueryFilter(c => !c.IsArchived);

            modelBuilder.Entity<IncomeSource>()
                .HasIndex(s => new { s.UserId, s.Name })
                .IsUnique();

            modelBuilder.Entity<IncomeSource>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<IncomeSource>()
                .HasQueryFilter(s => !s.IsArchived);

            modelBuilder.Entity<IncomeSourceAlias>()
                .HasIndex(a => new { a.UserId, a.Name })
                .IsUnique();

            modelBuilder.Entity<IncomeSourceAlias>()
                .HasOne(a => a.IncomeSource)
                .WithMany()
                .HasForeignKey(a => a.IncomeSourceId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DiscountRule>()
                .HasIndex(r => new { r.IncomeSourceId, r.Name })
                .IsUnique();

            modelBuilder.Entity<DiscountRule>()
                .HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DiscountRule>()
                .HasQueryFilter(r => !r.IsArchived);

            modelBuilder.Entity<DiscountRule>()
                .HasOne(r => r.LinkedCategory)
                .WithMany()
                .HasForeignKey(r => r.LinkedCategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ExpenseRuleAssignment>()
                .HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ExpenseRuleAssignment>()
                .HasOne(a => a.Rule)
                .WithMany()
                .HasForeignKey(a => a.RuleId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ExpenseRuleAssignment>()
                .HasOne(a => a.Expense)
                .WithMany()
                .HasForeignKey(a => a.ExpenseId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ExpenseRuleAssignment>()
                .HasIndex(a => a.ExpenseId)
                .IsUnique()
                .HasFilter("pagocuotaid IS NULL");

            modelBuilder.Entity<ExpenseRuleAssignment>()
                .HasIndex(a => a.PagoCuotaId)
                .IsUnique()
                .HasFilter("pagocuotaid IS NOT NULL");

            modelBuilder.Entity<ExpenseRuleAssignment>()
                .HasIndex(a => new { a.RuleId, a.Year, a.Month });

            modelBuilder.Entity<SharedService>()
                .HasMany(s => s.Participants)
                .WithOne(p => p.Service)
                .HasForeignKey(p => p.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SharedServiceBill>()
                .HasOne(b => b.Expense)
                .WithMany()
                .HasForeignKey(b => b.ExpenseId)
                .OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<SharedServiceBill>()
                .HasIndex(b => new { b.ServiceId, b.Period })
                .IsUnique();
            modelBuilder.Entity<SharedServiceBill>()
                .HasMany(b => b.Shares)
                .WithOne(s => s.Bill)
                .HasForeignKey(s => s.BillId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SharedServiceBill>()
                .HasMany(b => b.Reimbursements)
                .WithOne(r => r.Bill)
                .HasForeignKey(r => r.BillId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SharedServiceReimbursement>()
                .HasIndex(r => new { r.UserId, r.Date });
            modelBuilder.Entity<TaxObligation>()
                .HasOne(t => t.Expense)
                .WithMany()
                .HasForeignKey(t => t.ExpenseId)
                .OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<TaxObligation>()
                .HasIndex(t => new { t.UserId, t.Type, t.Period })
                .IsUnique(false);

            modelBuilder.Entity<Income>()
                .HasOne(i => i.Source)
                .WithMany(s => s.Incomes)
                .HasForeignKey(i => i.SourceId)
                .OnDelete(DeleteBehavior.SetNull);

            // All date columns are `timestamp without time zone`, which Npgsql maps to
            // DateTime with Kind=Unspecified. Normalize any Utc/Local Kind (e.g. DateTime.UtcNow
            // or a JSON date with 'Z') to Unspecified so writes never throw.
            var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
                v => DateTime.SpecifyKind(v, DateTimeKind.Unspecified),
                v => DateTime.SpecifyKind(v, DateTimeKind.Unspecified));

            var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Unspecified) : v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Unspecified) : v);

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                    {
                        property.SetColumnType("timestamp without time zone");
                        property.SetValueConverter(dateTimeConverter);
                    }
                    else if (property.ClrType == typeof(DateTime?))
                    {
                        property.SetColumnType("timestamp without time zone");
                        property.SetValueConverter(nullableDateTimeConverter);
                    }
                }
            }
        }
    }
}
