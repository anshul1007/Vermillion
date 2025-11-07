namespace AuthAPI.Models.Entities;

/// <summary>
/// Represents a role in the system (e.g., Admin, Manager, Employee, Guard)
/// Roles can be assigned to users on a per-tenant basis
/// </summary>
public class Role
{
    public int Id { get; set; }
    public required string Name { get; set; } // "Admin", "Manager", "Employee", "Guard", etc.
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
