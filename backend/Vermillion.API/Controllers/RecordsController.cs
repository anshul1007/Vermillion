using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Vermillion.EntryExit.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

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
    public async Task<ActionResult<AuthApiResponse<EntryExitRecordDto>>> CreateRecord([FromBody] CreateEntryExitRecordDto dto)
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
    public async Task<ActionResult<AuthApiResponse<List<EntryExitRecordDto>>>> GetRecords(
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

    [HttpGet("today")]
    public async Task<ActionResult<AuthApiResponse<List<EntryExitRecordDto>>>> GetTodayRecords()
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        _logger.LogInformation("Fetching today's records from {FromDate} to {ToDate}", today, tomorrow);

        var result = await _recordService.GetRecordsAsync(null, null, today, tomorrow);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("open-sessions")]
    public async Task<ActionResult<AuthApiResponse<List<OpenSessionDto>>>> GetOpenSessions(
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
    public async Task<ActionResult<AuthApiResponse<SearchResultDto>>> Search([FromBody] SearchRequestDto request)
    {
        var result = await _recordService.SearchAsync(request);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpGet("search-person")]
    public async Task<ActionResult<AuthApiResponse<object>>> SearchPerson([FromQuery] string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(new AuthApiResponse<object>
            {
                Success = false,
                Message = "Search query is required"
            });

        _logger.LogInformation("Searching for person with query: {Query}", query);

        // Get both visitor and labour matches and return combined results
        var visitorService = HttpContext.RequestServices.GetRequiredService<IVisitorService>();
        var labourService = HttpContext.RequestServices.GetRequiredService<ILabourService>();

        _logger.LogInformation("Searching visitors for query: {Query}", query);
        var visitorResult = await visitorService.SearchVisitorAsync(query, query);
        _logger.LogInformation("Visitor search result: success={Success} count={Count}", visitorResult?.Success, visitorResult?.Data?.Count ?? 0);

        _logger.LogInformation("Searching labour for query: {Query}", query);

        // Perform targeted searches and merge results to avoid AND-ing barcode/name/phone filters
        var labourByBarcode = await labourService.SearchLabourAsync(query, null, null, null);
        var labourByName = await labourService.SearchLabourAsync(null, query, null, null);
        var labourByPhone = await labourService.SearchLabourAsync(null, null, query, null);

        _logger.LogInformation("Labour search results: barcode={BCount} name={NCount} phone={PCount}",
            labourByBarcode?.Data?.Count ?? 0,
            labourByName?.Data?.Count ?? 0,
            labourByPhone?.Data?.Count ?? 0);

        var combined = new List<object>();

        // Merge labour results by Id to avoid duplicates
        var labourDict = new Dictionary<int, LabourDto>();

        void AddLabourList(AuthApiResponse<List<LabourDto>>? resp)
        {
            if (resp?.Success != true || resp.Data == null) return;
            foreach (var l in resp.Data)
            {
                if (!labourDict.ContainsKey(l.Id))
                    labourDict[l.Id] = l;
            }
        }

        AddLabourList(labourByBarcode);
        AddLabourList(labourByName);
        AddLabourList(labourByPhone);

        foreach (var labour in labourDict.Values.Take(50))
        {
            var openSessions = await _recordService.GetOpenSessionsAsync(labour.Id, null, null);
            var hasOpenEntry = openSessions.Success && openSessions.Data != null && openSessions.Data.Any();

            combined.Add(new
            {
                id = labour.Id,
                name = labour.Name,
                phoneNumber = labour.PhoneNumber,
                personType = "Labour",
                barcode = labour.Barcode,
                projectId = labour.ProjectId,
                contractorId = labour.ContractorId,
                photoUrl = labour.PhotoUrl,
                hasOpenEntry
            });
        }

        if (visitorResult?.Success == true && visitorResult.Data != null && visitorResult.Data.Any())
        {
            foreach (var visitor in visitorResult.Data.Take(50))
            {
                var openSessions = await _recordService.GetOpenSessionsAsync(null, visitor.Id, null);
                var hasOpenEntry = openSessions.Success && openSessions.Data != null && openSessions.Data.Any();

                combined.Add(new
                {
                    id = visitor.Id,
                    name = visitor.Name,
                    phoneNumber = visitor.PhoneNumber,
                    personType = "Visitor",
                    companyName = visitor.CompanyName,
                    purpose = visitor.Purpose,
                    photoUrl = visitor.PhotoUrl,
                    hasOpenEntry
                });
            }
        }

        return Ok(new AuthApiResponse<object>
        {
            Success = true,
            Data = combined,
            Message = $"Found {combined.Count} person(s)"
        });
    }

    [HttpGet("search-by-contractor")]
    public async Task<ActionResult<AuthApiResponse<object>>> SearchByContractor([FromQuery] string contractorName)
    {
        if (string.IsNullOrWhiteSpace(contractorName))
            return BadRequest(new AuthApiResponse<object>
            {
                Success = false,
                Message = "Contractor name is required"
            });

        _logger.LogInformation("Searching labour by contractor: {ContractorName}", contractorName);

        var labourService = HttpContext.RequestServices.GetRequiredService<ILabourService>();

        // Search labour by contractor name
        var labourResult = await labourService.SearchLabourAsync(null, null, null, null);
        
        if (labourResult?.Success != true || labourResult.Data == null)
        {
            return Ok(new AuthApiResponse<object>
            {
                Success = true,
                Data = new List<object>(),
                Message = "No labour found for this contractor"
            });
        }

        // Filter by contractor name (case-insensitive partial match)
        var filteredLabour = labourResult.Data
            .Where(l => l.ContractorName.Contains(contractorName, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var result = new List<object>();
        foreach (var labour in filteredLabour)
        {
            var openSessions = await _recordService.GetOpenSessionsAsync(labour.Id, null, null);
            var hasOpenEntry = openSessions.Success && openSessions.Data != null && openSessions.Data.Any();

            result.Add(new
            {
                id = labour.Id,
                name = labour.Name,
                phoneNumber = labour.PhoneNumber,
                personType = "Labour",
                barcode = labour.Barcode,
                projectId = labour.ProjectId,
                projectName = labour.ProjectName,
                contractorId = labour.ContractorId,
                contractorName = labour.ContractorName,
                photoUrl = labour.PhotoUrl,
                hasOpenEntry
            });
        }

        return Ok(new AuthApiResponse<object>
        {
            Success = true,
            Data = result,
            Message = $"Found {result.Count} labour from contractor"
        });
    }

    [HttpPost("bulk-checkin")]
    public async Task<ActionResult<AuthApiResponse<object>>> BulkCheckIn([FromBody] BulkCheckInDto dto)
    {
        if (dto.LabourIds == null || !dto.LabourIds.Any())
            return BadRequest(new AuthApiResponse<object>
            {
                Success = false,
                Message = "At least one labour ID is required"
            });

        var userEmail = User.FindFirst(ClaimTypes.Name)?.Value ?? "System";
        var results = new List<object>();
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
                results.Add(new { labourId, success = true, message = "Recorded successfully" });
            }
            else
            {
                failureCount++;
                results.Add(new { labourId, success = false, message = result.Message, errors = result.Errors });
            }
        }

        return Ok(new AuthApiResponse<object>
        {
            Success = true,
            Data = new
            {
                totalProcessed = dto.LabourIds.Count,
                successCount,
                failureCount,
                results
            },
            Message = $"Processed {successCount} successful, {failureCount} failed"
        });
    }
}
