namespace Vermillion.EntryExit.Domain.Models.DTOs;

/// <summary>
/// Response DTO for person search results (visitors and labour)
/// </summary>
public class PersonSearchResultDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string PersonType { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public int? ContractorId { get; set; }
    public string? ContractorName { get; set; }
    public string? CompanyName { get; set; }
    public string? Purpose { get; set; }
    public string? PhotoUrl { get; set; }
    public bool HasOpenEntry { get; set; }
}

/// <summary>
/// Response DTO for bulk check-in operation
/// </summary>
public class BulkCheckInResultDto
{
    public int TotalProcessed { get; set; }
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
    public List<BulkCheckInItemResultDto> Results { get; set; } = new();
}

public class BulkCheckInItemResultDto
{
    public int LabourId { get; set; }
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public List<string>? Errors { get; set; }
}
