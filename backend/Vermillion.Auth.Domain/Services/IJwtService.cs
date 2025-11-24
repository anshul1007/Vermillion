using Vermillion.Auth.Domain.Models.Entities;
using Vermillion.Auth.Domain.Models.DTOs;

namespace Vermillion.Auth.Domain.Services;

public interface IJwtService
{
    string GenerateAccessToken(User user, List<UserTenantDto> tenants);
    string GenerateRefreshToken();
    int? ValidateAccessToken(string token);
}
