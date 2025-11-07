namespace AuthAPI.Models.Entities;

/// <summary>
/// Represents a permission in the system for fine-grained access control
/// Examples: "attendance.view", "attendance.approve", "leave.create", "labour.register"
/// </summary>
public class Permission
{
    public int Id { get; set; }
    public required string Name { get; set; } // "attendance.view", "leave.approve", etc.
    public required string Resource { get; set; } // "attendance", "leave", "labour", etc.
    public required string Action { get; set; } // "view", "create", "update", "delete", "approve"
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
