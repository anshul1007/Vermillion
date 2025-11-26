using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Vermillion.Auth.Domain.Data;
using Vermillion.Auth.Domain.Models.Entities;

namespace Vermillion.Auth.Domain.Services;

/// <summary>
/// Implementation of IUserService providing direct database access with caching
/// Eliminates HTTP overhead for cross-domain user data access
/// </summary>
public class UserService : IUserService
{
    private readonly AuthDbContext _context;
    private readonly IMemoryCache _cache;
    private readonly ILogger<UserService> _logger;
    private readonly TimeSpan _cacheDuration = TimeSpan.FromMinutes(5);

    public UserService(AuthDbContext context, IMemoryCache cache, ILogger<UserService> logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    public async Task<User?> GetUserByIdAsync(int userId)
    {
        var cacheKey = $"user_{userId}";

        if (_cache.TryGetValue<User>(cacheKey, out var cachedUser))
        {
            return cachedUser;
        }

        try
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user != null)
            {
                _cache.Set(cacheKey, user, _cacheDuration);
            }

            return user;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user {UserId}", userId);
            return null;
        }
    }

    public async Task<string?> GetUserRoleAsync(int userId, string tenantDomain)
    {
        var cacheKey = $"user_role_{userId}_{tenantDomain}";

        if (_cache.TryGetValue<string>(cacheKey, out var cachedRole))
        {
            return cachedRole;
        }

        try
        {
            var tenant = await _context.Tenants
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Domain == tenantDomain);

            if (tenant == null)
            {
                _logger.LogWarning("Tenant with domain {TenantDomain} not found", tenantDomain);
                return null;
            }

            var userRole = await _context.UserRoles
                .AsNoTracking()
                .Include(ur => ur.Role)
                .Where(ur => ur.UserId == userId && ur.TenantId == tenant.Id)
                .FirstOrDefaultAsync();

            var roleName = userRole?.Role?.Name;

            if (roleName != null)
            {
                _cache.Set(cacheKey, roleName, _cacheDuration);
            }

            return roleName;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching role for user {UserId} in tenant {TenantDomain}", userId, tenantDomain);
            return null;
        }
    }

    public async Task<(int Id, string? Name, bool IsActive)?> GetRoleByIdAsync(int roleId)
    {
        var cacheKey = $"role_{roleId}";

        if (_cache.TryGetValue<(int, string?, bool)?>(cacheKey, out var cachedRole))
        {
            return cachedRole;
        }

        try
        {
            var role = await _context.Roles
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == roleId);

            if (role == null)
            {
                return null;
            }

            var result = (role.Id, role.Name, role.IsActive);
            _cache.Set(cacheKey, result, _cacheDuration);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching role {RoleId}", roleId);
            return null;
        }
    }

    public async Task<string?> GetEmailByAuthUserIdAsync(int authUserId)
    {
        var cacheKey = $"user_email_{authUserId}";

        if (_cache.TryGetValue<string>(cacheKey, out var cachedEmail))
        {
            return cachedEmail;
        }

        try
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == authUserId);

            if (user?.Email != null)
            {
                _cache.Set(cacheKey, user.Email, _cacheDuration);
            }

            return user?.Email;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching email for user {UserId}", authUserId);
            return null;
        }
    }

    public async Task<(string? FirstName, string? LastName, bool? IsActive)?> GetNameByAuthUserIdAsync(int authUserId)
    {
        var cacheKey = $"user_name_{authUserId}";

        if (_cache.TryGetValue<(string?, string?, bool?)?>(cacheKey, out var cachedName))
        {
            return cachedName;
        }

        try
        {
            var employee = await _context.Employees
                .AsNoTracking()
                .Include(e => e.User)
                .FirstOrDefaultAsync(e => e.UserId == authUserId);

            if (employee == null)
            {
                return null;
            }

            var result = (employee.FirstName, employee.LastName, employee.User?.IsActive);
            _cache.Set(cacheKey, result, _cacheDuration);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching name for user {UserId}", authUserId);
            return null;
        }
    }

    public async Task<bool?> GetUserIsActiveAsync(int authUserId)
    {
        var cacheKey = $"user_isactive_{authUserId}";

        if (_cache.TryGetValue<bool?>(cacheKey, out var cachedIsActive))
        {
            return cachedIsActive;
        }

        try
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == authUserId);

            if (user == null)
            {
                return null;
            }

            _cache.Set(cacheKey, user.IsActive, _cacheDuration);

            return user.IsActive;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching isActive for user {UserId}", authUserId);
            return null;
        }
    }

    public async Task<int?> GetUserIdByEmailAsync(string email)
    {
        // Don't cache email lookups as they're used less frequently
        try
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email == email);

            return user?.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error looking up user by email {Email}", email);
            return null;
        }
    }

    public async Task<List<Employee>> GetAllEmployeesAsync(bool excludeGuards = true)
    {
        var cacheKey = $"all_employees_{excludeGuards}";

        if (_cache.TryGetValue<List<Employee>>(cacheKey, out var cachedEmployees))
        {
            return cachedEmployees ?? new List<Employee>();
        }

        try
        {
            var query = _context.Employees
                .AsNoTracking()
                .Include(e => e.User)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .Include(e => e.Department)
                .Include(e => e.Manager)
                .AsQueryable();

            if (excludeGuards)
            {
                // Exclude users with Guard role
                var guardRole = await _context.Roles
                    .AsNoTracking()
                    .FirstOrDefaultAsync(r => r.Name == "Guard");

                if (guardRole != null)
                {
                    var guardUserIds = await _context.UserRoles
                        .AsNoTracking()
                        .Where(ur => ur.RoleId == guardRole.Id)
                        .Select(ur => ur.UserId)
                        .ToListAsync();

                    query = query.Where(e => !guardUserIds.Contains(e.UserId));
                }
            }

            var employees = await query.ToListAsync();
            _cache.Set(cacheKey, employees, _cacheDuration);

            return employees;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all employees");
            return new List<Employee>();
        }
    }

    public async Task<List<Department>> GetAllDepartmentsAsync()
    {
        var cacheKey = "all_departments";

        if (_cache.TryGetValue<List<Department>>(cacheKey, out var cachedDepartments))
        {
            return cachedDepartments ?? new List<Department>();
        }

        try
        {
            var departments = await _context.Departments
                .AsNoTracking()
                .Include(d => d.Employees)
                .Where(d => d.IsActive)
                .ToListAsync();

            _cache.Set(cacheKey, departments, _cacheDuration);

            return departments;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all departments");
            return new List<Department>();
        }
    }

    public async Task<Department?> GetDepartmentByIdAsync(Guid departmentId)
    {
        var cacheKey = $"department_{departmentId}";

        if (_cache.TryGetValue<Department>(cacheKey, out var cachedDepartment))
        {
            return cachedDepartment;
        }

        try
        {
            var department = await _context.Departments
                .AsNoTracking()
                .Include(d => d.Employees)
                .FirstOrDefaultAsync(d => d.Id == departmentId);

            if (department != null)
            {
                _cache.Set(cacheKey, department, _cacheDuration);
            }

            return department;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching department {DepartmentId}", departmentId);
            return null;
        }
    }

    public async Task<Department> CreateDepartmentAsync(Department department)
    {
        try
        {
            _context.Departments.Add(department);
            await _context.SaveChangesAsync();

            // Invalidate cache
            _cache.Remove("all_departments");

            return department;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating department {DepartmentName}", department.Name);
            throw;
        }
    }

    public async Task<Department?> UpdateDepartmentAsync(Guid departmentId, Department updatedDepartment)
    {
        try
        {
            var existing = await _context.Departments.FindAsync(departmentId);
            if (existing == null)
            {
                return null;
            }

            existing.Name = updatedDepartment.Name;
            existing.Description = updatedDepartment.Description;
            existing.WeeklyOffDays = updatedDepartment.WeeklyOffDays;
            existing.IsActive = updatedDepartment.IsActive;

            await _context.SaveChangesAsync();

            // Invalidate cache
            _cache.Remove("all_departments");
            _cache.Remove($"department_{departmentId}");

            return existing;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating department {DepartmentId}", departmentId);
            return null;
        }
    }

    public async Task<bool> DeleteDepartmentAsync(Guid departmentId)
    {
        try
        {
            var department = await _context.Departments.FindAsync(departmentId);
            if (department == null)
            {
                return false;
            }

            _context.Departments.Remove(department);
            await _context.SaveChangesAsync();

            // Invalidate cache
            _cache.Remove("all_departments");
            _cache.Remove($"department_{departmentId}");

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting department {DepartmentId}", departmentId);
            return false;
        }
    }

    public async Task<bool> UpdateUserAsync(int userId, string? email, string? firstName, string? lastName,
        string? phoneNumber, int? roleId, Guid? managerId, Guid? departmentId, bool? isActive)
    {
        try
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return false;
            }

            // Update user fields
            if (email != null) user.Email = email;
            if (isActive.HasValue) user.IsActive = isActive.Value;

            // Update employee fields
            var employee = await _context.Employees.FirstOrDefaultAsync(e => e.UserId == userId);
            if (employee != null)
            {
                if (firstName != null) employee.FirstName = firstName;
                if (lastName != null) employee.LastName = lastName;
                if (phoneNumber != null) employee.PhoneNumber = phoneNumber;
                if (managerId.HasValue) employee.ManagerId = managerId;
                if (departmentId.HasValue) employee.DepartmentId = departmentId;
                employee.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            // Invalidate relevant caches
            InvalidateUserCache(userId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user {UserId}", userId);
            return false;
        }
    }

    public async Task<(bool Success, string Message, int? UserId)> CreateUserAsync(
        string username, string email, string passwordHash, string tenantDomain,
        string roleName, string employeeId, string? firstName, string? lastName,
        string? phoneNumber, Guid? departmentId, Guid? managerId)
    {
        try
        {
            // Check if user already exists
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == email || u.Username == username);

            if (existingUser != null)
            {
                return (false, "User with this email or username already exists", null);
            }

            // Get tenant and role
            var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Domain == tenantDomain);
            if (tenant == null)
            {
                return (false, $"Tenant {tenantDomain} not found", null);
            }

            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
            if (role == null)
            {
                return (false, $"Role {roleName} not found", null);
            }

            // Create user
            var user = new User
            {
                Username = username,
                Email = email,
                PasswordHash = passwordHash,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Create user role
            var userRole = new UserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
                TenantId = tenant.Id
            };

            _context.UserRoles.Add(userRole);

            // Create employee record
            var employee = new Employee
            {
                UserId = user.Id,
                EmployeeId = employeeId,
                FirstName = firstName,
                LastName = lastName,
                PhoneNumber = phoneNumber,
                DepartmentId = departmentId,
                ManagerId = managerId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Employees.Add(employee);
            await _context.SaveChangesAsync();

            // Invalidate cache
            _cache.Remove("all_employees_True");
            _cache.Remove("all_employees_False");

            return (true, "User created successfully", user.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user {Username}", username);
            return (false, ex.Message, null);
        }
    }

    public async Task<List<Employee>> GetEmployeesByManagerIdAsync(Guid managerId)
    {
        var cacheKey = $"employees_manager_{managerId}";

        if (_cache.TryGetValue<List<Employee>>(cacheKey, out var cachedEmployees))
        {
            return cachedEmployees ?? new List<Employee>();
        }

        try
        {
            var employees = await _context.Employees
                .AsNoTracking()
                .Include(e => e.User)
                    .ThenInclude(u => u.UserRoles)
                        .ThenInclude(ur => ur.Role)
                .Include(e => e.Department)
                .Where(e => e.ManagerId == managerId)
                .ToListAsync();

            _cache.Set(cacheKey, employees, _cacheDuration);

            return employees;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching employees for manager {ManagerId}", managerId);
            return new List<Employee>();
        }
    }

    private void InvalidateUserCache(int userId)
    {
        _cache.Remove($"user_{userId}");
        _cache.Remove($"user_email_{userId}");
        _cache.Remove($"user_name_{userId}");
        _cache.Remove($"user_isactive_{userId}");
        _cache.Remove("all_employees_True");
        _cache.Remove("all_employees_False");
    }
}
