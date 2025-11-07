using AuthAPI.Models.DTOs;
using AuthAPI.Models.Entities;

namespace AuthAPI.Services;

public interface ITenantService
{
    Task<(bool Success, Tenant? Tenant, string? Error)> RegisterTenantAsync(TenantRegistrationRequest request);
    Task<List<Tenant>> GetAllTenantsAsync();
    Task<Tenant?> GetTenantByIdAsync(int id);
    Task<Tenant?> GetTenantByDomainAsync(string domain);
    Task<bool> ActivateTenantAsync(int id);
    Task<bool> DeactivateTenantAsync(int id);
}
