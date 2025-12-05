using System.ComponentModel.DataAnnotations;

namespace Vermillion.EntryExit.Domain.Models.Entities;

public class LabourClassification
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<Labour>? Labours { get; set; }
}
