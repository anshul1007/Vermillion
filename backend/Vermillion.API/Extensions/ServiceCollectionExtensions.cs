using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Vermillion.Auth.Domain.Data;
using Vermillion.Auth.Domain.Services;
using Vermillion.Attendance.Domain.Data;
using Vermillion.Attendance.Domain.Services;
using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Services;
using Vermillion.Shared.Domain.Data;
using Vermillion.Shared.Domain.Services;

namespace Vermillion.API.Extensions;

/// <summary>
/// Extension methods for IServiceCollection to organize service registration
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Configures all database contexts for the application
    /// </summary>
    public static IServiceCollection AddVermillionDatabase(this IServiceCollection services, IConfiguration configuration, ILogger logger)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
                              ?? throw new InvalidOperationException("DefaultConnection is not configured");

        logger.LogInformation("Configuring DbContexts for Auth, Attendance, EntryExit, and Shared domains...");

        services.AddDbContext<AuthDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddDbContext<AttendanceDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddDbContext<EntryExitDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddDbContext<SharedDbContext>(options =>
            options.UseSqlServer(connectionString));

        return services;
    }

    /// <summary>
    /// Configures JWT authentication
    /// </summary>
    public static IServiceCollection AddVermillionAuthentication(this IServiceCollection services, IConfiguration configuration, ILogger logger)
    {
        var jwtConfig = configuration.GetSection("Jwt");
        var secretKey = jwtConfig["Key"] ?? throw new InvalidOperationException("JWT Key not configured");

        var loggerFactory = LoggerFactory.Create(loggingBuilder =>
        {
            loggingBuilder.AddConfiguration(configuration.GetSection("Logging"));
            loggingBuilder.AddConsole();
        });
        var jwtAuthLogger = loggerFactory.CreateLogger("JwtAuth");

        services.AddAuthentication(options =>
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
                ValidIssuer = jwtConfig["Issuer"],
                ValidAudience = jwtConfig["Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                ClockSkew = TimeSpan.Zero
            };

            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    jwtAuthLogger.LogWarning(context.Exception, "JWT authentication failed: {Message}", context.Exception.Message);
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    var sub = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                             ?? context.Principal?.FindFirst("sub")?.Value;
                    jwtAuthLogger.LogInformation("JWT validated for sub={Sub}, name={Name}", sub, context.Principal?.Identity?.Name);

                    // Handle role claims from different JWT shapes
                    var jwtToken = context.SecurityToken as System.IdentityModel.Tokens.Jwt.JwtSecurityToken;
                    if (jwtToken != null && context.Principal?.Identity is System.Security.Claims.ClaimsIdentity identity)
                    {
                        // Add role claims from various sources
                        void AddRoleClaim(string? roleValue)
                        {
                            if (!string.IsNullOrEmpty(roleValue) && context.Principal != null
                                && !context.Principal.HasClaim(System.Security.Claims.ClaimTypes.Role, roleValue))
                            {
                                identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, roleValue));
                            }
                        }

                        // Check for role claims in token payload
                        if (jwtToken.Payload.TryGetValue("role", out var roleObj) && roleObj != null)
                        {
                            if (roleObj is System.Text.Json.JsonElement je)
                            {
                                if (je.ValueKind == System.Text.Json.JsonValueKind.Array)
                                {
                                    foreach (var elem in je.EnumerateArray())
                                    {
                                        AddRoleClaim(elem.GetString());
                                    }
                                }
                                else if (je.ValueKind == System.Text.Json.JsonValueKind.String)
                                {
                                    AddRoleClaim(je.GetString());
                                }
                            }
                            else if (roleObj is string roleStr)
                            {
                                AddRoleClaim(roleStr);
                            }
                        }

                        // Check for domain-specific role claims (role:attendance, role:entryexit, etc.)
                        foreach (var claim in jwtToken.Claims)
                        {
                            if (claim.Type.StartsWith("role:"))
                            {
                                AddRoleClaim(claim.Value);
                            }
                        }
                    }

                    return Task.CompletedTask;
                }
            };
        });

        services.AddAuthorization();

        logger.LogInformation("JWT authentication configured successfully");

        return services;
    }

    /// <summary>
    /// Registers all domain services
    /// </summary>
    public static IServiceCollection AddVermillionDomainServices(this IServiceCollection services, ILogger logger)
    {
        // Auth Domain Services
        logger.LogInformation("Registering Auth domain services...");
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ITenantService, TenantService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IdentitySeeder>();

        // Attendance Domain Services
        logger.LogInformation("Registering Attendance domain services...");
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ITeamManagementHelper, TeamManagementHelper>();
        // IHttpContextAccessor is required by CurrentUserService
        services.AddHttpContextAccessor();

        // EntryExit Domain Services
        logger.LogInformation("Registering EntryExit domain services...");
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<ILabourService, LabourService>();
        services.AddScoped<IVisitorService, VisitorService>();
        services.AddScoped<IEntryExitRecordService, EntryExitRecordService>();
        services.AddScoped<IPhotoStorageService, BlobStoragePhotoService>();
        services.AddScoped<IEncryptionService, EncryptionService>();
        // Add data protection for EncryptionService
        services.AddDataProtection();
        services.AddScoped<EntryExitSeeder>();

        // Shared Domain Services
        logger.LogInformation("Registering Shared domain services...");
        services.AddScoped<SharedSeeder>();

        // Add Memory Cache for cross-domain caching
        services.AddMemoryCache();

        return services;
    }

    /// <summary>
    /// Configures Swagger/OpenAPI
    /// </summary>
    public static IServiceCollection AddVermillionSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Vermillion Unified API",
                Version = "v1",
                Description = "Unified API for Auth, Attendance, and EntryExit domains"
            });
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
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

        return services;
    }

    /// <summary>
    /// Configures CORS policy
    /// </summary>
    public static IServiceCollection AddVermillionCors(this IServiceCollection services, IConfiguration configuration)
    {
        var configuredOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                               ?? Array.Empty<string>();

        // Support additional origins via environment variable (comma separated)
        var envOrigins = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS") ?? string.Empty;
        var envOriginsArray = envOrigins.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                               .Select(s => s.Trim())
                               .Where(s => !string.IsNullOrEmpty(s))
                               .ToArray();

        // Ensure the known local dev origins are present if no origins configured
        var defaultLocalOrigins = new[] { "http://localhost:4200", "https://localhost:4200", "http://localhost:4300", "https://localhost:4300" };

        var allowedOrigins = configuredOrigins
            .Concat(envOriginsArray)
            .Concat(configuredOrigins.Length == 0 && envOriginsArray.Length == 0 ? defaultLocalOrigins : Array.Empty<string>())
            .Distinct()
            .ToArray();

        // Create logger for CORS diagnostics
        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var corsLogger = loggerFactory.CreateLogger("CORS");
        corsLogger.LogInformation("CORS configured with origins: {Origins}", string.Join(", ", allowedOrigins));

        services.AddCors(options =>
        {
            options.AddPolicy("AllowConfiguredOrigins", policy =>
            {
                policy.SetIsOriginAllowed(origin =>
                {
                    corsLogger.LogInformation("CORS: Checking origin '{Origin}'", origin);
                    
                    // Check if origin matches any configured origin
                    if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
                    {
                        corsLogger.LogInformation("CORS: Origin '{Origin}' matched exact origin", origin);
                        return true;
                    }

                    // Check for wildcard patterns (e.g., https://*.azurestaticapps.net)
                    foreach (var pattern in allowedOrigins)
                    {
                        if (pattern.Contains("*"))
                        {
                            var regex = new System.Text.RegularExpressions.Regex(
                                "^" + System.Text.RegularExpressions.Regex.Escape(pattern).Replace("\\*", ".*") + "$",
                                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                            if (regex.IsMatch(origin))
                            {
                                corsLogger.LogInformation("CORS: Origin '{Origin}' matched wildcard pattern '{Pattern}'", origin, pattern);
                                return true;
                            }
                        }
                    }

                    corsLogger.LogWarning("CORS: Origin '{Origin}' not allowed", origin);
                    return false;
                })
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
            });
        });

        return services;
    }
}
