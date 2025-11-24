namespace Vermillion.Auth.Domain.Models.Entities;

/// <summary>
/// Junction table: Role has Permissions
/// Defines what a role can do
/// Example: Manager role has "attendance.view", "attendance.approve", "leave.approve" permissions
/// </summary>
public class RolePermission
{
    public int Id { get; set; }
    public int RoleId { get; set; }
    public int PermissionId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public Role Role { get; set; } = null!;
    public Permission Permission { get; set; } = null!;
}
