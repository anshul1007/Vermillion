using EntryExitAPI.Models.Entities;

namespace EntryExitAPI.Models.DTOs;

// Entry/Exit Record DTOs
public class EntryExitRecordDto
{
    public int Id { get; set; }
    public PersonType PersonType { get; set; }
    public int? LabourRegistrationId { get; set; }
    public int? VisitorId { get; set; }
    public RecordAction Action { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public string? Gate { get; set; }
    public string? Notes { get; set; }
    public string? RecordedBy { get; set; }
    
    // Additional info for display
    public string? PersonName { get; set; }
    public string? PhotoUrl { get; set; }
    public string? ContractorName { get; set; }
    public string? ProjectName { get; set; }
    public string? GuardName { get; set; }  // Guard who recorded the entry/exit
}

public class CreateEntryExitRecordDto
{
    public PersonType PersonType { get; set; }
    public int? LabourRegistrationId { get; set; }
    public int? VisitorId { get; set; }
    public RecordAction Action { get; set; }
    public DateTimeOffset? Timestamp { get; set; } // Optional, server can override
    public string? Gate { get; set; }
    public string? Notes { get; set; }
    public Guid? ClientId { get; set; } // For offline sync de-duplication
}

// Search DTOs
public class SearchRequestDto
{
    public string? Barcode { get; set; }
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public int? ProjectId { get; set; }
}

public class SearchResultDto
{
    public string ResultType { get; set; } = string.Empty; // "Labour" or "Visitor"
    public LabourRegistrationDto? LabourRegistration { get; set; }
    public VisitorDto? Visitor { get; set; }
    public bool HasOpenEntry { get; set; }
    public EntryExitRecordDto? LastEntry { get; set; }
}

// Open Session DTOs
public class OpenSessionDto
{
    public int EntryRecordId { get; set; }
    public PersonType PersonType { get; set; }
    public string PersonName { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public DateTimeOffset EntryTime { get; set; }
    public string? Gate { get; set; }
    public int? LabourRegistrationId { get; set; }
    public int? VisitorId { get; set; }
    public string? GuardName { get; set; }  // Guard who recorded the entry
}
