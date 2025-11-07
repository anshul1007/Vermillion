using System.ComponentModel.DataAnnotations;

namespace EntryExitAPI.Models.Entities;

public class Visitor
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PhoneNumber { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? CompanyName { get; set; }

    [MaxLength(500)]
    public string? Purpose { get; set; }

    /// <summary>
    /// Path or URL to stored photo (stored in encrypted blob storage)
    /// </summary>
    [Required]
    [MaxLength(1000)]
    public string PhotoUrl { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? RegisteredBy { get; set; }

    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual ICollection<EntryExitRecord> EntryExitRecords { get; set; } = new List<EntryExitRecord>();
}
