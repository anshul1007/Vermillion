using Vermillion.API.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Create logger for startup messages
var logger = LoggerFactory.Create(builder => builder.AddConsole()).CreateLogger<Program>();
logger.LogInformation("Starting Vermillion Unified API...");

// Configure services using extension methods
builder.Services.AddVermillionDatabase(builder.Configuration, logger);
builder.Services.AddVermillionAuthentication(builder.Configuration, logger);
builder.Services.AddVermillionDomainServices(logger);
builder.Services.AddVermillionCors(builder.Configuration);
builder.Services.AddVermillionSwagger();

// Add Response Compression
builder.Services.AddResponseCompression(options =>
{
	options.EnableForHttps = true;
	options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
	options.MimeTypes = Microsoft.AspNetCore.ResponseCompression.ResponseCompressionDefaults.MimeTypes.Concat(
		new[] { "application/json" });
});

// Add Controllers with JSON options (string enums, camelCase)
builder.Services.AddControllers()
	.AddJsonOptions(opts =>
	{
		opts.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
		opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
	});

// Build application
var app = builder.Build();

// Run migrations and seeders
await app.MigrateAndSeedDatabasesAsync(builder.Configuration, logger);

// Configure middleware pipeline (includes CORS, Auth, and MapControllers)
app.UseVermillionMiddleware();
// Add correlation id middleware early in the pipeline
app.UseMiddleware<Vermillion.API.Middleware.CorrelationIdMiddleware>();

// Log startup completion
logger.LogInformation("Vermillion Unified API started successfully!");

// Lightweight health endpoint for orchestration checks
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", time = DateTime.UtcNow }));

app.Run();
