using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Services;
using Vermillion.EntryExit.Domain.Models.DTOs;

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

        var t = tenant!;
        var dto = new TenantDto(t.Id, t.Name, t.Domain, t.IsActive);
        return Ok(new AuthApiResponse<TenantDto> { Success = true, Data = dto, Message = "Tenant registered successfully" });
    }

    [HttpGet]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetAllTenants()
    {
        var tenants = await _tenantService.GetAllTenantsAsync();
        var dtos = tenants.Select(t => new TenantDto(t.Id, t.Name, t.Domain, t.IsActive)).ToList();
        return Ok(new AuthApiResponse<List<TenantDto>> { Success = true, Data = dtos, Message = null });
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantById(int id)
    {
        var tenant = await _tenantService.GetTenantByIdAsync(id);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        var t2 = tenant!;
        var dto2 = new TenantDto(t2.Id, t2.Name, t2.Domain, t2.IsActive);
        return Ok(new AuthApiResponse<TenantDto> { Success = true, Data = dto2, Message = null });
    }

    [HttpGet("domain/{domain}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantByDomain(string domain)
    {
        var tenant = await _tenantService.GetTenantByDomainAsync(domain);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        var t3 = tenant!;
        var dto3 = new TenantDto(t3.Id, t3.Name, t3.Domain, t3.IsActive);
        return Ok(new AuthApiResponse<TenantDto> { Success = true, Data = dto3, Message = null });
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

        var t4 = tenant!;
        var dto4 = new TenantDto(t4.Id, t4.Name, t4.Domain, t4.IsActive);
        return Ok(new AuthApiResponse<TenantDto> { Success = true, Data = dto4, Message = "Tenant updated successfully" });
    }
}

public record UpdateTenantRequest(string? Name = null, string? Domain = null);
