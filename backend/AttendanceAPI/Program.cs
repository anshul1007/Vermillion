using AttendanceAPI.Data;
using AttendanceAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.FeatureManagement;
using Microsoft.FeatureManagement.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add DbContext with PostgreSQL
var defaultConn = builder.Configuration.GetConnectionString("DefaultConnection")
                  ?? throw new InvalidOperationException("DefaultConnection is not configured");

// Use SQL Server as the single provider for both local development and production
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(defaultConn);
});

// Add JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
    };
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAttendanceService, AttendanceService>();
builder.Services.AddScoped<ILeaveService, LeaveService>();
builder.Services.AddScoped<IApprovalService, ApprovalService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IFeatureToggleService, FeatureToggleService>();

// Add Microsoft Feature Management
builder.Services.AddFeatureManagement()
    .AddFeatureFilter<Microsoft.FeatureManagement.FeatureFilters.TimeWindowFilter>();

// Add custom database feature definition provider
builder.Services.AddSingleton<Microsoft.FeatureManagement.IFeatureDefinitionProvider, DatabaseFeatureDefinitionProvider>();

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Apply migrations and seed the database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        
        // First, apply migrations to ensure schema exists
        logger.LogInformation("Applying pending migrations (if any)...");
        await context.Database.MigrateAsync();
        logger.LogInformation("Migrations applied successfully.");

        // Then seed the database
        logger.LogInformation("Seeding database...");
        await DatabaseSeeder.SeedDatabase(services);
        logger.LogInformation("Database seeding completed successfully!");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while migrating or seeding the database.");
        throw; // rethrow so the app fails fast and logs the error
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
