using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using AuthAPI.Data;
using AuthAPI.Services;

var builder = WebApplication.CreateBuilder(args);

var logger = LoggerFactory.Create(builder => builder.AddConsole()).CreateLogger<Program>();
logger.LogInformation("Starting Auth Management API...");

// Add DbContext
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var secretKey = builder.Configuration["Jwt:Key"] ?? builder.Configuration["Jwt:SecretKey"];
        if (string.IsNullOrEmpty(secretKey))
        {
            throw new InvalidOperationException("JWT Secret Key not configured. Please add 'Jwt:Key' or 'Jwt:SecretKey' to appsettings.json");
        }

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IdentitySeeder>();

builder.Services.AddControllers();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Auth API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    // var logger = services.GetRequiredService<ILogger<Program>>();

    // Decide whether to run migrations at startup.
    // Priority: Environment variable RUN_MIGRATIONS > Config RunMigrations > Default (Development only)
    var runMigrationsEnv = Environment.GetEnvironmentVariable("RUN_MIGRATIONS");
    bool runMigrations;

    if (!string.IsNullOrEmpty(runMigrationsEnv))
    {
        // Explicit environment variable takes highest priority
        runMigrations = string.Equals(runMigrationsEnv, "true", StringComparison.OrdinalIgnoreCase);
        logger.LogInformation($"RUN_MIGRATIONS environment variable detected: {runMigrationsEnv}");
    }
    else
    {
        // Fall back to config or Development environment
        var runMigrationsConfig = builder.Configuration.GetValue<bool?>("RunMigrations");
        runMigrations = runMigrationsConfig ?? app.Environment.IsDevelopment();
    }

    if (runMigrations)
    {
        try
        {
            var dbContext = services.GetRequiredService<AuthDbContext>();
            logger.LogInformation("Applying pending migrations for auth api...");

            // Use EF execution strategy to handle transient failures with automatic retry
            var strategy = dbContext.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await dbContext.Database.MigrateAsync();
            });

            logger.LogInformation("Migrations applied successfully.");

            // Seed identity data in Development only
            if (app.Environment.IsDevelopment())
            {
                var seeder = services.GetRequiredService<IdentitySeeder>();
                await seeder.SeedAsync();
                logger.LogInformation("Identity seeder executed.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while migrating or seeding the database.");
            throw;
        }
    }
    else
    {
        logger.LogInformation("Skipping automatic database migrations on startup (not Development and RUN_MIGRATIONS not set).");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
