using ExpensesTracker.api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ExpensesTracker.api
{
    public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

            // Cadena de conexion tomada del entorno (solo design-time / dotnet ef)
            var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? "Host=localhost;Port=5433;Database=postgres;Username=postgres;Password=gastar_dev;SSL Mode=Disable;Trust Server Certificate=true;";
            optionsBuilder.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MigrationsHistoryTable("__efmigrationshistory");
            }).UseLowerCaseNamingConvention();

            return new AppDbContext(optionsBuilder.Options);
        }
    }
}
