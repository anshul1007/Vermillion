using System.ComponentModel.DataAnnotations;

namespace Vermillion.EntryExit.Domain.Models.Entities;

public enum PersonType
{
    Labour = 1,
    Visitor = 2
}

public enum RecordAction
{
    Entry = 1,
    Exit = 2
}

public class EntryExitRecord
{
    public int Id { get; set; }

    public PersonType PersonType { get; set; }

    /// </summary>
    public int? LabourId { get; set; }

    /// <summary>
    /// FK to Visitor if PersonType is Visitor
    /// </summary>
    public int? VisitorId { get; set; }

    public RecordAction Action { get; set; }

    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;

    [MaxLength(100)]
    public string? Gate { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    [MaxLength(100)]
    public string? RecordedBy { get; set; }

    /// <summary>
    /// For offline sync: client-generated GUID to prevent duplicates
    /// </summary>
    public Guid? ClientId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public virtual Labour? Labour { get; set; }
    public virtual Visitor? Visitor { get; set; }
}
