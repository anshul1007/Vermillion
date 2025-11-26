using Microsoft.Extensions.Logging;
using Vermillion.Attendance.Domain.Models.DTOs;
using Vermillion.Auth.Domain.Services;

namespace Vermillion.Attendance.Domain.Services
{
    public interface ITeamManagementHelper
    {
        Task<HashSet<int>?> GetManagerTeamUserIdsAsync(Guid managerEmployeeId);
        Task<List<TeamMemberDto>> BuildTeamMemberDtosExcludingSystemAdminsAsync(IEnumerable<EmployeeDto> employees);
        Task<List<EmployeeDto>?> GetAllEmployeesAsync();
    }

    public class TeamManagementHelper : ITeamManagementHelper
    {
        private readonly IUserService _userService;
        private readonly ILogger<TeamManagementHelper> _logger;

        public TeamManagementHelper(IUserService userService, ILogger<TeamManagementHelper> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        public async Task<List<EmployeeDto>?> GetAllEmployeesAsync()
        {
            var employees = await _userService.GetAllEmployeesAsync();
            if (employees == null)
                return null;

            return employees.Select(e =>
            {
                DepartmentDto? deptDto = null;
                if (e.Department != null)
                {
                    var weeklyOff = !string.IsNullOrWhiteSpace(e.Department.WeeklyOffDays)
                        ? e.Department.WeeklyOffDays.Split(',').Select(s => s.Trim()).Where(s => !string.IsNullOrEmpty(s)).ToList()
                        : null;

                    deptDto = new DepartmentDto(
                        e.Department.Id.ToString(),
                        e.Department.Name,
                        e.Department.Description,
                        weeklyOff,
                        e.Department.IsActive
                    );
                }

                // Build a lightweight manager representation
                object? managerObj = null;
                if (e.Manager != null)
                {
                    managerObj = new
                    {
                        Id = e.Manager.Id.ToString(),
                        e.Manager.FirstName,
                        e.Manager.LastName
                    };
                }

                return new EmployeeDto(
                    e.Id.ToString(),
                    e.UserId,
                    e.EmployeeId,
                    e.FirstName,
                    e.LastName,
                    e.DepartmentId?.ToString(),
                    e.Department?.Name,
                    deptDto,
                    e.ManagerId?.ToString(),
                    managerObj,
                    e.User?.Email,
                    e.User?.IsActive ?? false,
                    e.PhoneNumber
                );
            }).ToList();
        }

        public async Task<HashSet<int>?> GetManagerTeamUserIdsAsync(Guid managerEmployeeId)
        {
            var employees = await _userService.GetAllEmployeesAsync();
            if (employees == null)
                return null;

            var teamUserIds = employees
                .Where(e => e.ManagerId.HasValue && e.ManagerId.Value == managerEmployeeId)
                .Select(e => e.UserId)
                .ToHashSet();

            return teamUserIds;
        }

        public async Task<List<TeamMemberDto>> BuildTeamMemberDtosExcludingSystemAdminsAsync(IEnumerable<EmployeeDto> employees)
        {
            var tasks = employees.Select(async e =>
            {
                try
                {
                    var role = await _userService.GetUserRoleAsync(e.UserId, "attendance");
                    if (string.Equals(role, "SystemAdmin", StringComparison.OrdinalIgnoreCase))
                        return null;

                    return new TeamMemberDto
                    {
                        Id = Guid.NewGuid(),
                        EmployeeId = e.EmployeeId ?? string.Empty,
                        FirstName = e.FirstName ?? string.Empty,
                        LastName = e.LastName ?? string.Empty,
                        Email = e.Email ?? string.Empty
                    };
                }
                catch (Exception ex)
                {
                    // If role lookup fails, include the user to avoid accidental omission; log at debug
                    _logger.LogDebug(ex, "Failed to resolve role for user {UserId} while building team members; including user by default", e.UserId);
                    return new TeamMemberDto
                    {
                        Id = Guid.NewGuid(),
                        EmployeeId = e.EmployeeId ?? string.Empty,
                        FirstName = e.FirstName ?? string.Empty,
                        LastName = e.LastName ?? string.Empty,
                        Email = e.Email ?? string.Empty
                    };
                }
            });

            var results = await Task.WhenAll(tasks);
            return results.Where(r => r != null).Select(r => r!).ToList();
        }
    }
}
