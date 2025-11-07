using AuthAPI.Models.Entities;
using AuthAPI.Models.DTOs;

namespace AuthAPI.Services;

public interface IJwtService
{
    string GenerateAccessToken(User user, List<UserTenantDto> tenants);
    string GenerateRefreshToken();
    int? ValidateAccessToken(string token);
}
