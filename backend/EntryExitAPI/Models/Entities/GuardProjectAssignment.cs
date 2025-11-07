using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EntryExitAPI.Models.Entities;

/// <summary>
/// Junction table for many-to-many relationship between Guards (from AuthAPI) and Projects
/// One project can have many guards, one guard can be assigned to multiple projects
/// </summary>
[Table("GuardProjectAssignments")]
public class GuardProjectAssignment
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// References User.Id from AuthAPI (the guard's authentication ID)
    /// </summary>
    [Required]
    public int AuthUserId { get; set; }

    /// <summary>
    /// References Project.Id from EntryExitAPI
    /// </summary>
    [Required]
    public int ProjectId { get; set; }

    /// <summary>
    /// Whether this assignment is currently active
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// When this assignment was created
    /// </summary>
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Who assigned this guard to the project
    /// </summary>
    [MaxLength(100)]
    public string? AssignedBy { get; set; }

    /// <summary>
    /// When this assignment was last updated
    /// </summary>
    public DateTime? UpdatedAt { get; set; }

    // Navigation property
    [ForeignKey(nameof(ProjectId))]
    public virtual Project? Project { get; set; }
}
