namespace AuthAPI.Models.Entities;

public class User
{
    public int Id { get; set; }
    
    // Core user information (globally unique)
    public required string Username { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    
    // OAuth/SSO fields for future Zoho integration
    public string? ExternalProvider { get; set; } // "Zoho", "Google", etc.
    public string? ExternalUserId { get; set; }
    
    // Navigation - Users can have multiple roles across multiple tenants
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
