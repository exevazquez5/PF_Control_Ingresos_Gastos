using System.Net.Http.Json;

public class EmailService : IEmailService
{
    private const string BrevoEndpoint = "https://api.brevo.com/v3/smtp/email";

    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public EmailService(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    public async Task SendAsync(string to, string subject, string body)
    {
        var apiKey = _configuration["Email:BrevoApiKey"];
        var senderEmail = _configuration["Email:SenderEmail"];
        var senderName = _configuration["Email:SenderName"] ?? "GastAr";

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(senderEmail))
            throw new InvalidOperationException("Email no configurado: faltan Email:BrevoApiKey o Email:SenderEmail.");

        var payload = new
        {
            sender = new { name = senderName, email = senderEmail },
            to = new[] { new { email = to } },
            subject,
            textContent = body
        };

        var client = _httpClientFactory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Post, BrevoEndpoint)
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Add("api-key", apiKey);
        request.Headers.Add("accept", "application/json");

        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Brevo respondio {(int)response.StatusCode}: {error}");
        }
    }
}
