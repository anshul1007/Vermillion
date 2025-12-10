namespace Vermillion.Auth.Domain.Models.DTOs;

public class RoleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class UserRoleDto
{
    public string Role { get; set; } = string.Empty;
}

public class UserRoleResponse
{
    public string Role { get; set; } = string.Empty;
}

public class UserProfileDto
{
    public bool IsActive { get; set; }
}

public class UserProfileResponse
{
    public bool IsActive { get; set; }
}

public class UserDepartmentDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? WeeklyOffDays { get; set; }
    public bool IsActive { get; set; }
}

public class UserDepartmentInfoDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class UserDepartmentDetailDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> WeeklyOffDays { get; set; } = new();
    public bool IsActive { get; set; }
}

public class UserManagerInfoDto
{
    public Guid Id { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
}

public class UserEmployeeDto
{
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PhoneNumber { get; set; }
    public Guid? DepartmentId { get; set; }
    public UserDepartmentInfoDto? Department { get; set; }
    public Guid? ManagerId { get; set; }
    public UserManagerInfoDto? Manager { get; set; }
}

public class UserEmployeeListDto
{
    public Guid Id { get; set; }
    public int UserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? PhoneNumber { get; set; }
    public Guid? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public UserDepartmentDetailDto? Department { get; set; }
    public Guid? ManagerId { get; set; }
    public UserManagerInfoDto? Manager { get; set; }
}
