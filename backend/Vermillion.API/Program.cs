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

// Configure middleware pipeline
app.UseVermillionMiddleware();

// Log startup completion
logger.LogInformation("Vermillion Unified API started successfully!");
logger.LogInformation("Auth API endpoints available at: /api/auth/*");
logger.LogInformation("Attendance API endpoints available at: /api/attendance/*");
logger.LogInformation("EntryExit API endpoints available at: /api/entryexit/*");

// Lightweight health endpoint for orchestration checks
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", time = DateTime.UtcNow }));

app.Run();
