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
        public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }

        public DbSet<PagoCuota> PagosCuotas { get; set; }
        public DbSet<CreditCard> CreditCards { get; set; }
        public DbSet<Budget> Budgets { get; set; }
        public DbSet<BudgetCategory> BudgetCategories { get; set; }

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
                .HasFilter("[UserId] IS NOT NULL");

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
