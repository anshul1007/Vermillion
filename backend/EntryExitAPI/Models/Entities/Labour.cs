using System.ComponentModel.DataAnnotations;

namespace EntryExitAPI.Models.Entities;

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
    /// Path or URL to stored photo (stored in encrypted blob storage)
    /// </summary>
    [MaxLength(1000)]
    public string? PhotoUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual ICollection<LabourRegistration> Registrations { get; set; } = new List<LabourRegistration>();
}
