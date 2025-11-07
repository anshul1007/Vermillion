using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EntryExitAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LabourController : ControllerBase
{
    private readonly ILabourService _labourService;
    private readonly ILogger<LabourController> _logger;

    public LabourController(ILabourService labourService, ILogger<LabourController> logger)
    {
        _labourService = labourService;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<ActionResult<ApiResponse<LabourRegistrationDto>>> RegisterLabour([FromBody] CreateLabourRegistrationDto dto)
    {
        var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
        var result = await _labourService.RegisterLabourAsync(dto, userEmail);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<LabourRegistrationDto>>>> SearchLabour(
        [FromQuery] string? barcode,
        [FromQuery] string? name,
        [FromQuery] string? phone,
        [FromQuery] int? projectId)
    {
        var result = await _labourService.SearchLabourAsync(barcode, name, phone, projectId);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<LabourRegistrationDto>>> GetLabourRegistration(int id)
    {
        var result = await _labourService.GetLabourRegistrationAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
