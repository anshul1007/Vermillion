using Microsoft.EntityFrameworkCore;
using Vermillion.Auth.Domain.Data;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Models.Entities;

namespace Vermillion.Auth.Domain.Services;

public class TenantService : ITenantService
{
    private readonly AuthDbContext _context;

    public TenantService(AuthDbContext context)
    {
        _context = context;
    }

    public async Task<(bool Success, Tenant? Tenant, string? Error)> RegisterTenantAsync(TenantRegistrationRequest request)
    {
        // Check if domain already exists
        if (await _context.Tenants.AnyAsync(t => t.Domain == request.Domain))
            return (false, null, "Tenant domain already exists");

        var tenant = new Tenant
        {
            Name = request.Name,
            Domain = request.Domain,
        };

        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync();

        // Get or create Admin role
        var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "SystemAdmin");
        if (adminRole == null)
        {
            adminRole = new Role { Name = "SystemAdmin", Description = "System Administrator" };
            _context.Roles.Add(adminRole);
            await _context.SaveChangesAsync();
        }

        // Create admin user for this tenant
        var adminUser = new User
        {
            // Use email as username
            Username = request.AdminEmail,
            Email = request.AdminEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.AdminPassword)
        };

        _context.Users.Add(adminUser);
        await _context.SaveChangesAsync(); // Save to get user.Id

        // Assign Admin role to user for this tenant
        var userRole = new UserRole
        {
            UserId = adminUser.Id,
            RoleId = adminRole.Id,
            TenantId = tenant.Id,
            IsActive = true
        };

        _context.UserRoles.Add(userRole);
        await _context.SaveChangesAsync();

        return (true, tenant, null);
    }

    public async Task<List<Tenant>> GetAllTenantsAsync()
    {
        return await _context.Tenants.ToListAsync();
    }

    public async Task<Tenant?> GetTenantByIdAsync(int id)
    {
        return await _context.Tenants.FindAsync(id);
    }

    public async Task<Tenant?> GetTenantByDomainAsync(string domain)
    {
        return await _context.Tenants.FirstOrDefaultAsync(t => t.Domain == domain);
    }

    public async Task<bool> ActivateTenantAsync(int id)
    {
        var tenant = await _context.Tenants.FindAsync(id);
        if (tenant == null) return false;

        tenant.IsActive = true;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeactivateTenantAsync(int id)
    {
        var tenant = await _context.Tenants.FindAsync(id);
        if (tenant == null) return false;

        tenant.IsActive = false;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<(bool Success, Tenant? Tenant, string? Error)> UpdateTenantAsync(int id, object request)
    {
        var tenant = await _context.Tenants.FindAsync(id);
        if (tenant == null)
            return (false, null, "Tenant not found");

        // Use reflection to get properties from the request object
        var requestType = request.GetType();
        var nameProperty = requestType.GetProperty("Name");
        var domainProperty = requestType.GetProperty("Domain");

        if (nameProperty != null)
        {
            var nameValue = nameProperty.GetValue(request) as string;
            if (!string.IsNullOrEmpty(nameValue))
                tenant.Name = nameValue;
        }

        if (domainProperty != null)
        {
            var domainValue = domainProperty.GetValue(request) as string;
            if (!string.IsNullOrEmpty(domainValue))
            {
                // Check if new domain already exists
                var existingTenant = await _context.Tenants
                    .FirstOrDefaultAsync(t => t.Domain == domainValue && t.Id != id);
                if (existingTenant != null)
                    return (false, null, "Tenant domain already exists");

                tenant.Domain = domainValue;
            }
        }

        await _context.SaveChangesAsync();
        return (true, tenant, null);
    }
}
