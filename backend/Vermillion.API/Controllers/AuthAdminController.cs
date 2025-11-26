using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Vermillion.Auth.Domain.Services;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Data;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/auth/admin")]
[Authorize]
public class AuthAdminController : ControllerBase
{
	private readonly IUserService _userService;
	private readonly AuthDbContext _context;
	private readonly ILogger<AuthAdminController> _logger;

	public AuthAdminController(IUserService userService, AuthDbContext context, ILogger<AuthAdminController> logger)
	{
		_userService = userService;
		_context = context;
		_logger = logger;
	}

	[HttpGet("users")]
	public async Task<ActionResult<ApiResponse<List<UserInfoDto>>>> GetUsers()
	{
		try
		{
			// Fetch all users with their relationships
			var users = await _context.Users
				.Include(u => u.UserRoles.Where(ur => ur.IsActive))
					.ThenInclude(ur => ur.Tenant)
				.Include(u => u.UserRoles.Where(ur => ur.IsActive))
					.ThenInclude(ur => ur.Role)
						.ThenInclude(r => r.RolePermissions)
							.ThenInclude(rp => rp.Permission)
				.ToListAsync();

			var result = new List<object>();

			foreach (var user in users)
			{
				// Build tenant information
				var tenants = user.UserRoles
					.Where(ur => ur.IsActive && ur.Tenant != null && ur.Tenant.IsActive && ur.Role != null && ur.Role.IsActive)
					.GroupBy(ur => ur.TenantId)
					.Select(g =>
					{
						var ur0 = g.FirstOrDefault();
						var tenant = ur0?.Tenant;
						var role = ur0?.Role;
						var permissions = role?.RolePermissions
							?.Where(rp => rp?.Permission != null && rp.Permission.IsActive)
							.Select(rp => rp.Permission.Name)
							.ToList() ?? new List<string>();

						return new
						{
							tenantId = g.Key,
							tenantName = tenant?.Name ?? string.Empty,
							tenantDomain = tenant?.Domain ?? string.Empty,
							roleId = role?.Id ?? 0,
							roleName = role?.Name ?? string.Empty,
							permissions = permissions,
							isActive = ur0?.IsActive ?? false
						};
					})
					.ToList();

				result.Add(new
				{
					id = user.Id,
					username = user.Username,
					email = user.Email,
					externalProvider = user.ExternalProvider,
					createdAt = user.CreatedAt,
					tenants = tenants
				});
			}

			return Ok(new AuthApiResponse<object> { Success = true, Data = result, Message = null });
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error fetching users");
			return StatusCode(500, new AuthApiResponse<object> { Success = false, Data = null, Message = $"Error fetching users: {ex.Message}" });
		}
	}

	/// <summary>
	/// Get user ID by email address
	/// </summary>
	[HttpGet("users/by-email")]
	public async Task<IActionResult> GetUserIdByEmail([FromQuery] string email)
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
	[HttpGet("users/{userId}/effective-role")]
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

