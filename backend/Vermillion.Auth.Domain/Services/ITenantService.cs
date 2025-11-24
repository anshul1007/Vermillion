using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Models.Entities;

namespace Vermillion.Auth.Domain.Services;

public interface ITenantService
{
    Task<(bool Success, Tenant? Tenant, string? Error)> RegisterTenantAsync(TenantRegistrationRequest request);
    Task<List<Tenant>> GetAllTenantsAsync();
    Task<Tenant?> GetTenantByIdAsync(int id);
    Task<Tenant?> GetTenantByDomainAsync(string domain);
    Task<bool> ActivateTenantAsync(int id);
    Task<bool> DeactivateTenantAsync(int id);
    Task<(bool Success, Tenant? Tenant, string? Error)> UpdateTenantAsync(int id, object request);
}
