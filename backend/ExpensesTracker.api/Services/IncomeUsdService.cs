using System.Text.Json;
using ExpensesTracker.api.Data;
using Microsoft.EntityFrameworkCore;

namespace ExpensesTracker.api.Services;

public sealed class IncomeUsdService
{
    private readonly AppDbContext _db;
    private readonly HttpClient _http;
    private const string Provider = "MonedAPI MEP (USD/bolsa), venta";

    public IncomeUsdService(AppDbContext db, HttpClient http)
    {
        _db = db;
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(12);
    }

    public async Task CaptureAsync(ExpensesTracker.api.Models.Income income)
    {
        try
        {
            var url = $"https://monedapi.ar/api/v2/date/{income.Date:yyyy-MM-dd}/usd/bolsa";
            using var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode) return;
            await using var stream = await response.Content.ReadAsStreamAsync();
            var quote = await JsonSerializer.DeserializeAsync<AsOfQuote>(stream,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (quote?.Sell is not > 0 || quote.QuotedAt == null) return;
            income.UsdMepRate = quote.Sell;
            income.UsdMepQuotedAt = quote.QuotedAt.Value.DateTime;
            income.UsdMepAmount = decimal.Round(income.Amount / quote.Sell.Value, 2);
            income.UsdMepSource = Provider;
            await _db.SaveChangesAsync();
        }
        catch (HttpRequestException) { }
        catch (TaskCanceledException) { }
        catch (JsonException) { }
    }

    public async Task<object> GetOverviewAsync(int userId, DateTime from, DateTime to)
    {
        var incomes = await _db.Incomes.Include(i => i.Source)
            .Where(i => i.UserId == userId && i.Date.Date >= from && i.Date.Date <= to)
            .OrderBy(i => i.Date).ToListAsync();
        if (incomes.Count == 0)
            return new { Months = Array.Empty<object>(), Provider, HasUnavailableRates = false };

        var quotes = new List<Quote>();
        var start = from.AddDays(-7);
        // MonedAPI returns up to 500 observations. Split long MAX ranges into six-month
        // windows so the API cap cannot silently discard the older history.
        for (var chunkStart = start; chunkStart <= to; chunkStart = chunkStart.AddDays(350))
        {
            var chunkEnd = chunkStart.AddDays(349) < to ? chunkStart.AddDays(349) : to;
            try
            {
                var url = $"https://monedapi.ar/api/v2/history/usd/bolsa?date_from={chunkStart:yyyy-MM-dd}&date_to={chunkEnd:yyyy-MM-dd}&limit=500";
                using var response = await _http.GetAsync(url);
                if (!response.IsSuccessStatusCode) continue;
                await using var stream = await response.Content.ReadAsStreamAsync();
                var rows = await JsonSerializer.DeserializeAsync<List<Quote>>(stream,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (rows != null) quotes.AddRange(rows.Where(q => q.Sell > 0));
            }
            catch (HttpRequestException) { }
            catch (TaskCanceledException) { }
        }

        var uniqueQuotes = quotes.GroupBy(q => q.CreatedAt).Select(g => g.First())
            .OrderBy(q => q.CreatedAt).ToList();
        var byId = incomes.ToDictionary(i => i.Id);
        foreach (var income in incomes)
        {
            var prior = uniqueQuotes.LastOrDefault(q => q.CreatedAt.Date <= income.Date.Date);
            // Keep previously captured rates stable even if the provider revises history.
            if (income.UsdMepRate == null && prior != null)
            {
                income.UsdMepRate = prior.Sell;
                income.UsdMepQuotedAt = prior.CreatedAt.DateTime;
                income.UsdMepAmount = decimal.Round(income.Amount / prior.Sell, 2);
                income.UsdMepSource = Provider;
            }
            else if (income.UsdMepRate.HasValue)
            {
                // Keep the converted amount aligned when an ARS transaction is edited.
                income.UsdMepAmount = decimal.Round(income.Amount / income.UsdMepRate.Value, 2);
            }
        }
        if (incomes.Any(i => i.UsdMepRate.HasValue)) await _db.SaveChangesAsync();

        var result = incomes.GroupBy(i => new { i.Date.Year, i.Date.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                Ars = g.Sum(i => i.Amount),
                Usd = g.Sum(i => i.UsdMepAmount ?? 0m),
                ConvertedCount = g.Count(i => i.UsdMepAmount.HasValue),
                IncomeCount = g.Count(),
                Incomes = g.Select(i => new
                {
                    i.Id, i.Date, i.Description, i.SourceId,
                    SourceName = i.Source?.Name ?? "Sin fuente",
                    Ars = i.Amount, Usd = i.UsdMepAmount,
                    Rate = i.UsdMepRate, QuotedAt = i.UsdMepQuotedAt
                }).ToList()
            }).ToList();

        return new { Months = result, Provider, HasUnavailableRates = incomes.Any(i => !i.UsdMepRate.HasValue) };
    }

    private sealed class Quote
    {
        public decimal Sell { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
    }

    private sealed class AsOfQuote
    {
        public decimal? Sell { get; set; }
        public DateTimeOffset? QuotedAt { get; set; }
    }
}
