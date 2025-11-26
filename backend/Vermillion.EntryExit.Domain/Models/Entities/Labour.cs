using System.ComponentModel.DataAnnotations;

namespace Vermillion.EntryExit.Domain.Models.Entities;

public class Labour
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PhoneNumber { get; set; } = string.Empty;

    /// <summary>
    /// Encrypted Aadhar number for privacy
    /// </summary>
    [MaxLength(500)]
    public string? AadharNumberEncrypted { get; set; }

    /// <summary>
    /// Photo URL in Azure Blob Storage
    /// </summary>
    [Required]
    [MaxLength(500)]
    public string PhotoUrl { get; set; } = string.Empty;

    // Project assignment fields (merged from LabourRegistration)
    public int ProjectId { get; set; }

    public int ContractorId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Barcode { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    [MaxLength(100)]
    public string? RegisteredBy { get; set; }

    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual Project Project { get; set; } = null!;
    public virtual Contractor Contractor { get; set; } = null!;
    public virtual ICollection<EntryExitRecord> EntryExitRecords { get; set; } = new List<EntryExitRecord>();
}
