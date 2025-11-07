using AttendanceAPI.Models.DTOs;
using Microsoft.Extensions.Logging;

namespace AttendanceAPI.Services
{
    public interface ITeamManagementHelper
    {
        Task<HashSet<int>?> GetManagerTeamUserIdsAsync(int managerId);
        Task<List<TeamMemberDto>> BuildTeamMemberDtosExcludingSystemAdminsAsync(IEnumerable<EmployeeDto> employees);
        Task<List<EmployeeDto>?> GetAllEmployeesAsync();
    }

    public class TeamManagementHelper : ITeamManagementHelper
    {
        private readonly IAuthApiClient _authClient;
        private readonly ILogger<TeamManagementHelper> _logger;

        public TeamManagementHelper(IAuthApiClient authClient, ILogger<TeamManagementHelper> logger)
        {
            _authClient = authClient;
            _logger = logger;
        }

        /// <summary>
        /// Gets all employees from AuthAPI (with caching)
        /// </summary>
        public async Task<List<EmployeeDto>?> GetAllEmployeesAsync()
        {
            return await _authClient.GetAllEmployeesAsync();
        }

        /// <summary>
        /// Returns set of userIds that report to the specified manager, or null if employees fetch fails
        /// </summary>
        public async Task<HashSet<int>?> GetManagerTeamUserIdsAsync(int managerId)
        {
            var employees = await _authClient.GetAllEmployeesAsync();
            if (employees == null)
                return null;

            var teamUserIds = employees
                .Where(e => !string.IsNullOrEmpty(e.ManagerId) && e.ManagerId == managerId.ToString())
                .Select(e => e.UserId)
                .ToHashSet();

            return teamUserIds;
        }

        /// <summary>
        /// Build TeamMemberDto list but exclude any users who have the SystemAdmin role in AuthAPI
        /// </summary>
        public async Task<List<TeamMemberDto>> BuildTeamMemberDtosExcludingSystemAdminsAsync(IEnumerable<EmployeeDto> employees)
        {
            var tasks = employees.Select(async e =>
            {
                try
                {
                    var role = await _authClient.GetUserRoleAsync(e.UserId);
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
