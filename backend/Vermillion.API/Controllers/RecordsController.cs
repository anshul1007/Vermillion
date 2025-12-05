using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Vermillion.EntryExit.Domain.Services;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/entryexit/records")]
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
            if (result.Errors?.Contains("OPEN_SESSION_EXISTS") == true)
                return Conflict(result);

            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<EntryExitRecordDto>>>> GetRecords(
        [FromQuery] int? labourRegistrationId,
        [FromQuery] int? visitorId,
        [FromQuery] int? projectId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate)
    {
        var result = await _recordService.GetRecordsAsync(labourRegistrationId, visitorId, projectId, fromDate, toDate);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("today")]
    public async Task<ActionResult<ApiResponse<List<EntryExitRecordDto>>>> GetTodayRecords([FromQuery] int? projectId)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        _logger.LogInformation("Fetching today's records from {FromDate} to {ToDate}", today, tomorrow);

        var result = await _recordService.GetRecordsAsync(null, null, projectId, today, tomorrow);

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

    [HttpGet("search-person")]
    public async Task<ActionResult<ApiResponse<List<PersonSearchResultDto>>>> SearchPerson([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(ApiResponse<string>.ErrorResponse("Search query is required"));

        _logger.LogInformation("Searching for person with query: {Query}", query);

        // Get both visitor and labour matches and return combined results
        var visitorService = HttpContext.RequestServices.GetRequiredService<IVisitorService>();
        var labourService = HttpContext.RequestServices.GetRequiredService<ILabourService>();

        _logger.LogInformation("Searching visitors for query: {Query}", query);
        var visitorResult = await visitorService.SearchVisitorAsync(query, query);
        _logger.LogInformation("Visitor search result: success={Success} count={Count}", visitorResult?.Success, visitorResult?.Data?.Count ?? 0);

        _logger.LogInformation("Searching labour for query: {Query}", query);
        var labourResult = await labourService.SearchLabourByQueryAsync(query, null);
        _logger.LogInformation("Labour search result: success={Success} count={Count}", labourResult?.Success, labourResult?.Data?.Count ?? 0);

        var combined = new List<PersonSearchResultDto>();

        var labourList = labourResult?.Success == true && labourResult.Data != null
            ? labourResult.Data.Take(50).ToList()
            : new List<LabourDto>();

        var visitorList = visitorResult?.Success == true && visitorResult.Data != null
            ? visitorResult.Data.Take(50).ToList()
            : new List<VisitorDto>();

        var labourOpenSessionsTask = labourList.Count > 0
            ? _recordService.HasOpenSessionsForLaboursAsync(labourList.Select(l => l.Id).ToArray())
            : Task.FromResult(new Dictionary<int, bool>());

        var visitorOpenSessionsTask = visitorList.Count > 0
            ? _recordService.HasOpenSessionsForVisitorsAsync(visitorList.Select(v => v.Id).ToArray())
            : Task.FromResult(new Dictionary<int, bool>());

        await Task.WhenAll(labourOpenSessionsTask, visitorOpenSessionsTask);

        var labourOpenSessions = await labourOpenSessionsTask;
        var visitorOpenSessions = await visitorOpenSessionsTask;

        foreach (var labour in labourList)
        {
            var hasOpenEntry = labourOpenSessions.TryGetValue(labour.Id, out var open) && open;

            combined.Add(new PersonSearchResultDto
            {
                Id = labour.Id,
                Name = labour.Name,
                PhoneNumber = labour.PhoneNumber,
                PersonType = "Labour",
                Barcode = labour.Barcode,
                ProjectId = labour.ProjectId,
                ProjectName = labour.ProjectName,
                ContractorId = labour.ContractorId,
                ContractorName = labour.ContractorName,
                PhotoUrl = string.IsNullOrEmpty(labour.PhotoUrl) ? string.Empty : (labour.PhotoUrl.StartsWith("/api/entryexit/photos/") ? labour.PhotoUrl : $"/api/entryexit/photos/{labour.PhotoUrl}"),
                HasOpenEntry = hasOpenEntry
            });
        }

        foreach (var visitor in visitorList)
        {
            var hasOpenEntry = visitorOpenSessions.TryGetValue(visitor.Id, out var open) && open;

            combined.Add(new PersonSearchResultDto
            {
                Id = visitor.Id,
                Name = visitor.Name,
                PhoneNumber = visitor.PhoneNumber,
                PersonType = "Visitor",
                CompanyName = visitor.CompanyName,
                Purpose = visitor.Purpose,
                PhotoUrl = string.IsNullOrEmpty(visitor.PhotoUrl) ? string.Empty : (visitor.PhotoUrl.StartsWith("/api/entryexit/photos/") ? visitor.PhotoUrl : $"/api/entryexit/photos/{visitor.PhotoUrl}"),
                HasOpenEntry = hasOpenEntry
            });
        }

        return Ok(ApiResponse<List<PersonSearchResultDto>>.SuccessResponse(combined, $"Found {combined.Count} person(s)"));
    }

    [HttpGet("search-by-contractor")]
    public async Task<ActionResult<ApiResponse<List<PersonSearchResultDto>>>> SearchByContractor([FromQuery] string contractorName)
    {
        if (string.IsNullOrWhiteSpace(contractorName))
            return BadRequest(ApiResponse<string>.ErrorResponse("Contractor name is required"));

        _logger.LogInformation("Searching labour by contractor: {ContractorName}", contractorName);

        var labourService = HttpContext.RequestServices.GetRequiredService<ILabourService>();

        var labourResult = await labourService.SearchLabourByContractorNameAsync(contractorName);

        if (labourResult?.Success != true || labourResult.Data == null || labourResult.Data.Count == 0)
        {
            return Ok(ApiResponse<List<PersonSearchResultDto>>.SuccessResponse(new List<PersonSearchResultDto>(), "No labour found for this contractor"));
        }

        var contractorLabourList = labourResult.Data.Take(100).ToList();
        var openSessions = contractorLabourList.Count > 0
            ? await _recordService.HasOpenSessionsForLaboursAsync(contractorLabourList.Select(l => l.Id).ToArray())
            : new Dictionary<int, bool>();

        var result = contractorLabourList.Select(labour => new PersonSearchResultDto
        {
            Id = labour.Id,
            Name = labour.Name,
            PhoneNumber = labour.PhoneNumber,
            PersonType = "Labour",
            Barcode = labour.Barcode,
            ProjectId = labour.ProjectId,
            ProjectName = labour.ProjectName,
            ContractorId = labour.ContractorId,
            ContractorName = labour.ContractorName,
            PhotoUrl = string.IsNullOrEmpty(labour.PhotoUrl) ? string.Empty : (labour.PhotoUrl.StartsWith("/api/entryexit/photos/") ? labour.PhotoUrl : $"/api/entryexit/photos/{labour.PhotoUrl}"),
            HasOpenEntry = openSessions.TryGetValue(labour.Id, out var hasOpen) && hasOpen
        }).ToList();

        return Ok(ApiResponse<List<PersonSearchResultDto>>.SuccessResponse(result, $"Found {result.Count} labour from contractor"));
    }

    [HttpPost("bulk-checkin")]
    public async Task<ActionResult<ApiResponse<BulkCheckInResultDto>>> BulkCheckIn([FromBody] BulkCheckInDto dto)
    {
        if (dto.LabourIds == null || !dto.LabourIds.Any())
            return BadRequest(ApiResponse<string>.ErrorResponse("At least one labour ID is required"));

        var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
        var results = new List<BulkCheckInItemResultDto>();
        var successCount = 0;
        var failureCount = 0;

        _logger.LogInformation("Processing bulk check-in for {Count} labour records", dto.LabourIds.Count);

        foreach (var labourId in dto.LabourIds)
        {
            var recordDto = new CreateEntryExitRecordDto
            {
                PersonType = PersonType.Labour,
                LabourId = labourId,
                Action = dto.Action,
                Gate = dto.Gate,
                Notes = dto.Notes
            };

            var result = await _recordService.CreateRecordAsync(recordDto, userEmail);

            if (result.Success)
            {
                successCount++;
                results.Add(new BulkCheckInItemResultDto { LabourId = labourId, Success = true, Message = "Recorded successfully" });
            }
            else
            {
                failureCount++;
                results.Add(new BulkCheckInItemResultDto { LabourId = labourId, Success = false, Message = result.Message ?? "Failed to record", Errors = result.Errors });
            }
        }

        var response = new BulkCheckInResultDto
        {
            TotalProcessed = dto.LabourIds.Count,
            SuccessCount = successCount,
            FailureCount = failureCount,
            Results = results
        };

        return Ok(ApiResponse<BulkCheckInResultDto>.SuccessResponse(response, $"Processed {successCount} successful, {failureCount} failed"));
    }
}
