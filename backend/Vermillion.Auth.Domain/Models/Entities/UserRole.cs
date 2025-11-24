namespace Vermillion.Auth.Domain.Models.Entities;

/// <summary>
/// Junction table: User has Role in a specific Tenant
/// Enables: User can be Admin in Attendance, but Employee in Entry/Exit
/// </summary>
public class UserRole
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int RoleId { get; set; }
    public int TenantId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; } // Optional: temporary role assignment
    
    // Navigation properties
    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
    public Tenant Tenant { get; set; } = null!;
}
