using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuthAPI.Data;
using AuthAPI.Models.DTOs;

namespace AuthAPI.Controllers;

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
            return NotFound(new ApiResponse<string>(false, null, $"User with email {email} not found"));
        }

        return Ok(new ApiResponse<int>(true, user.Id, null));
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
            return NotFound(new ApiResponse<string>(false, null, $"No role found for user {userId} in {tenantDomain} tenant"));
        }

        return Ok(new { role = userRole.Role.Name });
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
            return NotFound(new ApiResponse<string>(false, null, $"User {userId} not found"));
        }

        return Ok(new ApiResponse<object>(true, user, null));
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
            return NotFound(new ApiResponse<string>(false, null, $"User {userId} not found"));
        }

        return Ok(new ApiResponse<string>(true, user.Email, null));
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
            return NotFound(new ApiResponse<string>(false, null, $"User {userId} not found"));
        }

        return Ok(new ApiResponse<bool>(true, user.IsActive, null));
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
            return NotFound(new ApiResponse<string>(false, null, $"Role {roleId} not found"));
        }

        return Ok(new ApiResponse<object>(true, role, null));
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
            return NotFound(new ApiResponse<string>(false, null, $"Employee record not found for user {userId}"));
        }

        return Ok(new ApiResponse<object>(true, employee, null));
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

        return Ok(new ApiResponse<object>(true, employees, null));
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

        return Ok(new ApiResponse<object>(true, departments, null));
    }
}
