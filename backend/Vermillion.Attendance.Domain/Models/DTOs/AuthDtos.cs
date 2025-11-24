namespace Vermillion.Attendance.Domain.Models.DTOs
{
    public record EmployeeDto
    (
        string Id,
        int UserId,
        string? EmployeeId,
        string? FirstName,
        string? LastName,
        string? DepartmentId,
        string? DepartmentName,
        DepartmentDto? Department,
        string? ManagerId,
        object? Manager,
        string? Email,
        bool IsActive,
        string? PhoneNumber
    );

    // Extended DTO that includes role information for admin user management
    public record EmployeeWithRoleDto
    (
        string Id,
        int UserId,
        string? EmployeeId,
        string? FirstName,
        string? LastName,
        string? DepartmentId,
        string? DepartmentName,
        DepartmentDto? Department,
        string? ManagerId,
        object? Manager,
        string? Email,
        bool IsActive,
        string? PhoneNumber,
        string? Role
    );

    public record DepartmentDto
    (
        string Id,
        string? Name,
        string? Description,
        List<string>? WeeklyOffDays,
        bool IsActive
    );
}
