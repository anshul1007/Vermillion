using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Services;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SystemAdmin")]
public class TenantController : ControllerBase
{
    private readonly ITenantService _tenantService;

    public TenantController(ITenantService tenantService)
    {
        _tenantService = tenantService;
    }

    [HttpPost("register")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> RegisterTenant([FromBody] TenantRegistrationRequest request)
    {
        var (success, tenant, error) = await _tenantService.RegisterTenantAsync(request);

        if (!success)
            return BadRequest(new ApiResponse<string>(false, null, error));

        return Ok(new ApiResponse<object>(true, new
        {
            tenant!.Id,
            tenant.Name,
            tenant.Domain,
            tenant.ApiKey
        }, "Tenant registered successfully"));
    }

    [HttpGet]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetAllTenants()
    {
        var tenants = await _tenantService.GetAllTenantsAsync();
        return Ok(new ApiResponse<object>(true, tenants, null));
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantById(int id)
    {
        var tenant = await _tenantService.GetTenantByIdAsync(id);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<object>(true, tenant, null));
    }

    [HttpGet("domain/{domain}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantByDomain(string domain)
    {
        var tenant = await _tenantService.GetTenantByDomainAsync(domain);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<object>(true, tenant, null));
    }

    [HttpPut("{id}/activate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> ActivateTenant(int id)
    {
        var result = await _tenantService.ActivateTenantAsync(id);

        if (!result)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<string>(true, null, "Tenant activated"));
    }

    [HttpPut("{id}/deactivate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeactivateTenant(int id)
    {
        var result = await _tenantService.DeactivateTenantAsync(id);

        if (!result)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<string>(true, null, "Tenant deactivated"));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> UpdateTenant(int id, [FromBody] UpdateTenantRequest request)
    {
        var (success, tenant, error) = await _tenantService.UpdateTenantAsync(id, request);

        if (!success)
            return BadRequest(new ApiResponse<string>(false, null, error));

        return Ok(new ApiResponse<object>(true, new
        {
            tenant!.Id,
            tenant.Name,
            tenant.Domain,
            tenant.IsActive
        }, "Tenant updated successfully"));
    }
}

public record UpdateTenantRequest(string? Name = null, string? Domain = null);
