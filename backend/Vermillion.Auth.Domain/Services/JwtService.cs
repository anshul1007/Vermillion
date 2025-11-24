using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Configuration;
using Vermillion.Auth.Domain.Models.Entities;
using Vermillion.Auth.Domain.Models.DTOs;

namespace Vermillion.Auth.Domain.Services;

public class JwtService : IJwtService
{
    private readonly IConfiguration _configuration;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateAccessToken(User user, List<UserTenantDto> tenants)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured")));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // Serialize tenants to JSON for inclusion in JWT
        var tenantsJson = JsonSerializer.Serialize(tenants);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            // Use email as the Name claim so User.Identity?.Name contains the email address
            new Claim(ClaimTypes.Name, user.Email),
            new Claim("tenants", tenantsJson), // All tenant access info with roles and permissions
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Add individual tenant roles as claims for easy filtering
        // Also add a standard role claim (ClaimTypes.Role) so [Authorize(Roles = "...")] works
        foreach (var tenant in tenants)
        {
            // Tenant-scoped claim (preserves domain context)
            claims.Add(new Claim($"role:{tenant.Domain}", tenant.RoleName));

            // Add standard role claim (no tenant context) for convenience. Note: if a user has different
            // roles across tenants, consider how you want to resolve the effective role for a specific tenant.
            claims.Add(new Claim(ClaimTypes.Role, tenant.RoleName));

            // Add all permissions for this tenant as claims
            foreach (var permission in tenant.Permissions)
            {
                claims.Add(new Claim($"permission:{tenant.Domain}", permission));
            }
        }

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(Convert.ToDouble(_configuration["Jwt:AccessTokenExpiryMinutes"] ?? "60")),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public int? ValidateAccessToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured"));

        try
        {
            tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _configuration["Jwt:Issuer"],
                ValidateAudience = true,
                ValidAudience = _configuration["Jwt:Audience"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out SecurityToken validatedToken);

            var jwtToken = (JwtSecurityToken)validatedToken;
            var userIdClaim = jwtToken.Claims.First(x => x.Type == JwtRegisteredClaimNames.Sub).Value;
            return int.Parse(userIdClaim);
        }
        catch
        {
            return null;
        }
    }
}
