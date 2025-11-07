using System.ComponentModel.DataAnnotations;

namespace EntryExitAPI.Models.Entities;

public class LabourRegistration
{
    public int Id { get; set; }

    public int LabourId { get; set; }

    public int ProjectId { get; set; }

    public int ContractorId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Barcode { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    [MaxLength(100)]
    public string? RegisteredBy { get; set; }

    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual Labour Labour { get; set; } = null!;
    public virtual Project Project { get; set; } = null!;
    public virtual Contractor Contractor { get; set; } = null!;
    public virtual ICollection<EntryExitRecord> EntryExitRecords { get; set; } = new List<EntryExitRecord>();
}
