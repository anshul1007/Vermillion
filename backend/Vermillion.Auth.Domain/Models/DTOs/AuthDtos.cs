namespace Vermillion.Auth.Domain.Models.DTOs;

// TenantDomain is optional now - if not provided, returns all tenants
public record LoginRequest(string Email, string Password, string? TenantDomain = null);

public record LoginResponse(string AccessToken, string RefreshToken, UserInfoDto User);

public record RefreshTokenRequest(string RefreshToken);

public record RegisterUserRequest(
    string TenantDomain,
    string Username,
    string Email,
    string Password,
    string Role = "User",
    string? EmployeeId = null,
    string? FirstName = null,
    string? LastName = null,
    string? PhoneNumber = null,
    string? DepartmentId = null,
    string? ManagerId = null
);

public record MultiTenantRegisterRequest(
    string Username,
    string Email,
    string Password,
    List<TenantAccessRequest> Tenants // User can be registered to multiple tenants at once
);

public record TenantAccessRequest(
    string TenantDomain,
    string Role
);

public record UserInfoDto(
    int Id,
    string Username,
    string Email,
    List<UserTenantDto> Tenants, // All tenants and roles for this user
    string? ExternalProvider
);

public record UserTenantDto(
    int TenantId,
    string TenantName,
    string Domain,
    string RoleName, // Role name for this tenant
    List<string> Permissions // List of permission names (e.g., "attendance.view", "leave.approve")
);

public record TenantRegistrationRequest(
    string Name,
    string Domain,
    string AdminEmail,
    string AdminPassword
);

public record ApiResponse<T>(bool Success, T? Data, string? Message);
