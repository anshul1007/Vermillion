using EntryExitAPI.Data;
using EntryExitAPI.Models.DTOs;

namespace EntryExitAPI.Services;

public interface ISyncService
{
    Task<ApiResponse<SyncBatchResponseDto>> ProcessBatchAsync(SyncBatchRequestDto request, string syncedBy);
}

public class SyncService : ISyncService
{
    private readonly EntryExitDbContext _context;
    private readonly ILabourService _labourService;
    private readonly IVisitorService _visitorService;
    private readonly IEntryExitRecordService _recordService;
    private readonly ILogger<SyncService> _logger;

    public SyncService(
        EntryExitDbContext context,
        ILabourService labourService,
        IVisitorService visitorService,
        IEntryExitRecordService recordService,
        ILogger<SyncService> logger)
    {
        _context = context;
        _labourService = labourService;
        _visitorService = visitorService;
        _recordService = recordService;
        _logger = logger;
    }

    public async Task<ApiResponse<SyncBatchResponseDto>> ProcessBatchAsync(SyncBatchRequestDto request, string syncedBy)
    {
        var response = new SyncBatchResponseDto
        {
            Results = new List<SyncResultDto>()
        };

        try
        {
            foreach (var operation in request.Operations)
            {
                var result = await ProcessOperationAsync(operation, syncedBy);
                response.Results.Add(result);

                if (result.Success)
                    response.SuccessCount++;
                else
                    response.FailureCount++;
            }

            return new ApiResponse<SyncBatchResponseDto>
            {
                Success = true,
                Message = $"Processed {response.SuccessCount} successfully, {response.FailureCount} failed",
                Data = response
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing sync batch");
            return new ApiResponse<SyncBatchResponseDto>
            {
                Success = false,
                Message = "Error processing sync batch",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    private async Task<SyncResultDto> ProcessOperationAsync(SyncOperationDto operation, string syncedBy)
    {
        try
        {
            switch (operation.OperationType.ToLower())
            {
                case "labourregistration":
                    return await ProcessLabourRegistrationAsync(operation, syncedBy);

                case "visitorregistration":
                    return await ProcessVisitorRegistrationAsync(operation, syncedBy);

                case "entryexitrecord":
                    return await ProcessEntryExitRecordAsync(operation, syncedBy);

                default:
                    return new SyncResultDto
                    {
                        ClientId = operation.ClientId,
                        Success = false,
                        ErrorMessage = $"Unknown operation type: {operation.OperationType}",
                        ErrorCode = "UNKNOWN_OPERATION_TYPE"
                    };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing sync operation {OperationType} {ClientId}",
                operation.OperationType, operation.ClientId);

            return new SyncResultDto
            {
                ClientId = operation.ClientId,
                Success = false,
                ErrorMessage = ex.Message,
                ErrorCode = "PROCESSING_ERROR"
            };
        }
    }

    private async Task<SyncResultDto> ProcessLabourRegistrationAsync(SyncOperationDto operation, string syncedBy)
    {
        try
        {
            var dto = operation.GetData<CreateLabourRegistrationDto>();

            if (dto == null)
            {
                return new SyncResultDto
                {
                    ClientId = operation.ClientId,
                    Success = false,
                    ErrorMessage = "Invalid data format",
                    ErrorCode = "INVALID_FORMAT"
                };
            }

            var result = await _labourService.RegisterLabourAsync(dto, syncedBy);

            return new SyncResultDto
            {
                ClientId = operation.ClientId,
                Success = result.Success,
                ServerId = result.Data?.Id,
                ErrorMessage = result.Success ? null : result.Message,
                ErrorCode = result.Success ? null : result.Errors.FirstOrDefault()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing labour registration");
            return new SyncResultDto
            {
                ClientId = operation.ClientId,
                Success = false,
                ErrorMessage = ex.Message,
                ErrorCode = "SYNC_ERROR"
            };
        }
    }

    private async Task<SyncResultDto> ProcessVisitorRegistrationAsync(SyncOperationDto operation, string syncedBy)
    {
        try
        {
            var dto = operation.GetData<CreateVisitorDto>();

            if (dto == null)
            {
                return new SyncResultDto
                {
                    ClientId = operation.ClientId,
                    Success = false,
                    ErrorMessage = "Invalid data format",
                    ErrorCode = "INVALID_FORMAT"
                };
            }

            var result = await _visitorService.RegisterVisitorAsync(dto, syncedBy);

            return new SyncResultDto
            {
                ClientId = operation.ClientId,
                Success = result.Success,
                ServerId = result.Data?.Id,
                ErrorMessage = result.Success ? null : result.Message,
                ErrorCode = result.Success ? null : result.Errors.FirstOrDefault()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing visitor registration");
            return new SyncResultDto
            {
                ClientId = operation.ClientId,
                Success = false,
                ErrorMessage = ex.Message,
                ErrorCode = "SYNC_ERROR"
            };
        }
    }

    private async Task<SyncResultDto> ProcessEntryExitRecordAsync(SyncOperationDto operation, string syncedBy)
    {
        try
        {
            var dto = operation.GetData<CreateEntryExitRecordDto>();

            if (dto == null)
            {
                return new SyncResultDto
                {
                    ClientId = operation.ClientId,
                    Success = false,
                    ErrorMessage = "Invalid data format",
                    ErrorCode = "INVALID_FORMAT"
                };
            }

            // Set ClientId for de-duplication
            if (!dto.ClientId.HasValue)
                dto.ClientId = operation.ClientId;

            var result = await _recordService.CreateRecordAsync(dto, syncedBy);

            return new SyncResultDto
            {
                ClientId = operation.ClientId,
                Success = result.Success,
                ServerId = result.Data?.Id,
                ErrorMessage = result.Success ? null : result.Message,
                ErrorCode = result.Success ? null : result.Errors.FirstOrDefault()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing entry/exit record");
            return new SyncResultDto
            {
                ClientId = operation.ClientId,
                Success = false,
                ErrorMessage = ex.Message,
                ErrorCode = "SYNC_ERROR"
            };
        }
    }
}
