using System.Text.Json;

namespace EntryExitAPI.Models.DTOs;

// Sync DTOs
public class SyncBatchRequestDto
{
    public List<SyncOperationDto> Operations { get; set; } = new();
}

public class SyncOperationDto
{
    public string OperationType { get; set; } = string.Empty; // "LabourRegistration", "VisitorRegistration", "EntryExitRecord"
    public Guid ClientId { get; set; }
    public JsonElement Data { get; set; }
    
    // Helper method to deserialize Data to specific type
    public T? GetData<T>() where T : class
    {
        return Data.Deserialize<T>(new JsonSerializerOptions 
        { 
            PropertyNameCaseInsensitive = true 
        });
    }
}

public class SyncBatchResponseDto
{
    public List<SyncResultDto> Results { get; set; } = new();
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
}

public class SyncResultDto
{
    public Guid ClientId { get; set; }
    public bool Success { get; set; }
    public int? ServerId { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorCode { get; set; }
}

// API Response wrapper
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = new();
}
