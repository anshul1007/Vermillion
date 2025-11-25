using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Services;
using Vermillion.Auth.Domain.Data;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ITenantService _tenantService;
    private readonly AuthDbContext _context;

    public AuthController(IAuthService authService, ITenantService tenantService, AuthDbContext context)
    {
        _authService = authService;
        _tenantService = tenantService;
        _context = context;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (success, response, error) = await _authService.LoginAsync(request);
        
        if (!success)
            return Unauthorized(new ApiResponse<string>(false, null, error));

        return Ok(new ApiResponse<LoginResponse>(true, response, "Login successful"));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var (success, response, error) = await _authService.RefreshTokenAsync(request);
        
        if (!success)
            return Unauthorized(new ApiResponse<string>(false, null, error));

        return Ok(new ApiResponse<LoginResponse>(true, response, "Token refreshed"));
    }

    [HttpPost("revoke")]
    [AllowAnonymous]
    public async Task<IActionResult> RevokeToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RevokeRefreshTokenAsync(request.RefreshToken);
        
        if (!result)
            return NotFound(new ApiResponse<string>(false, null, "Token not found"));

        return Ok(new ApiResponse<string>(true, null, "Token revoked"));
    }

    // Tenant Management Endpoints
    [HttpPost("tenant/register")]
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

    [HttpGet("tenant")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetAllTenants()
    {
        var tenants = await _tenantService.GetAllTenantsAsync();
        return Ok(new ApiResponse<object>(true, tenants, null));
    }

    [HttpGet("tenant/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantById(int id)
    {
        var tenant = await _tenantService.GetTenantByIdAsync(id);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<object>(true, tenant, null));
    }

    [HttpGet("tenant/domain/{domain}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantByDomain(string domain)
    {
        var tenant = await _tenantService.GetTenantByDomainAsync(domain);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<object>(true, tenant, null));
    }

    [HttpPut("tenant/{id}/activate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> ActivateTenant(int id)
    {
        var result = await _tenantService.ActivateTenantAsync(id);

        if (!result)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<string>(true, null, "Tenant activated"));
    }

    [HttpPut("tenant/{id}/deactivate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeactivateTenant(int id)
    {
        var result = await _tenantService.DeactivateTenantAsync(id);

        if (!result)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        return Ok(new ApiResponse<string>(true, null, "Tenant deactivated"));
    }
}
