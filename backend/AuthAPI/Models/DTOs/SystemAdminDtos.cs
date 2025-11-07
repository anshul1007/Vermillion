namespace AuthAPI.Models.DTOs;

// User Management DTOs
public record UpdateUserRequest(
    string? Username = null,
    string? Email = null,
    string? Password = null,
    string? FirstName = null,
    string? LastName = null,
    string? PhoneNumber = null,
    int? Role = null,
    string? ManagerId = null,
    string? DepartmentId = null,
    bool? IsActive = null
);

// Role Management DTOs
public record CreateRoleRequest(
    string Name,
    string? Description = null
);

public record UpdateRoleRequest(
    string? Name = null,
    string? Description = null
);

// Permission Management DTOs
public record CreatePermissionRequest(
    string Name,
    string Resource,
    string Action,
    string? Description = null
);

public record UpdatePermissionRequest(
    string? Name = null,
    string? Resource = null,
    string? Action = null,
    string? Description = null
);

// Tenant Management DTOs
public record UpdateTenantRequest(
    string? Name = null,
    string? Domain = null,
    bool? IsActive = null
);
