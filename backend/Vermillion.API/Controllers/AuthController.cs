using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.API.Extensions;
using Vermillion.Auth.Domain.Services;
using Vermillion.Auth.Domain.Data;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ITenantService _tenantService;
    private readonly AuthDbContext _context;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ITenantService tenantService, AuthDbContext context, ILogger<AuthController> logger)
    {
        _authService = authService;
        _tenantService = tenantService;
        _context = context;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (success, response, error) = await _authService.LoginAsync(request);
        
        if (!success)
            return Unauthorized(ApiResponse<string>.ErrorResponse(error ?? "Invalid credentials"));

        if (response == null)
        {
            _logger.LogError("Login succeeded but response was null. Email={Email}, Tenant={Tenant}", request.Email, request.TenantDomain ?? "(none)");
            return this.ServerError("Login succeeded but response was null");
        }

        return Ok(ApiResponse<LoginResponse>.SuccessResponse(response, "Login successful"));
    }

    [HttpPost("login/phone")]
    [AllowAnonymous]
    public async Task<IActionResult> LoginByPhone([FromBody] LoginRequest request)
    {
        // Accepts the same LoginRequest DTO but intended for phone+pin flows
        var (success, response, error) = await _authService.LoginAsync(request);

        if (!success)
            return Unauthorized(ApiResponse<string>.ErrorResponse(error ?? "Invalid phone or pin"));

        if (response == null)
        {
            _logger.LogError("Phone login succeeded but response was null. Phone={Phone}", request.Phone ?? "(none)");
            return this.ServerError("Login succeeded but response was null");
        }

        return Ok(ApiResponse<LoginResponse>.SuccessResponse(response, "Login successful"));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var (success, response, error) = await _authService.RefreshTokenAsync(request);
        
        if (!success)
            return Unauthorized(ApiResponse<string>.ErrorResponse(error ?? "Could not refresh token"));

        if (response == null)
        {
            _logger.LogError("Refresh token succeeded but response was null");
            return this.ServerError("Refresh token succeeded but response was null");
        }

        return Ok(ApiResponse<LoginResponse>.SuccessResponse(response, "Token refreshed"));
    }

    [HttpPost("revoke")]
    [AllowAnonymous]
    public async Task<IActionResult> RevokeToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RevokeRefreshTokenAsync(request.RefreshToken);
        
        if (!result)
            return NotFound(ApiResponse<string>.ErrorResponse("Token not found"));

        return Ok(ApiResponse<EmptyResponseDto>.SuccessResponse(new EmptyResponseDto(), "Token revoked"));
    }

    // Tenant Management Endpoints
    [HttpPost("tenant/register")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> RegisterTenant([FromBody] TenantRegistrationRequest request)
    {
        var (success, tenant, error) = await _tenantService.RegisterTenantAsync(request);

        if (!success)
            return BadRequest(ApiResponse<string>.ErrorResponse(error ?? "Tenant registration failed"));

        if (tenant == null)
        {
            _logger.LogError("Tenant registration succeeded but tenant was null. AdminEmail={AdminEmail}, Domain={Domain}", request.AdminEmail, request.Domain);
            return this.ServerError("Tenant registration succeeded but tenant was null");
        }

        var tenantDto = new TenantDto(
            tenant.Id,
            tenant.Name,
            tenant.Domain,
            tenant.IsActive
        );

        return Ok(ApiResponse<TenantDto>.SuccessResponse(tenantDto, "Tenant registered successfully"));
    }

    [HttpGet("tenant")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetAllTenants()
    {
        var tenants = await _tenantService.GetAllTenantsAsync();
            var tenantDtos = tenants.Select(t => new TenantDto(t.Id, t.Name, t.Domain, t.IsActive)).ToList();
        return Ok(new ApiResponse<List<TenantDto>> { Success = true, Data = tenantDtos, Message = null });
    }

    [HttpGet("tenant/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantById(int id)
    {
        var tenant = await _tenantService.GetTenantByIdAsync(id);

        if (tenant == null)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        var tenantDto = new TenantDto(tenant.Id, tenant.Name, tenant.Domain, tenant.IsActive);
        return Ok(ApiResponse<TenantDto>.SuccessResponse(tenantDto));
    }

    [HttpGet("tenant/domain/{domain}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantByDomain(string domain)
    {
        var tenant = await _tenantService.GetTenantByDomainAsync(domain);

        if (tenant == null)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        var tenantDto2 = new TenantDto(tenant.Id, tenant.Name, tenant.Domain, tenant.IsActive);
        return Ok(ApiResponse<TenantDto>.SuccessResponse(tenantDto2));
    }

    [HttpPut("tenant/{id}/activate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> ActivateTenant(int id)
    {
        var result = await _tenantService.ActivateTenantAsync(id);

        if (!result)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        return Ok(ApiResponse<EmptyResponseDto>.SuccessResponse(new EmptyResponseDto(), "Tenant activated"));
    }

    [HttpPut("tenant/{id}/deactivate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeactivateTenant(int id)
    {
        var result = await _tenantService.DeactivateTenantAsync(id);

        if (!result)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        return Ok(ApiResponse<EmptyResponseDto>.SuccessResponse(new EmptyResponseDto(), "Tenant deactivated"));
    }
}
