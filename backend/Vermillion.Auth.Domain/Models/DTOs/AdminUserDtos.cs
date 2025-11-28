namespace Vermillion.Auth.Domain.Models.DTOs;

public class AdminUserTenantAssignmentDto
{
    public int TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantDomain { get; set; } = string.Empty;
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = new();
    public bool IsActive { get; set; }
}

public class AdminUserSummaryDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? ExternalProvider { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<AdminUserTenantAssignmentDto> Tenants { get; set; } = new();
}

public class UserSummaryDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class PermissionDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Resource { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class PermissionDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Resource { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class RoleWithPermissionsDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int PermissionCount { get; set; }
    public List<PermissionDetailDto> Permissions { get; set; } = new();
}

public class RoleSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
