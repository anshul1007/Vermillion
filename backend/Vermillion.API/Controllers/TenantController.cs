using System.Net.Mail;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Services;
using Vermillion.Shared.Domain.Models.DTOs;
using Vermillion.API.Extensions;

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
        var validationErrors = ValidateTenantRegistrationRequest(request);
        if (validationErrors.Count > 0)
            return BadRequest(ApiResponse<string>.ErrorResponse("Invalid tenant registration request", validationErrors));

        var (success, tenant, error) = await _tenantService.RegisterTenantAsync(request);

        if (!success)
        {
            var message = error ?? "Tenant registration failed";
            var errors = error is null ? null : new List<string> { error };
            return BadRequest(ApiResponse<string>.ErrorResponse(message, errors));
        }

        if (tenant == null)
            return this.ServerError("Tenant registration succeeded but tenant data was not returned");

        var dto = new TenantDto(tenant.Id, tenant.Name, tenant.Domain, tenant.IsActive);
        return Ok(ApiResponse<TenantDto>.SuccessResponse(dto, "Tenant registered successfully"));
    }

    [HttpGet]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetAllTenants()
    {
        var tenants = await _tenantService.GetAllTenantsAsync();
        var dtos = tenants.Select(t => new TenantDto(t.Id, t.Name, t.Domain, t.IsActive)).ToList();
        return Ok(ApiResponse<List<TenantDto>>.SuccessResponse(dtos));
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantById(int id)
    {
        var tenant = await _tenantService.GetTenantByIdAsync(id);

        if (tenant == null)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        var dto2 = new TenantDto(tenant.Id, tenant.Name, tenant.Domain, tenant.IsActive);
        return Ok(ApiResponse<TenantDto>.SuccessResponse(dto2));
    }

    [HttpGet("domain/{domain}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetTenantByDomain(string domain)
    {
        var tenant = await _tenantService.GetTenantByDomainAsync(domain);

        if (tenant == null)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        var dto3 = new TenantDto(tenant.Id, tenant.Name, tenant.Domain, tenant.IsActive);
        return Ok(ApiResponse<TenantDto>.SuccessResponse(dto3));
    }

    [HttpPut("{id}/activate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> ActivateTenant(int id)
    {
        var result = await _tenantService.ActivateTenantAsync(id);

        if (!result)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        return Ok(ApiResponse<EmptyResponseDto>.SuccessResponse(new EmptyResponseDto(), "Tenant activated"));
    }

    [HttpPut("{id}/deactivate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeactivateTenant(int id)
    {
        var result = await _tenantService.DeactivateTenantAsync(id);

        if (!result)
            return NotFound(ApiResponse<string>.ErrorResponse("Tenant not found"));

        return Ok(ApiResponse<EmptyResponseDto>.SuccessResponse(new EmptyResponseDto(), "Tenant deactivated"));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> UpdateTenant(int id, [FromBody] UpdateTenantRequest request)
    {
        var validationErrors = ValidateUpdateTenantRequest(request);
        if (validationErrors.Count > 0)
            return BadRequest(ApiResponse<string>.ErrorResponse("Invalid tenant update request", validationErrors));

        var (success, tenant, error) = await _tenantService.UpdateTenantAsync(id, request);

        if (!success)
        {
            var message = error ?? "Tenant update failed";
            var errors = error is null ? null : new List<string> { error };
            return BadRequest(ApiResponse<string>.ErrorResponse(message, errors));
        }

        if (tenant == null)
            return this.ServerError("Tenant update succeeded but tenant data was not returned");

        var dto4 = new TenantDto(tenant.Id, tenant.Name, tenant.Domain, tenant.IsActive);
        return Ok(ApiResponse<TenantDto>.SuccessResponse(dto4, "Tenant updated successfully"));
    }

    private static List<string> ValidateTenantRegistrationRequest(TenantRegistrationRequest? request)
    {
        var errors = new List<string>();

        if (request == null)
        {
            errors.Add("Request payload is required.");
            return errors;
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors.Add("Tenant name is required.");
        }
        else if (request.Name.Length < 3)
        {
            errors.Add("Tenant name must be at least 3 characters long.");
        }

        if (string.IsNullOrWhiteSpace(request.Domain))
        {
            errors.Add("Tenant domain is required.");
        }
        else if (!IsValidDomain(request.Domain))
        {
            errors.Add("Tenant domain contains invalid characters or format.");
        }

        if (string.IsNullOrWhiteSpace(request.AdminEmail))
        {
            errors.Add("Administrator email is required.");
        }
        else if (!IsValidEmail(request.AdminEmail))
        {
            errors.Add("Administrator email is not a valid email address.");
        }

        if (string.IsNullOrWhiteSpace(request.AdminPassword))
        {
            errors.Add("Administrator password is required.");
        }
        else if (request.AdminPassword.Length < 8)
        {
            errors.Add("Administrator password must be at least 8 characters long.");
        }

        return errors;
    }

    private static List<string> ValidateUpdateTenantRequest(UpdateTenantRequest? request)
    {
        var errors = new List<string>();

        if (request == null)
        {
            errors.Add("Request payload is required.");
            return errors;
        }

        var hasName = request.Name is not null;
        var hasDomain = request.Domain is not null;

        if (!hasName && !hasDomain)
        {
            errors.Add("At least one tenant attribute (name or domain) must be provided.");
        }

        if (hasName)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                errors.Add("Tenant name cannot be empty.");
            }
            else if (request.Name!.Length < 3)
            {
                errors.Add("Tenant name must be at least 3 characters long.");
            }
        }

        if (hasDomain)
        {
            if (string.IsNullOrWhiteSpace(request.Domain))
            {
                errors.Add("Tenant domain cannot be empty.");
            }
            else if (!IsValidDomain(request.Domain!))
            {
                errors.Add("Tenant domain contains invalid characters or format.");
            }
        }

        return errors;
    }

    private static bool IsValidDomain(string domain)
    {
        if (string.IsNullOrWhiteSpace(domain))
            return false;

        const string pattern = @"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$";
        return Regex.IsMatch(domain, pattern, RegexOptions.CultureInvariant);
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            _ = new MailAddress(email);
            return true;
        }
        catch
        {
            return false;
        }
    }
}

public record UpdateTenantRequest(string? Name = null, string? Domain = null);
