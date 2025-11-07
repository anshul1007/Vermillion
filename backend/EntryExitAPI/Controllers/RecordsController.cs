using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EntryExitAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecordsController : ControllerBase
{
    private readonly IEntryExitRecordService _recordService;
    private readonly ILogger<RecordsController> _logger;

    public RecordsController(IEntryExitRecordService recordService, ILogger<RecordsController> logger)
    {
        _recordService = recordService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<EntryExitRecordDto>>> CreateRecord([FromBody] CreateEntryExitRecordDto dto)
    {
    var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
    var result = await _recordService.CreateRecordAsync(dto, userEmail);

        if (!result.Success)
        {
            if (result.Errors.Contains("OPEN_SESSION_EXISTS"))
                return Conflict(result);
            
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<EntryExitRecordDto>>>> GetRecords(
        [FromQuery] int? labourRegistrationId,
        [FromQuery] int? visitorId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var result = await _recordService.GetRecordsAsync(labourRegistrationId, visitorId, fromDate, toDate);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("open-sessions")]
    public async Task<ActionResult<ApiResponse<List<OpenSessionDto>>>> GetOpenSessions(
        [FromQuery] int? labourRegistrationId,
        [FromQuery] int? visitorId,
        [FromQuery] int? projectId)
    {
        var result = await _recordService.GetOpenSessionsAsync(labourRegistrationId, visitorId, projectId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("search")]
    public async Task<ActionResult<ApiResponse<SearchResultDto>>> Search([FromBody] SearchRequestDto request)
    {
        var result = await _recordService.SearchAsync(request);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
