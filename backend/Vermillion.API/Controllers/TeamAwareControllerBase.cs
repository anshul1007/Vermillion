using Microsoft.AspNetCore.Mvc;
using Vermillion.Attendance.Domain.Services;

namespace Vermillion.API.Controllers;

/// <summary>
/// Base controller for controllers that need team management functionality
/// Provides common helper methods to avoid code duplication
/// </summary>
public abstract class TeamAwareControllerBase : ControllerBase
{
    protected readonly ITeamManagementHelper _teamHelper;
    protected readonly ICurrentUserService _currentUserService;

    protected TeamAwareControllerBase(
        ITeamManagementHelper teamHelper,
        ICurrentUserService currentUserService)
    {
        _teamHelper = teamHelper;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Gets the set of user IDs that report to the current manager
    /// Returns null if the employees fetch fails
    /// Returns empty set if the current user has no valid employee record
    /// </summary>
    protected async Task<HashSet<int>?> GetManagerTeamUserIdsAsync()
    {
        var callerUserId = _currentUserService.GetCurrentUserId();
        if (!callerUserId.HasValue)
            return new HashSet<int>(); // caller authorized earlier, return empty to result in no records

        // Get all employees to find the caller's Employee GUID
        var allEmployees = await _teamHelper.GetAllEmployeesAsync();
        if (allEmployees == null)
            return null; // Service failure

        var callerEmployee = allEmployees.FirstOrDefault(e => e.UserId == callerUserId.Value);
        if (callerEmployee == null || !Guid.TryParse(callerEmployee.Id, out var callerEmployeeGuid))
            return new HashSet<int>(); // No valid employee record

        return await _teamHelper.GetManagerTeamUserIdsAsync(callerEmployeeGuid);
    }

    /// <summary>
    /// Gets the employee GUID from a user ID
    /// Used for resolving manager relationships
    /// </summary>
    protected async Task<Guid?> GetEmployeeGuidFromUserIdAsync(int userId)
    {
        var allEmployees = await _teamHelper.GetAllEmployeesAsync();
        if (allEmployees == null)
            return null;

        var employee = allEmployees.FirstOrDefault(e => e.UserId == userId);
        if (employee == null || !Guid.TryParse(employee.Id, out var employeeGuid))
            return null;

        return employeeGuid;
    }
}
