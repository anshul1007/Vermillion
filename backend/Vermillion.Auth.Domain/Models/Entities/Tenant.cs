namespace Vermillion.Auth.Domain.Models.Entities;

public class Tenant
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Domain { get; set; } // e.g., "attendance", "entryexit"
    public string? ApiKey { get; set; } // Optional for app-to-app auth
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation - Users get access via UserRoles
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
