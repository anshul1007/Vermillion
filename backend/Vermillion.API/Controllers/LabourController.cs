using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/entryexit/labour")]
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
    public async Task<ActionResult<ApiResponse<LabourDto>>> RegisterLabour([FromBody] CreateLabourDto dto)
    {
        var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
        var result = await _labourService.RegisterLabourAsync(dto, userEmail);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<LabourDto>>>> SearchLabour(
        [FromQuery] string? query,
        [FromQuery] string? barcode,
        [FromQuery] string? name,
        [FromQuery] string? phone,
        [FromQuery] int? projectId)
    {
        // If generic query is provided, search across barcode, name, and phone
        if (!string.IsNullOrEmpty(query))
        {
            _logger.LogInformation("Searching labour with query: {Query}", query);
            var queryResult = await _labourService.SearchLabourByQueryAsync(query, projectId);
            if (!queryResult.Success)
            {
                return BadRequest(queryResult);
            }

            if (queryResult.Data == null || !queryResult.Data.Any())
            {
                return Ok(ApiResponse<List<LabourDto>>.SuccessResponse(new List<LabourDto>(), "No labour found matching the query"));
            }

            return Ok(queryResult);
        }

        // Use specific parameters if provided
        var result = await _labourService.SearchLabourAsync(barcode, name, phone, projectId);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<LabourDto>>> GetLabourRegistration(int id)
    {
        var result = await _labourService.GetLabourAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("by-project/{projectId}")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<List<LabourDto>>>> GetLabourByProject(int projectId)
    {
        _logger.LogInformation("Getting labour for project: {ProjectId}", projectId);
        var result = await _labourService.GetLabourByProjectAsync(projectId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("by-contractor/{contractorId}")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<List<LabourDto>>>> GetLabourByContractor(int contractorId)
    {
        _logger.LogInformation("Getting labour for contractor: {ContractorId}", contractorId);
        var result = await _labourService.GetLabourByContractorAsync(contractorId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("by-project/{projectId}/contractor/{contractorId}")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<List<LabourDto>>>> GetLabourByProjectAndContractor(int projectId, int contractorId)
    {
        _logger.LogInformation("Getting labour for project {ProjectId} and contractor {ContractorId}", projectId, contractorId);
        var result = await _labourService.GetLabourByProjectAndContractorAsync(projectId, contractorId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
