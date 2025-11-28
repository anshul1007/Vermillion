using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Vermillion.API.Extensions;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/entryexit/visitor")]
[Authorize]
public class VisitorController : ControllerBase
{
    private readonly IVisitorService _visitorService;
    private readonly ILogger<VisitorController> _logger;

    public VisitorController(IVisitorService visitorService, ILogger<VisitorController> logger)
    {
        _visitorService = visitorService;
        _logger = logger;
    }

    [HttpPost("register")]
    [Authorize(Roles = "Guard,Admin,SystemAdmin")]
    public async Task<ActionResult<ApiResponse<VisitorDto>>> RegisterVisitor([FromBody] CreateVisitorDto dto)
    {
        try
        {
            _logger.LogInformation("Received visitor registration request for: {Name}, Phone: {Phone}", dto.Name, dto.PhoneNumber);

            var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
            var result = await _visitorService.RegisterVisitorAsync(dto, userEmail);

            if (!result.Success)
            {
                _logger.LogWarning("Visitor registration failed: {Message}", result.Message);
                return BadRequest(result);
            }

            _logger.LogInformation("Visitor registered successfully with ID: {VisitorId}", result.Data?.Id);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in RegisterVisitor endpoint");
            return this.ServerError("An error occurred while registering visitor");
        }
    }

    [HttpGet("search")]
    [Authorize(Roles = "Guard,Admin,SystemAdmin")]
    public async Task<ActionResult<ApiResponse<List<VisitorDto>>>> SearchVisitor(
        [FromQuery] string? query,
        [FromQuery] string? name,
        [FromQuery] string? phone)
    {
        // If generic query is provided, search across name and phone
        if (!string.IsNullOrEmpty(query))
        {
            _logger.LogInformation("Searching visitor with query: {Query}", query);

            // Search by name first
            var nameResult = await _visitorService.SearchVisitorAsync(query, null);
            if (nameResult.Success && nameResult.Data != null && nameResult.Data.Any())
            {
                return Ok(nameResult);
            }

            // Then search by phone
            var phoneResult = await _visitorService.SearchVisitorAsync(null, query);
            if (phoneResult.Success && phoneResult.Data != null && phoneResult.Data.Any())
            {
                return Ok(phoneResult);
            }

            // Return empty result if nothing found
            return Ok(ApiResponse<List<VisitorDto>>.SuccessResponse(new List<VisitorDto>(), "No visitor found matching the query"));
        }

        // Use specific parameters if provided
        var result = await _visitorService.SearchVisitorAsync(name, phone);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Guard,Admin,SystemAdmin")]
    public async Task<ActionResult<ApiResponse<VisitorDto>>> GetVisitor(int id)
    {
        var result = await _visitorService.GetVisitorAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("by-project/{projectId}")]
    [Authorize(Roles = "Guard,Admin,SystemAdmin")]
    public async Task<ActionResult<ApiResponse<List<VisitorDto>>>> GetVisitorsByProject(int projectId)
    {
        var result = await _visitorService.GetVisitorsByProjectAsync(projectId);

        if (!result.Success)
        {
            _logger.LogWarning("Failed to fetch visitors for project {ProjectId}: {Message}", projectId, result.Message);
            return this.ServiceUnavailable<List<VisitorDto>>(result.Message ?? "Failed to fetch visitors for project", result.Errors);
        }

        return Ok(result);
    }
}
