using System;
using System.Linq;
using System.Text.Json;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuthAPI.Data;
using AuthAPI.Models.DTOs;
using AuthAPI.Models.Entities;
using AuthAPI.Services;

namespace AuthAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Manager,Admin,SystemAdmin")]
public class AdminController : ControllerBase
{
    private readonly AuthDbContext _context;
    private readonly IAuthService _authService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(AuthDbContext context, IAuthService authService, ILogger<AdminController> logger)
    {
        _context = context;
        _authService = authService;
        _logger = logger;
    }

    #region Departments Management

    // Request DTO - accepts weeklyOffDays as string ("0,6") or array ["Sunday","Saturday"]
    public class DepartmentRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        // Accept either comma-separated numbers or an array of strings
        public object? WeeklyOffDays { get; set; }
        public bool? IsActive { get; set; }
    }

    private string NormalizeWeeklyOffDays(object? value)
    {
        if (value == null) return string.Empty;

        // If it's already a string, return as-is
        if (value is string s)
            return s;

        // If it's an array (JsonElement from body), try to parse
        try
        {
            var json = JsonSerializer.Serialize(value);
            var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                var parts = new List<string>();
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    if (el.ValueKind == JsonValueKind.Number)
                        parts.Add(el.GetInt32().ToString());
                    else if (el.ValueKind == JsonValueKind.String)
                        parts.Add(el.GetString() ?? string.Empty);
                    else
                        parts.Add(el.ToString());
                }
                return string.Join(',', parts.Where(p => !string.IsNullOrWhiteSpace(p)));
            }
        }
        catch { }

        return value.ToString() ?? string.Empty;
    }

    [HttpPost("departments")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> CreateDepartment([FromBody] DepartmentRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new ApiResponse<object>(false, null, "Name is required"));

        var dept = new Department
        {
            Name = req.Name.Trim(),
            Description = req.Description,
            WeeklyOffDays = NormalizeWeeklyOffDays(req.WeeklyOffDays),
            IsActive = req.IsActive ?? true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Departments.Add(dept);
        await _context.SaveChangesAsync();

        var dto = new DepartmentDto(
            dept.Id.ToString(),
            dept.Name,
            dept.Description,
            string.IsNullOrEmpty(dept.WeeklyOffDays) ? new List<string>() : dept.WeeklyOffDays.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToList(),
            dept.IsActive
        );

        return Ok(new ApiResponse<DepartmentDto>(true, dto, "Department created"));
    }

    [HttpPut("departments/{id}")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> UpdateDepartment(Guid id, [FromBody] DepartmentRequest req)
    {
        var dept = await _context.Departments.FindAsync(id);
        if (dept == null)
            return NotFound(new ApiResponse<object>(false, null, "Department not found"));

        if (!string.IsNullOrWhiteSpace(req.Name)) dept.Name = req.Name.Trim();
        if (req.Description != null) dept.Description = req.Description;
        if (req.WeeklyOffDays != null) dept.WeeklyOffDays = NormalizeWeeklyOffDays(req.WeeklyOffDays);
        if (req.IsActive.HasValue) dept.IsActive = req.IsActive.Value;
        dept.UpdatedAt = DateTime.UtcNow;

        _context.Departments.Update(dept);
        await _context.SaveChangesAsync();

        var dto = new DepartmentDto(
            dept.Id.ToString(),
            dept.Name,
            dept.Description,
            string.IsNullOrEmpty(dept.WeeklyOffDays) ? new List<string>() : dept.WeeklyOffDays.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToList(),
            dept.IsActive
        );

        return Ok(new ApiResponse<DepartmentDto>(true, dto, "Department updated"));
    }

    [HttpDelete("departments/{id}")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> DeleteDepartment(Guid id)
    {
        var dept = await _context.Departments.FindAsync(id);
        if (dept == null)
            return NotFound(new ApiResponse<object>(false, null, "Department not found"));

        // Instead of hard delete, mark inactive and optionally unassign employees
        dept.IsActive = false;
        dept.UpdatedAt = DateTime.UtcNow;
        _context.Departments.Update(dept);

        // Unassign employees from this department
        var employees = await _context.Employees.Where(e => e.DepartmentId == dept.Id).ToListAsync();
        foreach (var e in employees)
        {
            e.DepartmentId = null;
            _context.Employees.Update(e);
        }

        await _context.SaveChangesAsync();

    return Ok(new ApiResponse<string>(true, null, "Department deactivated and employees unassigned"));
    }

    #endregion

    #region Users Management

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers([FromQuery] int? tenantId = null)
    {
        var query = _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Tenant)
            .AsQueryable();

        var users = await query.ToListAsync();

        var result = users.Select(u => new
        {
            u.Id,
            u.Username,
            u.Email,
            u.ExternalProvider,
            u.CreatedAt,
            Tenants = u.UserRoles
                .Where(ur => !tenantId.HasValue || ur.TenantId == tenantId.Value)
                .Select(ur => new
                {
                    ur.TenantId,
                    TenantName = ur.Tenant.Name,
                    TenantDomain = ur.Tenant.Domain,
                    ur.RoleId,
                    RoleName = ur.Role.Name,
                    ur.IsActive
                })
                .ToList()
        });

        return Ok(new ApiResponse<object>(true, result, null));
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Tenant)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
            return NotFound(new ApiResponse<string>(false, null, "User not found"));

        var result = new
        {
            user.Id,
            user.Username,
            user.Email,
            user.ExternalProvider,
            user.CreatedAt,
            Tenants = user.UserRoles.Select(ur => new
            {
                ur.TenantId,
                TenantName = ur.Tenant.Name,
                TenantDomain = ur.Tenant.Domain,
                ur.RoleId,
                RoleName = ur.Role.Name,
                ur.IsActive,
                Permissions = ur.Role.RolePermissions
                    .Where(rp => rp.Permission.IsActive)
                    .Select(rp => rp.Permission.Name)
                    .ToList()
            }).ToList()
        };

        return Ok(new ApiResponse<object>(true, result, null));
    }

    [HttpPost("users")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> CreateUser([FromBody] RegisterUserRequest request)
    {
        // Only SystemAdmin callers can create users with the systemadmin role
        if (!string.IsNullOrEmpty(request.Role) && request.Role.Equals("systemadmin", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("SystemAdmin"))
        {
            return Forbid();
        }
        var (success, user, error) = await _authService.RegisterUserAsync(request);

        if (!success)
            return BadRequest(new ApiResponse<string>(false, null, error));

        // Get user's tenant info after registration with role and permissions
        var userRole = await _context.UserRoles
            .Include(ur => ur.Tenant)
            .Include(ur => ur.Role)
                .ThenInclude(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(ur => ur.UserId == user!.Id);

        var tenants = userRole != null
            ? new List<UserTenantDto>
            {
                new UserTenantDto(
                    userRole.TenantId,
                    userRole.Tenant.Name,
                    userRole.Tenant.Domain,
                    userRole.Role.Name,
                    userRole.Role.RolePermissions
                        .Where(rp => rp.Permission.IsActive)
                        .Select(rp => rp.Permission.Name)
                        .ToList()
                )
            }
            : new List<UserTenantDto>();

        var userInfo = new UserInfoDto(
            user!.Id,
            user.Username,
            user.Email,
            tenants,
            user.ExternalProvider
        );

        return Ok(new ApiResponse<UserInfoDto>(true, userInfo, "User registered successfully"));
    }

    [HttpPut("users/{id}")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new ApiResponse<string>(false, null, "User not found"));

        // Update User fields
        if (!string.IsNullOrEmpty(request.Username))
        {
            if (await _context.Users.AnyAsync(u => u.Username == request.Username && u.Id != id))
                return BadRequest(new ApiResponse<string>(false, null, "Username already in use"));

            user.Username = request.Username;
        }

        if (!string.IsNullOrEmpty(request.Email))
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email && u.Id != id))
                return BadRequest(new ApiResponse<string>(false, null, "Email already in use"));
            user.Email = request.Email;
        }

        if (!string.IsNullOrEmpty(request.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        // Update Employee fields if employee exists
        var employee = await _context.Employees.FirstOrDefaultAsync(e => e.UserId == id);
        if (employee != null)
        {
            if (!string.IsNullOrEmpty(request.FirstName))
                employee.FirstName = request.FirstName;

            if (!string.IsNullOrEmpty(request.LastName))
                employee.LastName = request.LastName;

            if (!string.IsNullOrEmpty(request.PhoneNumber))
                employee.PhoneNumber = request.PhoneNumber;

            if (!string.IsNullOrEmpty(request.DepartmentId) && Guid.TryParse(request.DepartmentId, out var deptGuid))
                employee.DepartmentId = deptGuid;

            if (!string.IsNullOrEmpty(request.ManagerId) && Guid.TryParse(request.ManagerId, out var mgrGuid))
                employee.ManagerId = mgrGuid;
            else if (request.ManagerId == "") // Empty string means remove manager
                employee.ManagerId = null;
        }

        // Update Role if specified
        if (request.Role.HasValue)
        {
            var roleName = request.Role.Value switch
            {
                0 => "Employee",
                1 => "Manager",
                2 => "Admin",
                3 => "Guard",
                4 => "SystemAdmin",
                _ => null
            };

            if (!string.IsNullOrEmpty(roleName))
            {
                var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
                if (role != null)
                {
                    // Find attendance tenant
                    var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Domain == "attendance");
                    if (tenant != null)
                    {
                        // Remove existing user role for this tenant
                        var existingUserRole = await _context.UserRoles
                            .FirstOrDefaultAsync(ur => ur.UserId == id && ur.TenantId == tenant.Id);

                        if (existingUserRole != null)
                            _context.UserRoles.Remove(existingUserRole);

                        // Add new role
                        var userRole = new UserRole
                        {
                            UserId = id,
                            RoleId = role.Id,
                            TenantId = tenant.Id,
                            IsActive = true
                        };
                        _context.UserRoles.Add(userRole);
                    }
                }
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<string>(true, null, "User updated successfully"));
    }

    [HttpDelete("users/{id}")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new ApiResponse<string>(false, null, "User not found"));

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<string>(true, null, "User deleted successfully"));
    }

    #endregion

    #region User-Role-Tenant Management

    [HttpPost("users/{userId}/tenants/{tenantId}/roles/{roleId}")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> AssignUserToTenantRole(int userId, int tenantId, int roleId)
    {
        // Validate entities exist
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return NotFound(new ApiResponse<string>(false, null, "User not found"));

        var tenant = await _context.Tenants.FindAsync(tenantId);
        if (tenant == null)
            return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

        var role = await _context.Roles.FindAsync(roleId);
        if (role == null)
            return NotFound(new ApiResponse<string>(false, null, "Role not found"));

        // Allow assigning the 'systemadmin' role only if the caller is a SystemAdmin
        if (role.Name.Equals("systemadmin", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("SystemAdmin"))
        {
            return Forbid();
        }

        // Check if mapping already exists
        var existing = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.TenantId == tenantId && ur.RoleId == roleId);

        if (existing != null)
            return BadRequest(new ApiResponse<string>(false, null, "User already has this role in this tenant"));

        var userRole = new UserRole
        {
            UserId = userId,
            TenantId = tenantId,
            RoleId = roleId,
            IsActive = true
        };

        _context.UserRoles.Add(userRole);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "User assigned to tenant role successfully"));
    }

    [HttpDelete("users/{userId}/tenants/{tenantId}/roles/{roleId}")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> RemoveUserFromTenantRole(int userId, int tenantId, int roleId)
    {
        var userRole = await _context.UserRoles
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.TenantId == tenantId && ur.RoleId == roleId);

        if (userRole == null)
            return NotFound(new ApiResponse<string>(false, null, "User role mapping not found"));

        // If this mapping is for the systemadmin role, only SystemAdmin callers can remove it
        var roleToRemove = await _context.Roles.FindAsync(userRole.RoleId);
        if (roleToRemove != null && roleToRemove.Name.Equals("systemadmin", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("SystemAdmin"))
        {
            return Forbid();
        }

        _context.UserRoles.Remove(userRole);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "User removed from tenant role successfully"));
    }

    [HttpPut("user-roles/{id}/activate")]
    [Authorize(Roles = "Admin,SystemAdmin")]
    public async Task<IActionResult> ActivateUserRole(int id)
    {
        var userRole = await _context.UserRoles.FindAsync(id);
        if (userRole == null)
            return NotFound(new ApiResponse<string>(false, null, "User role not found"));

        // If this mapping is for the systemadmin role, only SystemAdmin callers can change it
        var role = await _context.Roles.FindAsync(userRole.RoleId);
        if (role != null && role.Name.Equals("systemadmin", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("SystemAdmin"))
            return Forbid();

        userRole.IsActive = true;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "User role activated successfully"));
    }

    [HttpPut("user-roles/{id}/deactivate")]
    public async Task<IActionResult> DeactivateUserRole(int id)
    {
        var userRole = await _context.UserRoles.FindAsync(id);
        if (userRole == null)
            return NotFound(new ApiResponse<string>(false, null, "User role not found"));

        // If this mapping is for the systemadmin role, only SystemAdmin callers can change it
        var role = await _context.Roles.FindAsync(userRole.RoleId);
        if (role != null && role.Name.Equals("systemadmin", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("SystemAdmin"))
            return Forbid();

        userRole.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "User role deactivated successfully"));
    }

    #endregion

    #region Roles Management

    [HttpGet("roles")]
    public async Task<IActionResult> GetAllRoles()
    {
        var roles = await _context.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .ToListAsync();

        var result = roles.Select(r => new
        {
            r.Id,
            r.Name,
            r.Description,
            r.IsActive,
            r.CreatedAt,
            PermissionCount = r.RolePermissions.Count,
            Permissions = r.RolePermissions.Select(rp => new
            {
                rp.Permission.Id,
                rp.Permission.Name,
                rp.Permission.Resource,
                rp.Permission.Action,
                rp.Permission.Description
            }).ToList()
        });

        return Ok(new ApiResponse<object>(true, result, null));
    }

    [HttpGet("roles/{id}")]
    public async Task<IActionResult> GetRoleById(int id)
    {
        var role = await _context.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role == null)
            return NotFound(new ApiResponse<string>(false, null, "Role not found"));

        var result = new
        {
            role.Id,
            role.Name,
            role.Description,
            role.IsActive,
            role.CreatedAt,
            Permissions = role.RolePermissions.Select(rp => new
            {
                rp.Permission.Id,
                rp.Permission.Name,
                rp.Permission.Resource,
                rp.Permission.Action,
                rp.Permission.Description,
                rp.Permission.IsActive
            }).ToList()
        };

        return Ok(new ApiResponse<object>(true, result, null));
    }

    [HttpPost("roles")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request)
    {
        if (await _context.Roles.AnyAsync(r => r.Name == request.Name))
            return BadRequest(new ApiResponse<string>(false, null, "Role with this name already exists"));

        var role = new Role
        {
            Name = request.Name,
            Description = request.Description,
            IsActive = true
        };

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, new { role.Id, role.Name }, "Role created successfully"));
    }

    [HttpPut("roles/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateRoleRequest request)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null)
            return NotFound(new ApiResponse<string>(false, null, "Role not found"));

        if (!string.IsNullOrEmpty(request.Name))
        {
            if (await _context.Roles.AnyAsync(r => r.Name == request.Name && r.Id != id))
                return BadRequest(new ApiResponse<string>(false, null, "Role name already in use"));
            role.Name = request.Name;
        }

        if (request.Description != null)
            role.Description = request.Description;

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<string>(true, null, "Role updated successfully"));
    }

    [HttpDelete("roles/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null)
            return NotFound(new ApiResponse<string>(false, null, "Role not found"));

        // Check if role is in use
        var inUse = await _context.UserRoles.AnyAsync(ur => ur.RoleId == id);
        if (inUse)
            return BadRequest(new ApiResponse<string>(false, null, "Cannot delete role that is assigned to users"));

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "Role deleted successfully"));
    }

    [HttpPut("roles/{id}/activate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> ActivateRole(int id)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null)
            return NotFound(new ApiResponse<string>(false, null, "Role not found"));

        role.IsActive = true;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "Role activated successfully"));
    }

    [HttpPut("roles/{id}/deactivate")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeactivateRole(int id)
    {
        var role = await _context.Roles.FindAsync(id);
        if (role == null)
            return NotFound(new ApiResponse<string>(false, null, "Role not found"));

        role.IsActive = false;
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "Role deactivated successfully"));
    }

    #endregion

    #region Permissions Management

    [HttpGet("permissions")]
    public async Task<IActionResult> GetAllPermissions()
    {
        var permissions = await _context.Permissions.ToListAsync();
        return Ok(new ApiResponse<object>(true, permissions, null));
    }

    [HttpPost("permissions")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionRequest request)
    {
        if (await _context.Permissions.AnyAsync(p => p.Name == request.Name))
            return BadRequest(new ApiResponse<string>(false, null, "Permission with this name already exists"));

        var permission = new Permission
        {
            Name = request.Name,
            Resource = request.Resource,
            Action = request.Action,
            Description = request.Description,
            IsActive = true
        };

        _context.Permissions.Add(permission);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object>(true, new { permission.Id, permission.Name }, "Permission created successfully"));
    }

    [HttpPut("permissions/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> UpdatePermission(int id, [FromBody] UpdatePermissionRequest request)
    {
        var permission = await _context.Permissions.FindAsync(id);
        if (permission == null)
            return NotFound(new ApiResponse<string>(false, null, "Permission not found"));

        if (!string.IsNullOrEmpty(request.Name))
        {
            if (await _context.Permissions.AnyAsync(p => p.Name == request.Name && p.Id != id))
                return BadRequest(new ApiResponse<string>(false, null, "Permission name already in use"));
            permission.Name = request.Name;
        }

        if (!string.IsNullOrEmpty(request.Resource))
            permission.Resource = request.Resource;

        if (!string.IsNullOrEmpty(request.Action))
            permission.Action = request.Action;

        if (request.Description != null)
            permission.Description = request.Description;

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<string>(true, null, "Permission updated successfully"));
    }

    [HttpDelete("permissions/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> DeletePermission(int id)
    {
        var permission = await _context.Permissions.FindAsync(id);
        if (permission == null)
            return NotFound(new ApiResponse<string>(false, null, "Permission not found"));

        // Check if permission is in use
        var inUse = await _context.RolePermissions.AnyAsync(rp => rp.PermissionId == id);
        if (inUse)
            return BadRequest(new ApiResponse<string>(false, null, "Cannot delete permission that is assigned to roles"));

        _context.Permissions.Remove(permission);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "Permission deleted successfully"));
    }

    #endregion

    #region Role-Permission Management

    [HttpPost("roles/{roleId}/permissions/{permissionId}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> AssignPermissionToRole(int roleId, int permissionId)
    {
        var role = await _context.Roles.FindAsync(roleId);
        if (role == null)
            return NotFound(new ApiResponse<string>(false, null, "Role not found"));

        var permission = await _context.Permissions.FindAsync(permissionId);
        if (permission == null)
            return NotFound(new ApiResponse<string>(false, null, "Permission not found"));

        var existing = await _context.RolePermissions
            .FirstOrDefaultAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId);

        if (existing != null)
            return BadRequest(new ApiResponse<string>(false, null, "Permission already assigned to role"));

        var rolePermission = new RolePermission
        {
            RoleId = roleId,
            PermissionId = permissionId
        };

        _context.RolePermissions.Add(rolePermission);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "Permission assigned to role successfully"));
    }

    [HttpDelete("roles/{roleId}/permissions/{permissionId}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> RemovePermissionFromRole(int roleId, int permissionId)
    {
        var rolePermission = await _context.RolePermissions
            .FirstOrDefaultAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId);

        if (rolePermission == null)
            return NotFound(new ApiResponse<string>(false, null, "Role permission mapping not found"));

        _context.RolePermissions.Remove(rolePermission);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<string>(true, null, "Permission removed from role successfully"));
    }

    #endregion

    #region Tenants Management

    [HttpGet("tenants")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> GetAllTenants()
    {
        try
        {
            var tenants = await _context.Tenants
                .Include(t => t.UserRoles)
                .ToListAsync();

            var result = tenants.Select(t => new
            {
                t.Id,
                t.Name,
                t.Domain,
                t.ApiKey,
                t.IsActive,
                t.CreatedAt,
                UserCount = t.UserRoles.Select(ur => ur.UserId).Distinct().Count()
            }).ToList();

            return Ok(new ApiResponse<object>(true, result, null));
        }
        catch (Exception)
        {
            return StatusCode(500, new ApiResponse<object>(false, null, "An error occurred while fetching tenants"));
        }
    }

    [HttpPut("tenants/{id}")]
    [Authorize(Roles = "SystemAdmin")]
    public async Task<IActionResult> UpdateTenant(int id, [FromBody] UpdateTenantRequest request)
    {
        try
        {
            var tenant = await _context.Tenants.FindAsync(id);
            if (tenant == null)
                return NotFound(new ApiResponse<string>(false, null, "Tenant not found"));

            if (!string.IsNullOrEmpty(request.Name))
                tenant.Name = request.Name;

            if (!string.IsNullOrEmpty(request.Domain))
            {
                if (await _context.Tenants.AnyAsync(t => t.Domain == request.Domain && t.Id != id))
                    return BadRequest(new ApiResponse<string>(false, null, "Domain already in use"));
                tenant.Domain = request.Domain;
            }

            if (request.IsActive.HasValue)
                tenant.IsActive = request.IsActive.Value;

            await _context.SaveChangesAsync();
            return Ok(new ApiResponse<string>(true, null, "Tenant updated successfully"));
        }
        catch (Exception)
        {
            return StatusCode(500, new ApiResponse<string>(false, null, "An error occurred while updating tenant"));
        }
    }

    #endregion
}
