using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

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
    public async Task<ActionResult<AuthApiResponse<LabourDto>>> RegisterLabour([FromBody] CreateLabourDto dto)
    {
        var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
        var result = await _labourService.RegisterLabourAsync(dto, userEmail);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("search")]
    public async Task<ActionResult<AuthApiResponse<List<LabourDto>>>> SearchLabour(
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

            // Search by barcode first (most specific)
            var barcodeResult = await _labourService.SearchLabourAsync(query, null, null, projectId);
            if (barcodeResult.Success && barcodeResult.Data != null && barcodeResult.Data.Any())
            {
                return Ok(barcodeResult);
            }

            // Then search by name
            var nameResult = await _labourService.SearchLabourAsync(null, query, null, projectId);
            if (nameResult.Success && nameResult.Data != null && nameResult.Data.Any())
            {
                return Ok(nameResult);
            }

            // Finally search by phone
            var phoneResult = await _labourService.SearchLabourAsync(null, null, query, projectId);
            if (phoneResult.Success && phoneResult.Data != null && phoneResult.Data.Any())
            {
                return Ok(phoneResult);
            }

            // Return empty result if nothing found
            return Ok(new AuthApiResponse<List<LabourDto>>
            {
                Success = true,
                Data = new List<LabourDto>(),
                Message = "No labour found matching the query"
            });
        }

        // Use specific parameters if provided
        var result = await _labourService.SearchLabourAsync(barcode, name, phone, projectId);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AuthApiResponse<LabourDto>>> GetLabourRegistration(int id)
    {
        var result = await _labourService.GetLabourAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("by-project/{projectId}")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<List<LabourDto>>>> GetLabourByProject(int projectId)
    {
        _logger.LogInformation("Getting labour for project: {ProjectId}", projectId);
        var result = await _labourService.GetLabourByProjectAsync(projectId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("by-contractor/{contractorId}")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<List<LabourDto>>>> GetLabourByContractor(int contractorId)
    {
        _logger.LogInformation("Getting labour for contractor: {ContractorId}", contractorId);
        var result = await _labourService.GetLabourByContractorAsync(contractorId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
