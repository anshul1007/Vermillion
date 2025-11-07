using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EntryExitAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SyncController : ControllerBase
{
    private readonly ISyncService _syncService;
    private readonly ILogger<SyncController> _logger;

    public SyncController(ISyncService syncService, ILogger<SyncController> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<SyncBatchResponseDto>>> ProcessBatch([FromBody] SyncBatchRequestDto request)
    {
        var userEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "System";
        var result = await _syncService.ProcessBatchAsync(request, userEmail);
        var username = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
