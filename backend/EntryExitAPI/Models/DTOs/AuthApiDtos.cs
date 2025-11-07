namespace EntryExitAPI.Models.DTOs;

// DTOs for AuthAPI responses
public class AuthApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
    public List<string>? Errors { get; set; }
}

public class EmployeeDto
{
    public int UserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; }
    public string? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
}

public class EffectiveRoleDto
{
    public string RoleName { get; set; } = string.Empty;
    public string TenantDomain { get; set; } = string.Empty;
}

public class GuardListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string EmployeeId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; }
    public string Role { get; set; } = string.Empty;
}

public class CreateGuardDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string EmployeeId { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
}

public class UpdateGuardDto
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PhoneNumber { get; set; }
    public bool? IsActive { get; set; }
}
