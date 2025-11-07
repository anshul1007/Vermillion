using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EntryExitAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
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
    public async Task<ActionResult<ApiResponse<VisitorDto>>> RegisterVisitor([FromBody] CreateVisitorDto dto)
    {
    var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
    var result = await _visitorService.RegisterVisitorAsync(dto, userEmail);

        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetVisitor), new { id = result.Data?.Id }, result);
    }

    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<VisitorDto>>>> SearchVisitor(
        [FromQuery] string? name,
        [FromQuery] string? phone)
    {
        var result = await _visitorService.SearchVisitorAsync(name, phone);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<VisitorDto>>> GetVisitor(int id)
    {
        var result = await _visitorService.GetVisitorAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
