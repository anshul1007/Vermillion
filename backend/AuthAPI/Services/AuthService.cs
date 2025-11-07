using Microsoft.EntityFrameworkCore;
using AuthAPI.Data;
using AuthAPI.Models.DTOs;
using AuthAPI.Models.Entities;

namespace AuthAPI.Services;

public class AuthService : IAuthService
{
    private readonly AuthDbContext _context;
    private readonly IJwtService _jwtService;

    public AuthService(AuthDbContext context, IJwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    public async Task<(bool Success, LoginResponse? Response, string? Error)> LoginAsync(LoginRequest request)
    {
        // Find user by email (globally unique)
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Tenant)
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return (false, null, "Invalid email or password");

        // Get all active tenant roles with permissions
        var userTenants = user.UserRoles
            .Where(ur => ur.IsActive && ur.Tenant.IsActive && ur.Role.IsActive)
            .GroupBy(ur => ur.TenantId)
            .Select(g => new UserTenantDto(
                g.Key,
                g.First().Tenant.Name,
                g.First().Tenant.Domain,
                g.First().Role.Name,
                g.First().Role.RolePermissions
                    .Where(rp => rp.Permission.IsActive)
                    .Select(rp => rp.Permission.Name)
                    .ToList()
            ))
            .ToList();

        if (!userTenants.Any())
            return (false, null, "User has no active tenant access");

        // If tenantDomain specified, verify user has access
        if (!string.IsNullOrEmpty(request.TenantDomain))
        {
            if (!userTenants.Any(ut => ut.Domain == request.TenantDomain))
                return (false, null, $"User does not have access to tenant '{request.TenantDomain}'");
        }

        // Generate JWT with ALL tenant information for seamless switching
        var accessToken = _jwtService.GenerateAccessToken(user, userTenants);
        var refreshToken = _jwtService.GenerateRefreshToken();

        // Store refresh token
        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };
        _context.RefreshTokens.Add(refreshTokenEntity);

        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var userInfo = new UserInfoDto(
            user.Id,
            user.Username, // keep username field for backward compatibility in user info
            user.Email,
            userTenants, // All tenants with roles and permissions
            user.ExternalProvider
        );

        return (true, new LoginResponse(accessToken, refreshToken, userInfo), null);
    }

    public async Task<(bool Success, LoginResponse? Response, string? Error)> RefreshTokenAsync(RefreshTokenRequest request)
    {
        var refreshToken = await _context.RefreshTokens
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                        .ThenInclude(r => r.RolePermissions)
                            .ThenInclude(rp => rp.Permission)
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Tenant)
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken && !rt.IsRevoked);

        if (refreshToken == null)
            return (false, null, "Invalid refresh token");

        if (refreshToken.ExpiresAt < DateTime.UtcNow)
        {
            refreshToken.IsRevoked = true;
            await _context.SaveChangesAsync();
            return (false, null, "Refresh token expired");
        }

        var user = refreshToken.User;
        if (!user.IsActive)
            return (false, null, "User is inactive");

        // Get all active tenants with roles and permissions
        var userTenants = user.UserRoles
            .Where(ur => ur.IsActive && ur.Tenant.IsActive && ur.Role.IsActive)
            .GroupBy(ur => ur.TenantId)
            .Select(g => new UserTenantDto(
                g.Key,
                g.First().Tenant.Name,
                g.First().Tenant.Domain,
                g.First().Role.Name,
                g.First().Role.RolePermissions
                    .Where(rp => rp.Permission.IsActive)
                    .Select(rp => rp.Permission.Name)
                    .ToList()
            ))
            .ToList();

        if (!userTenants.Any())
            return (false, null, "User has no active tenant access");

        var newAccessToken = _jwtService.GenerateAccessToken(user, userTenants);
        var newRefreshToken = _jwtService.GenerateRefreshToken();

        // Revoke old token and create new one
        refreshToken.IsRevoked = true;
        var newRefreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };
        _context.RefreshTokens.Add(newRefreshTokenEntity);
        await _context.SaveChangesAsync();

        var userInfo = new UserInfoDto(
            user.Id,
            user.Username,
            user.Email,
            userTenants,
            user.ExternalProvider
        );

        return (true, new LoginResponse(newAccessToken, newRefreshToken, userInfo), null);
    }

    public async Task<(bool Success, User? User, string? Error)> RegisterUserAsync(RegisterUserRequest request)
    {
        // Check if email already exists (globally unique)
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            return (false, null, "Email already exists");

        // Validate tenant exists
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Domain == request.TenantDomain && t.IsActive);

        if (tenant == null)
            return (false, null, "Tenant not found or inactive");

        // Validate role exists
        var role = await _context.Roles
            .FirstOrDefaultAsync(r => r.Name == request.Role && r.IsActive);

        if (role == null)
            return (false, null, $"Role '{request.Role}' not found");

        // Create user (centralized in IdentityDB). Use Email as Username for primary login.
        var user = new User
        {
            Username = request.Email,
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(); // Save to get user.Id

        // Create UserRole entry (user has this role in this tenant)
        var userRole = new UserRole
        {
            UserId = user.Id,
            RoleId = role.Id,
            TenantId = tenant.Id,
            IsActive = true
        };

        _context.UserRoles.Add(userRole);

        // Create Employee record if employee details are provided
        if (!string.IsNullOrEmpty(request.EmployeeId))
        {
            var employee = new Employee
            {
                UserId = user.Id,
                EmployeeId = request.EmployeeId,
                FirstName = request.FirstName,
                LastName = request.LastName,
                PhoneNumber = request.PhoneNumber,
                DepartmentId = !string.IsNullOrEmpty(request.DepartmentId) ? Guid.Parse(request.DepartmentId) : null,
                ManagerId = !string.IsNullOrEmpty(request.ManagerId) ? Guid.Parse(request.ManagerId) : null
            };

            _context.Employees.Add(employee);
        }

        await _context.SaveChangesAsync();

        return (true, user, null);
    }

    public async Task<bool> RevokeRefreshTokenAsync(string token)
    {
        var refreshToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == token);

        if (refreshToken == null)
            return false;

        refreshToken.IsRevoked = true;
        await _context.SaveChangesAsync();
        return true;
    }
}
