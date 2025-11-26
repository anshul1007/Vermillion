using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Services;
using Vermillion.Auth.Domain.Data;
using Vermillion.EntryExit.Domain.Models.DTOs;

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

        var t = tenant!;

        var tenantDto = new TenantDto(
            t.Id,
            t.Name,
            t.Domain,
            t.IsActive
        );

        return Ok(new AuthApiResponse<TenantDto> { Success = true, Data = tenantDto, Message = "Tenant registered successfully" });
    }

    [HttpGet("tenant")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetAllTenants()
    {
        var tenants = await _tenantService.GetAllTenantsAsync();
            var tenantDtos = tenants.Select(t => new TenantDto(t.Id, t.Name, t.Domain, t.IsActive)).ToList();
        return Ok(new AuthApiResponse<List<TenantDto>> { Success = true, Data = tenantDtos, Message = null });
    }

    [HttpGet("tenant/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantById(int id)
    {
        var tenant = await _tenantService.GetTenantByIdAsync(id);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        var t2 = tenant!;

        var tenantDto = new TenantDto(t2.Id, t2.Name, t2.Domain, t2.IsActive);
        return Ok(new AuthApiResponse<TenantDto> { Success = true, Data = tenantDto, Message = null });
    }

    [HttpGet("tenant/domain/{domain}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantByDomain(string domain)
    {
        var tenant = await _tenantService.GetTenantByDomainAsync(domain);

        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        var t3 = tenant!;

        var tenantDto2 = new TenantDto(t3.Id, t3.Name, t3.Domain, t3.IsActive);
        return Ok(new AuthApiResponse<TenantDto> { Success = true, Data = tenantDto2, Message = null });
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
