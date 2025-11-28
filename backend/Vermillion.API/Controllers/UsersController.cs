using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vermillion.Auth.Domain.Data;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AuthDbContext _context;
    private readonly ILogger<UsersController> _logger;

    public UsersController(AuthDbContext context, ILogger<UsersController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get user ID by email address
    /// </summary>
    [HttpGet("by-email/{email}")]
    public async Task<IActionResult> GetUserIdByEmail(string email)
    {
        var user = await _context.Users
            .Where(u => u.Email == email)
            .Select(u => new { u.Id })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound(ApiResponse<string>.ErrorResponse($"User with email {email} not found"));
        }

        return Ok(ApiResponse<int>.SuccessResponse(user.Id));
    }

    /// <summary>
    /// Get user's effective role for a specific tenant
    /// </summary>
    [HttpGet("{userId}/effective-role")]
    public async Task<IActionResult> GetUserEffectiveRole(int userId, [FromQuery] string? tenantDomain = "attendance")
    {
        var userRole = await _context.UserRoles
            .Include(ur => ur.Role)
            .Include(ur => ur.Tenant)
            .Where(ur => ur.UserId == userId && ur.Tenant.Domain == tenantDomain)
            .FirstOrDefaultAsync();

        if (userRole == null)
        {
            return NotFound(ApiResponse<string>.ErrorResponse($"No role found for user {userId} in {tenantDomain} tenant"));
        }

        return Ok(ApiResponse<UserRoleResponse>.SuccessResponse(new UserRoleResponse { Role = userRole.Role.Name }));
    }

    /// <summary>
    /// Get user's first name, last name, and active status
    /// </summary>
    [HttpGet("{userId}/profile")]
    public async Task<IActionResult> GetUserProfile(int userId)
    {
        var user = await _context.Users
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                u.IsActive
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound(ApiResponse<string>.ErrorResponse($"User {userId} not found"));
        }

        return Ok(ApiResponse<UserProfileResponse>.SuccessResponse(new UserProfileResponse { IsActive = user.IsActive }));
    }

    /// <summary>
    /// Get user's email address
    /// </summary>
    [HttpGet("{userId}/email")]
    public async Task<IActionResult> GetUserEmail(int userId)
    {
        var user = await _context.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.Email })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound(ApiResponse<string>.ErrorResponse($"User {userId} not found"));
        }

        return Ok(ApiResponse<string>.SuccessResponse(user.Email));
    }

    /// <summary>
    /// Get user's active status
    /// </summary>
    [HttpGet("{userId}/is-active")]
    public async Task<IActionResult> GetUserIsActive(int userId)
    {
        var user = await _context.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.IsActive })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound(ApiResponse<string>.ErrorResponse($"User {userId} not found"));
        }

        return Ok(ApiResponse<bool>.SuccessResponse(user.IsActive));
    }

    /// <summary>
    /// Get role by ID
    /// </summary>
    [HttpGet("roles/{roleId}")]
    public async Task<IActionResult> GetRoleById(int roleId)
    {
        var role = await _context.Roles
            .Where(r => r.Id == roleId)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.IsActive
            })
            .FirstOrDefaultAsync();

        if (role == null)
        {
            return NotFound(ApiResponse<string>.ErrorResponse($"Role {roleId} not found"));
        }

        return Ok(ApiResponse<RoleDto>.SuccessResponse(new RoleDto { Id = role.Id, Name = role.Name, IsActive = role.IsActive }));
    }

    /// <summary>
    /// Get employee by user ID
    /// </summary>
    [HttpGet("{userId}/employee")]
    public async Task<IActionResult> GetEmployeeByUserId(int userId)
    {
        var employee = await _context.Employees
            .Include(e => e.Department)
            .Include(e => e.Manager)
            .Where(e => e.UserId == userId)
            .Select(e => new
            {
                e.Id,
                e.UserId,
                e.EmployeeId,
                e.FirstName,
                e.LastName,
                e.DepartmentId,
                Department = e.Department != null ? new { e.Department.Id, e.Department.Name } : null,
                e.ManagerId,
                Manager = e.Manager != null ? new { e.Manager.Id, e.Manager.EmployeeId, e.Manager.FirstName, e.Manager.LastName } : null
            })
            .FirstOrDefaultAsync();

        if (employee == null)
        {
            return NotFound(ApiResponse<string>.ErrorResponse($"Employee record not found for user {userId}"));
        }

        return Ok(ApiResponse<UserEmployeeDto>.SuccessResponse(new UserEmployeeDto
        {
            Id = employee.Id,
            UserId = employee.UserId,
            EmployeeId = employee.EmployeeId,
            FirstName = employee.FirstName,
            LastName = employee.LastName,
            DepartmentId = employee.DepartmentId,
            Department = employee.Department != null ? new UserDepartmentInfoDto { Id = employee.Department.Id, Name = employee.Department.Name } : null,
            ManagerId = employee.ManagerId,
            Manager = employee.Manager != null ? new UserManagerInfoDto { Id = employee.Manager.Id, EmployeeId = employee.Manager.EmployeeId, FirstName = employee.Manager.FirstName, LastName = employee.Manager.LastName } : null
        }));
    }

    /// <summary>
    /// Get all employees
    /// </summary>
    [HttpGet("employees")]
    public async Task<IActionResult> GetAllEmployees()
    {
        var employees = await _context.Employees
            .Include(e => e.User)
            .Include(e => e.Department)
            .Include(e => e.Manager)
            .Select(e => new
            {
                e.Id,
                e.UserId,
                e.EmployeeId,
                e.FirstName,
                e.LastName,
                e.User.Email,  // Email at top level instead of nested
                e.User.IsActive,  // User's active status
                e.PhoneNumber,  // Phone number (all roles)
                e.DepartmentId,
                DepartmentName = e.Department != null ? e.Department.Name : null,  // Flat department name for UI
                Department = e.Department != null ? new
                {
                    Id = e.Department.Id.ToString(),
                    e.Department.Name,
                    e.Department.Description,
                    WeeklyOffDays = !string.IsNullOrEmpty(e.Department.WeeklyOffDays) 
                        ? e.Department.WeeklyOffDays.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList() 
                        : new List<string>(),
                    e.Department.IsActive
                } : null,
                e.ManagerId,
                Manager = e.Manager != null ? new
                {
                    Id = e.Manager.Id.ToString(),
                    e.Manager.EmployeeId,
                    e.Manager.FirstName,
                    e.Manager.LastName
                } : null
            })
            .ToListAsync();

        var employeeDtos = employees.Select(e => new UserEmployeeListDto
        {
            Id = e.Id,
            UserId = e.UserId,
            EmployeeId = e.EmployeeId,
            FirstName = e.FirstName,
            LastName = e.LastName,
            Email = e.Email,
            IsActive = e.IsActive,
            PhoneNumber = e.PhoneNumber,
            DepartmentId = e.DepartmentId,
            DepartmentName = e.DepartmentName,
            Department = e.Department != null ? new UserDepartmentDetailDto 
            { 
                Id = e.Department.Id, 
                Name = e.Department.Name, 
                Description = e.Department.Description, 
                WeeklyOffDays = e.Department.WeeklyOffDays, 
                IsActive = e.Department.IsActive 
            } : null,
            ManagerId = e.ManagerId,
            Manager = e.Manager != null ? new UserManagerInfoDto { Id = Guid.Parse(e.Manager.Id), EmployeeId = e.Manager.EmployeeId, FirstName = e.Manager.FirstName, LastName = e.Manager.LastName } : null
        }).ToList();

        return Ok(ApiResponse<List<UserEmployeeListDto>>.SuccessResponse(employeeDtos));
    }

    /// <summary>
    /// Get all departments
    /// </summary>
    [HttpGet("departments")]
    public async Task<IActionResult> GetAllDepartments()
    {
        var departments = await _context.Departments
            .Where(d => d.IsActive)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Description,
                d.WeeklyOffDays,
                d.IsActive
            })
            .ToListAsync();

        var departmentDtos = departments.Select(d => new UserDepartmentDto
        {
            Id = d.Id,
            Name = d.Name
        }).ToList();

        return Ok(ApiResponse<List<UserDepartmentDto>>.SuccessResponse(departmentDtos));
    }
}
