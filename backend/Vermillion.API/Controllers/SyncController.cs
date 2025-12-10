using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vermillion.Shared.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Services;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/entryexit")]
[Authorize]
public class SyncController : ControllerBase
{
    private readonly ILogger<SyncController> _logger;
    private readonly ILabourService _labourService;
    private readonly IVisitorService _visitorService;
    private readonly IEntryExitRecordService _recordService;

    public SyncController(ILogger<SyncController> logger, ILabourService labourService, IVisitorService visitorService, IEntryExitRecordService recordService)
    {
        _logger = logger;
        _labourService = labourService;
        _visitorService = visitorService;
        _recordService = recordService;
    }

    public class SyncOperationDto
    {
        public int Id { get; set; }
        public string OperationType { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public object Data { get; set; } = new { };
        public string? ClientId { get; set; }
        public string Timestamp { get; set; } = string.Empty;
    }

    public class SyncBatchRequest
    {
        public List<SyncOperationDto> Operations { get; set; } = new List<SyncOperationDto>();
    }

    public class SyncOperationResult
    {
        public int Id { get; set; }
        public bool Success { get; set; }
        public string? Message { get; set; }
        public object? Data { get; set; }
        public string? ClientId { get; set; }
    }

    [HttpPost("sync-batch")]
    public async Task<ActionResult<ApiResponse<List<SyncOperationResult>>>> PostSyncBatch([FromBody] SyncBatchRequest req)
    {
        if (req?.Operations == null || req.Operations.Count == 0)
            return BadRequest(ApiResponse<string>.ErrorResponse("No operations provided"));

        var results = new List<SyncOperationResult>();
        var userEmail = User?.Identity?.Name ?? "System";

        foreach (var op in req.Operations)
        {
            var res = new SyncOperationResult { Id = op.Id, ClientId = op.ClientId };
            try
            {
                // Basic operation routing based on OperationType
                switch ((op.OperationType ?? string.Empty).ToLowerInvariant())
                {
                    case "registerlabour":
                    case "labour:create":
                        // Map incoming data to CreateLabourDto
                        var labDto = System.Text.Json.JsonSerializer.Deserialize<CreateLabourDto>(op.Data.ToString() ?? "{}");
                        if (labDto == null) throw new Exception("Invalid labour payload");
                        var labResult = await _labourService.RegisterLabourAsync(labDto, userEmail);
                        res.Success = labResult.Success;
                        res.Message = labResult.Message;
                        res.Data = labResult.Data;
                        break;
                    case "registervisitor":
                    case "visitor:create":
                        var visDto = System.Text.Json.JsonSerializer.Deserialize<CreateVisitorDto>(op.Data.ToString() ?? "{}");
                        if (visDto == null) throw new Exception("Invalid visitor payload");
                        var visResult = await _visitorService.RegisterVisitorAsync(visDto, userEmail);
                        res.Success = visResult.Success;
                        res.Message = visResult.Message;
                        res.Data = visResult.Data;
                        break;
                    case "createrecord":
                    case "record:create":
                    case "logentry":
                    case "logexit":
                        var recDto = System.Text.Json.JsonSerializer.Deserialize<CreateEntryExitRecordDto>(op.Data.ToString() ?? "{}");
                        if (recDto == null) throw new Exception("Invalid record payload");
                        var recResult = await _recordService.CreateRecordAsync(recDto, userEmail);
                        res.Success = recResult.Success;
                        res.Message = recResult.Message;
                        res.Data = recResult.Data;
                        break;
                    default:
                        res.Success = false;
                        res.Message = "Unknown operation type";
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing sync operation {OpId}", op.Id);
                res.Success = false;
                res.Message = ex.Message;
            }

            results.Add(res);
        }

        return Ok(ApiResponse<List<SyncOperationResult>>.SuccessResponse(results, $"Processed {results.Count} operations"));
    }
}