		return Ok(new AuthApiResponse<object> { Success = true, Data = new { role = userRole.Role.Name } });
	}

	/// <summary>
	/// Get user's profile
	/// </summary>
	[HttpGet("users/{userId}/profile")]
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

		return Ok(new AuthApiResponse<object> { Success = true, Data = user, Message = null });
	}

	/// <summary>
	/// Get user's email address
	/// </summary>
	[HttpGet("users/{userId}/email")]
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
	[HttpGet("users/{userId}/is-active")]
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

		return Ok(new AuthApiResponse<object> { Success = true, Data = role, Message = null });
	}

	/// <summary>
	/// Get employee by user ID
	/// </summary>
	[HttpGet("users/{userId}/employee")]
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

		return Ok(new AuthApiResponse<object> { Success = true, Data = employee, Message = null });
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
				e.User.Email,
				e.User.IsActive,
				e.PhoneNumber,
				e.DepartmentId,
				DepartmentName = e.Department != null ? e.Department.Name : null,
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

		return Ok(new AuthApiResponse<object> { Success = true, Data = employees, Message = null });
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

		return Ok(new AuthApiResponse<object> { Success = true, Data = departments, Message = null });
	}

	/// <summary>
	/// Get user by ID
	/// </summary>
	[HttpGet("users/{id}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> GetUserById(int id)
	{
		try
		{
			var user = await _context.Users
				.Include(u => u.UserRoles.Where(ur => ur.IsActive))
					.ThenInclude(ur => ur.Tenant)
				.Include(u => u.UserRoles.Where(ur => ur.IsActive))
					.ThenInclude(ur => ur.Role)
						.ThenInclude(r => r.RolePermissions)
							.ThenInclude(rp => rp.Permission)
				.Where(u => u.Id == id)
				.FirstOrDefaultAsync();

			if (user == null)
				return NotFound(new ApiResponse<object>(false, null, $"User {id} not found"));

			// Build tenant information
			var tenants = user.UserRoles
				.Where(ur => ur.IsActive && ur.Tenant != null && ur.Tenant.IsActive && ur.Role != null && ur.Role.IsActive)
				.GroupBy(ur => ur.TenantId)
				.Select(g =>
				{
					var ur0 = g.FirstOrDefault();
					var tenant = ur0?.Tenant;
					var role = ur0?.Role;
					var permissions = role?.RolePermissions
						?.Where(rp => rp?.Permission != null && rp.Permission.IsActive)
						.Select(rp => rp.Permission.Name)
						.ToList() ?? new List<string>();

					return new
					{
						tenantId = g.Key,
						tenantName = tenant?.Name ?? string.Empty,
						tenantDomain = tenant?.Domain ?? string.Empty,
						roleId = role?.Id ?? 0,
						roleName = role?.Name ?? string.Empty,
						permissions = permissions,
						isActive = ur0?.IsActive ?? false
					};
				})
				.ToList();

			var result = new
			{
				id = user.Id,
				username = user.Username,
				email = user.Email,
				externalProvider = user.ExternalProvider,
				createdAt = user.CreatedAt,
				tenants = tenants
			};

			return Ok(new ApiResponse<object>(true, result, null));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error fetching user {UserId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error fetching user: {ex.Message}"));
		}
	}

	/// <summary>
	/// Create a new user
	/// </summary>
	[HttpPost("users")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> CreateUser([FromBody] CreateUserRequestDto request)
	{
		try
		{
			// Check if user already exists
			var existingUser = await _context.Users
				.Where(u => u.Email == request.Email || u.Username == request.Username)
				.FirstOrDefaultAsync();

			if (existingUser != null)
				return BadRequest(new ApiResponse<object>(false, null, "User with this email or username already exists"));

			// Hash password
			var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

			// Create user
			var user = new Auth.Domain.Models.Entities.User
			{
				Username = request.Username,
				Email = request.Email,
				PasswordHash = passwordHash,
				ExternalProvider = request.ExternalProvider,
				IsActive = true,
				CreatedAt = DateTime.UtcNow
			};

			_context.Users.Add(user);
			await _context.SaveChangesAsync();

			_logger.LogInformation("User {Username} created with ID {UserId}", user.Username, user.Id);

			return Ok(new AuthApiResponse<object> { Success = true, Data = new { id = user.Id, username = user.Username, email = user.Email }, Message = "User created successfully" });
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error creating user");
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error creating user: {ex.Message}"));
		}
	}

	/// <summary>
	/// Update user
	/// </summary>
	[HttpPut("users/{id}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequestDto request)
	{
		try
		{
			_logger.LogInformation("Updating user {UserId} with request: Username={Username}, Email={Email}, HasPassword={HasPassword}",
				id, request.Username, request.Email, !string.IsNullOrEmpty(request.Password));

			var user = await _context.Users.FindAsync(id);
			if (user == null)
				return NotFound(new ApiResponse<object>(false, null, $"User {id} not found"));

			bool wasModified = false;

			// Update fields if provided
			if (!string.IsNullOrEmpty(request.Username))
			{
				_logger.LogInformation("Updating username from {OldUsername} to {NewUsername}", user.Username, request.Username);
				user.Username = request.Username;
				wasModified = true;
			}

			if (!string.IsNullOrEmpty(request.Email))
			{
				_logger.LogInformation("Updating email from {OldEmail} to {NewEmail}", user.Email, request.Email);
				user.Email = request.Email;
				wasModified = true;
			}

			if (!string.IsNullOrEmpty(request.Password))
			{
				_logger.LogInformation("Updating password for user {UserId}", id);
				user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
				wasModified = true;
			}

			if (wasModified)
			{
				_context.Users.Update(user);
				var changeCount = await _context.SaveChangesAsync();
				_logger.LogInformation("User {UserId} updated successfully. Changes saved: {ChangeCount}", id, changeCount);
			}
			else
			{
				_logger.LogWarning("No fields provided to update for user {UserId}", id);
			}

			return Ok(new AuthApiResponse<object> { Success = true, Data = new { id = user.Id, username = user.Username, email = user.Email }, Message = "User updated successfully" });
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error updating user {UserId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error updating user: {ex.Message}"));
		}
	}

	/// <summary>
	/// Delete user
	/// </summary>
	[HttpDelete("users/{id}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> DeleteUser(int id)
	{
		try
		{
			var user = await _context.Users.FindAsync(id);
			if (user == null)
				return NotFound(new ApiResponse<object>(false, null, $"User {id} not found"));

			// Soft delete by marking as inactive
			user.IsActive = false;
			await _context.SaveChangesAsync();

			_logger.LogInformation("User {UserId} deleted (deactivated)", id);

			return Ok(new ApiResponse<object>(true, null, "User deleted successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error deleting user {UserId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error deleting user: {ex.Message}"));
		}
	}

	/// <summary>
	/// Assign user to tenant role
	/// </summary>
	[HttpPost("users/{userId}/tenants/{tenantId}/roles/{roleId}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> AssignUserToTenantRole(int userId, int tenantId, int roleId)
	{
		try
		{
			// Verify user, tenant, and role exist
			var user = await _context.Users.FindAsync(userId);
			if (user == null)
				return NotFound(new ApiResponse<object>(false, null, $"User {userId} not found"));

			var tenant = await _context.Tenants.FindAsync(tenantId);
			if (tenant == null)
				return NotFound(new ApiResponse<object>(false, null, $"Tenant {tenantId} not found"));

			var role = await _context.Roles.FindAsync(roleId);
			if (role == null)
				return NotFound(new ApiResponse<object>(false, null, $"Role {roleId} not found"));

			// Check if assignment already exists
			var existing = await _context.UserRoles
				.Where(ur => ur.UserId == userId && ur.TenantId == tenantId && ur.RoleId == roleId)
				.FirstOrDefaultAsync();

			if (existing != null)
			{
				// Reactivate if inactive
				if (!existing.IsActive)
				{
					existing.IsActive = true;
					await _context.SaveChangesAsync();
					return Ok(new ApiResponse<object>(true, null, "User role assignment reactivated"));
				}
				return BadRequest(new ApiResponse<object>(false, null, "User is already assigned to this role in this tenant"));
			}

			// Create new assignment
			var userRole = new Auth.Domain.Models.Entities.UserRole
			{
				UserId = userId,
				TenantId = tenantId,
				RoleId = roleId,
				IsActive = true,
				CreatedAt = DateTime.UtcNow
			};

			_context.UserRoles.Add(userRole);
			await _context.SaveChangesAsync();

			_logger.LogInformation("User {UserId} assigned to tenant {TenantId} with role {RoleId}", userId, tenantId, roleId);

			return Ok(new ApiResponse<object>(true, null, "User assigned to tenant role successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error assigning user to tenant role");
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error assigning user: {ex.Message}"));
		}
	}

	/// <summary>
	/// Remove user from tenant role
	/// </summary>
	[HttpDelete("users/{userId}/tenants/{tenantId}/roles/{roleId}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> RemoveUserFromTenantRole(int userId, int tenantId, int roleId)
	{
		try
		{
			var userRole = await _context.UserRoles
				.Where(ur => ur.UserId == userId && ur.TenantId == tenantId && ur.RoleId == roleId)
				.FirstOrDefaultAsync();

			if (userRole == null)
				return NotFound(new ApiResponse<object>(false, null, "User role assignment not found"));

			// Soft delete by marking as inactive
			userRole.IsActive = false;
			await _context.SaveChangesAsync();

			_logger.LogInformation("User {UserId} removed from tenant {TenantId} role {RoleId}", userId, tenantId, roleId);

			return Ok(new ApiResponse<object>(true, null, "User removed from tenant role successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error removing user from tenant role");
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error removing user: {ex.Message}"));
		}
	}

	/// <summary>
	/// Activate user role
	/// </summary>
	[HttpPut("user-roles/{id}/activate")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> ActivateUserRole(int id)
	{
		try
		{
			var userRole = await _context.UserRoles.FindAsync(id);
			if (userRole == null)
				return NotFound(new ApiResponse<object>(false, null, $"User role {id} not found"));

			userRole.IsActive = true;
			await _context.SaveChangesAsync();

			_logger.LogInformation("User role {UserRoleId} activated", id);

			return Ok(new ApiResponse<object>(true, null, "User role activated successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error activating user role {UserRoleId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error activating user role: {ex.Message}"));
		}
	}

	/// <summary>
	/// Deactivate user role
	/// </summary>
	[HttpPut("user-roles/{id}/deactivate")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> DeactivateUserRole(int id)
	{
		try
		{
			var userRole = await _context.UserRoles.FindAsync(id);
			if (userRole == null)
				return NotFound(new ApiResponse<object>(false, null, $"User role {id} not found"));

			userRole.IsActive = false;
			await _context.SaveChangesAsync();

			_logger.LogInformation("User role {UserRoleId} deactivated", id);

			return Ok(new ApiResponse<object>(true, null, "User role deactivated successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error deactivating user role {UserRoleId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error deactivating user role: {ex.Message}"));
		}
	}

	/// <summary>
	/// Get all roles
	/// </summary>
	[HttpGet("role")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> GetAllRoles()
	{
		var roles = await _context.Roles
			.Include(r => r.RolePermissions)
				.ThenInclude(rp => rp.Permission)
			.Where(r => r.IsActive)
			.Select(r => new
			{
				r.Id,
				r.Name,
				r.Description,
				r.IsActive,
				r.CreatedAt,
				PermissionCount = r.RolePermissions.Count(rp => rp.Permission.IsActive),
				Permissions = r.RolePermissions
					.Where(rp => rp.Permission.IsActive)
					.Select(rp => new
					{
						rp.Permission.Id,
						rp.Permission.Name,
						rp.Permission.Resource,
						rp.Permission.Action,
						rp.Permission.Description
					})
					.ToList()
			})
			.ToListAsync();

		return Ok(new ApiResponse<object>(true, roles, null));
	}

	/// <summary>
	/// Create role
	/// </summary>
	[HttpPost("roles")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequestDto request)
	{
		try
		{
			// Check if role already exists
			var existingRole = await _context.Roles
				.Where(r => r.Name == request.Name)
				.FirstOrDefaultAsync();

			if (existingRole != null)
				return BadRequest(new ApiResponse<object>(false, null, "Role with this name already exists"));

			var role = new Auth.Domain.Models.Entities.Role
			{
				Name = request.Name,
				Description = request.Description,
				IsActive = true,
				CreatedAt = DateTime.UtcNow
			};

			_context.Roles.Add(role);
			await _context.SaveChangesAsync();

			_logger.LogInformation("Role {RoleName} created with ID {RoleId}", role.Name, role.Id);

			return Ok(new AuthApiResponse<object> { Success = true, Data = new { id = role.Id, name = role.Name }, Message = "Role created successfully" });
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error creating role");
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error creating role: {ex.Message}"));
		}
	}

	/// <summary>
	/// Update role
	/// </summary>
	[HttpPut("roles/{id}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateRoleRequestDto request)
	{
		try
		{
			var role = await _context.Roles.FindAsync(id);
			if (role == null)
				return NotFound(new ApiResponse<object>(false, null, $"Role {id} not found"));

			if (!string.IsNullOrEmpty(request.Name))
				role.Name = request.Name;

			if (request.Description != null)
				role.Description = request.Description;

			await _context.SaveChangesAsync();

			_logger.LogInformation("Role {RoleId} updated", id);

			return Ok(new ApiResponse<object>(true, null, "Role updated successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error updating role {RoleId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error updating role: {ex.Message}"));
		}
	}

	/// <summary>
	/// Delete role
	/// </summary>
	[HttpDelete("roles/{id}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> DeleteRole(int id)
	{
		try
		{
			var role = await _context.Roles.FindAsync(id);
			if (role == null)
				return NotFound(new ApiResponse<object>(false, null, $"Role {id} not found"));

			// Soft delete by marking as inactive
			role.IsActive = false;
			await _context.SaveChangesAsync();

			_logger.LogInformation("Role {RoleId} deleted (deactivated)", id);

			return Ok(new ApiResponse<object>(true, null, "Role deleted successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error deleting role {RoleId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error deleting role: {ex.Message}"));
		}
	}

	/// <summary>
	/// Activate role
	/// </summary>
	[HttpPut("roles/{id}/activate")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> ActivateRole(int id)
	{
		try
		{
			var role = await _context.Roles.FindAsync(id);
			if (role == null)
				return NotFound(new ApiResponse<object>(false, null, $"Role {id} not found"));

			role.IsActive = true;
			await _context.SaveChangesAsync();

			_logger.LogInformation("Role {RoleId} activated", id);

			return Ok(new ApiResponse<object>(true, null, "Role activated successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error activating role {RoleId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error activating role: {ex.Message}"));
		}
	}

	/// <summary>
	/// Deactivate role
	/// </summary>
	[HttpPut("roles/{id}/deactivate")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> DeactivateRole(int id)
	{
		try
		{
			var role = await _context.Roles.FindAsync(id);
			if (role == null)
				return NotFound(new ApiResponse<object>(false, null, $"Role {id} not found"));

			role.IsActive = false;
			await _context.SaveChangesAsync();

			_logger.LogInformation("Role {RoleId} deactivated", id);

			return Ok(new ApiResponse<object>(true, null, "Role deactivated successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error deactivating role {RoleId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error deactivating role: {ex.Message}"));
		}
	}

	/// <summary>
	/// Get all permissions
	/// </summary>
	[HttpGet("permissions")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> GetAllPermissions()
	{
		var permissions = await _context.Permissions
			.Where(p => p.IsActive)
			.Select(p => new
			{
				p.Id,
				p.Name,
				p.Resource,
				p.Action,
				p.Description,
				p.IsActive
			})
			.ToListAsync();

		return Ok(new ApiResponse<object>(true, permissions, null));
	}

	/// <summary>
	/// Create permission
	/// </summary>
	[HttpPost("permissions")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionRequestDto request)
	{
		try
		{
			// Check if permission already exists
			var existingPermission = await _context.Permissions
				.Where(p => p.Name == request.Name || (p.Resource == request.Resource && p.Action == request.Action))
				.FirstOrDefaultAsync();

			if (existingPermission != null)
				return BadRequest(new ApiResponse<object>(false, null, "Permission with this name or resource/action combination already exists"));

			var permission = new Auth.Domain.Models.Entities.Permission
			{
				Name = request.Name,
				Resource = request.Resource,
				Action = request.Action,
				Description = request.Description,
				IsActive = true,
				CreatedAt = DateTime.UtcNow
			};

			_context.Permissions.Add(permission);
			await _context.SaveChangesAsync();

			_logger.LogInformation("Permission {PermissionName} created with ID {PermissionId}", permission.Name, permission.Id);

			return Ok(new AuthApiResponse<object> { Success = true, Data = new { id = permission.Id, name = permission.Name }, Message = "Permission created successfully" });
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error creating permission");
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error creating permission: {ex.Message}"));
		}
	}

	/// <summary>
	/// Update permission
	/// </summary>
	[HttpPut("permissions/{id}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> UpdatePermission(int id, [FromBody] UpdatePermissionRequestDto request)
	{
		try
		{
			var permission = await _context.Permissions.FindAsync(id);
			if (permission == null)
				return NotFound(new ApiResponse<object>(false, null, $"Permission {id} not found"));

			if (!string.IsNullOrEmpty(request.Name))
				permission.Name = request.Name;

			if (!string.IsNullOrEmpty(request.Resource))
				permission.Resource = request.Resource;

			if (!string.IsNullOrEmpty(request.Action))
				permission.Action = request.Action;

			if (request.Description != null)
				permission.Description = request.Description;

			await _context.SaveChangesAsync();

			_logger.LogInformation("Permission {PermissionId} updated", id);

			return Ok(new ApiResponse<object>(true, null, "Permission updated successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error updating permission {PermissionId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error updating permission: {ex.Message}"));
		}
	}

	/// <summary>
	/// Delete permission
	/// </summary>
	[HttpDelete("permissions/{id}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> DeletePermission(int id)
	{
		try
		{
			var permission = await _context.Permissions.FindAsync(id);
			if (permission == null)
				return NotFound(new ApiResponse<object>(false, null, $"Permission {id} not found"));

			// Soft delete by marking as inactive
			permission.IsActive = false;
			await _context.SaveChangesAsync();

			_logger.LogInformation("Permission {PermissionId} deleted (deactivated)", id);

			return Ok(new ApiResponse<object>(true, null, "Permission deleted successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error deleting permission {PermissionId}", id);
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error deleting permission: {ex.Message}"));
		}
	}

	/// <summary>
	/// Assign permission to role
	/// </summary>
	[HttpPost("roles/{roleId}/permissions/{permissionId}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> AssignPermissionToRole(int roleId, int permissionId)
	{
		try
		{
			// Verify role and permission exist
			var role = await _context.Roles.FindAsync(roleId);
			if (role == null)
				return NotFound(new ApiResponse<object>(false, null, $"Role {roleId} not found"));

			var permission = await _context.Permissions.FindAsync(permissionId);
			if (permission == null)
				return NotFound(new ApiResponse<object>(false, null, $"Permission {permissionId} not found"));

			// Check if assignment already exists
			var existing = await _context.RolePermissions
				.Where(rp => rp.RoleId == roleId && rp.PermissionId == permissionId)
				.FirstOrDefaultAsync();

			if (existing != null)
				return BadRequest(new ApiResponse<object>(false, null, "Permission is already assigned to this role"));

			// Create new assignment
			var rolePermission = new Auth.Domain.Models.Entities.RolePermission
			{
				RoleId = roleId,
				PermissionId = permissionId,
				CreatedAt = DateTime.UtcNow
			};

			_context.RolePermissions.Add(rolePermission);
			await _context.SaveChangesAsync();

			_logger.LogInformation("Permission {PermissionId} assigned to role {RoleId}", permissionId, roleId);

			return Ok(new ApiResponse<object>(true, null, "Permission assigned to role successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error assigning permission to role");
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error assigning permission: {ex.Message}"));
		}
	}

	/// <summary>
	/// Remove permission from role
	/// </summary>
	[HttpDelete("roles/{roleId}/permissions/{permissionId}")]
	[Authorize(Roles = "SystemAdmin")]
	public async Task<IActionResult> RemovePermissionFromRole(int roleId, int permissionId)
	{
		try
		{
			var rolePermission = await _context.RolePermissions
				.Where(rp => rp.RoleId == roleId && rp.PermissionId == permissionId)
				.FirstOrDefaultAsync();

			if (rolePermission == null)
				return NotFound(new ApiResponse<object>(false, null, "Permission assignment not found"));

			_context.RolePermissions.Remove(rolePermission);
			await _context.SaveChangesAsync();

			_logger.LogInformation("Permission {PermissionId} removed from role {RoleId}", permissionId, roleId);

			return Ok(new ApiResponse<object>(true, null, "Permission removed from role successfully"));
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error removing permission from role");
			return StatusCode(500, new ApiResponse<object>(false, null, $"Error removing permission: {ex.Message}"));
		}
	}
}

// DTOs for request bodies
public class CreateUserRequestDto
{
	public string Username { get; set; } = string.Empty;
	public string Email { get; set; } = string.Empty;
	public string Password { get; set; } = string.Empty;
	public string? ExternalProvider { get; set; }
}

public class UpdateUserRequestDto
{
	public string? Username { get; set; }
	public string? Email { get; set; }
	public string? Password { get; set; }
}

public class CreateRoleRequestDto
{
	public string Name { get; set; } = string.Empty;
	public string? Description { get; set; }
}

public class UpdateRoleRequestDto
{
	public string? Name { get; set; }
	public string? Description { get; set; }
}

public class CreatePermissionRequestDto
{
	public string Name { get; set; } = string.Empty;
	public string Resource { get; set; } = string.Empty;
	public string Action { get; set; } = string.Empty;
	public string? Description { get; set; }
}

public class UpdatePermissionRequestDto
{
	public string? Name { get; set; }
	public string? Resource { get; set; }
	public string? Action { get; set; }
	public string? Description { get; set; }
}
