using Vermillion.Auth.Domain.Models.Entities;

namespace Vermillion.Auth.Domain.Services;

/// <summary>
/// Service for accessing user data across domains without HTTP overhead.
/// Provides direct database access with caching for optimal performance.
/// </summary>
public interface IUserService
{
    /// <summary>
    /// Gets a user by their ID including related Employee data
    /// </summary>
    Task<User?> GetUserByIdAsync(int userId);

    /// <summary>
    /// Gets the effective role for a user in a specific tenant domain
    /// </summary>
    /// <param name="userId">The user ID</param>
    /// <param name="tenantDomain">The tenant domain (e.g., "attendance", "entryexit")</param>
    /// <returns>The role name or null if not found</returns>
    Task<string?> GetUserRoleAsync(int userId, string tenantDomain);

    /// <summary>
    /// Gets role information by role ID
    /// </summary>
    Task<(int Id, string? Name, bool IsActive)?> GetRoleByIdAsync(int roleId);

    /// <summary>
    /// Gets the email address for a user
    /// </summary>
    Task<string?> GetEmailByAuthUserIdAsync(int authUserId);

    /// <summary>
    /// Gets user's full name and active status
    /// </summary>
    Task<(string? FirstName, string? LastName, bool? IsActive)?> GetNameByAuthUserIdAsync(int authUserId);

    /// <summary>
    /// Gets user's active status
    /// </summary>
    Task<bool?> GetUserIsActiveAsync(int authUserId);

    /// <summary>
    /// Gets user ID by email address
    /// </summary>
    Task<int?> GetUserIdByEmailAsync(string email);

    /// <summary>
    /// Gets all employees with their user and department information
    /// Excludes Guards role for attendance system
    /// </summary>
    /// <param name="excludeGuards">Whether to exclude users with Guard role (default: true)</param>
    Task<List<Employee>> GetAllEmployeesAsync(bool excludeGuards = true);

    /// <summary>
    /// Gets all departments
    /// </summary>
    Task<List<Department>> GetAllDepartmentsAsync();

    /// <summary>
    /// Gets a department by ID
    /// </summary>
    Task<Department?> GetDepartmentByIdAsync(Guid departmentId);

    /// <summary>
    /// Creates a new department
    /// </summary>
    Task<Department> CreateDepartmentAsync(Department department);

    /// <summary>
    /// Updates an existing department
    /// </summary>
    Task<Department?> UpdateDepartmentAsync(Guid departmentId, Department department);

    /// <summary>
    /// Deletes a department
    /// </summary>
    Task<bool> DeleteDepartmentAsync(Guid departmentId);

    /// <summary>
    /// Updates user information
    /// </summary>
    Task<bool> UpdateUserAsync(int userId, string? email, string? firstName, string? lastName,
        string? phoneNumber, int? roleId, Guid? managerId, Guid? departmentId, bool? isActive);

    /// <summary>
    /// Creates a new user with employee record
    /// </summary>
    Task<(bool Success, string Message, int? UserId)> CreateUserAsync(
        string username, string email, string passwordHash, string tenantDomain,
        string roleName, string employeeId, string? firstName, string? lastName,
        string? phoneNumber, Guid? departmentId, Guid? managerId);

    /// <summary>
    /// Gets employees by manager ID (for team management)
    /// </summary>
    Task<List<Employee>> GetEmployeesByManagerIdAsync(Guid managerId);
}
