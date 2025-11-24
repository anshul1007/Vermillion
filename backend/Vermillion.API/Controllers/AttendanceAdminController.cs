using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vermillion.Attendance.Domain.Data;
using Vermillion.Attendance.Domain.Models.DTOs;
using Vermillion.Attendance.Domain.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Vermillion.Attendance.Domain.Services;
using Vermillion.Auth.Domain.Services;

namespace Vermillion.API.Controllers
{
    [ApiController]
    [Route("api/attendance/admin")]
    [Authorize]
    public class AttendanceAdminController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly AttendanceDbContext _db;
        private readonly ILogger<AttendanceAdminController> _logger;
        private readonly ICurrentUserService _currentUserService;
        private readonly ITeamManagementHelper _teamHelper;

        public AttendanceAdminController(
            IUserService userService,
            AttendanceDbContext db,
            ILogger<AttendanceAdminController> logger,
            ICurrentUserService currentUserService,
            ITeamManagementHelper teamHelper)
        {
            _userService = userService;
            _db = db;
            _logger = logger;
            _currentUserService = currentUserService;
            _teamHelper = teamHelper;
        }

        // Helper: returns set of userIds that report to the current manager, or null if employees fetch fails
        private async Task<HashSet<int>?> GetManagerTeamUserIdsAsync()
        {
            var callerUserId = _currentUserService.GetCurrentUserId();
            if (!callerUserId.HasValue)
                return new HashSet<int>(); // caller authorized earlier, return empty to result in no records

            // Get all employees to find the caller's Employee GUID
            var allEmployees = await _teamHelper.GetAllEmployeesAsync();
            if (allEmployees == null)
                return new HashSet<int>();

            var callerEmployee = allEmployees.FirstOrDefault(e => e.UserId == callerUserId.Value);
            if (callerEmployee == null || !Guid.TryParse(callerEmployee.Id, out var callerEmployeeGuid))
                return new HashSet<int>();

            return await _teamHelper.GetManagerTeamUserIdsAsync(callerEmployeeGuid);
        }

        // Build TeamMemberDto list but exclude any users who have the SystemAdmin role in AuthAPI
        private async Task<List<TeamMemberDto>> BuildTeamMemberDtosExcludingSystemAdminsAsync(IEnumerable<EmployeeDto> employees)
        {
            return await _teamHelper.BuildTeamMemberDtosExcludingSystemAdminsAsync(employees);
        }

        [HttpGet("users")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                var employees = await _teamHelper.GetAllEmployeesAsync();
                if (employees == null)
                    return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch users"));

                // Filter out users based on their roles and include role information
                var filteredEmployees = new List<EmployeeWithRoleDto>();

                foreach (var employee in employees)
                {
                    // Get the user's role in the Attendance tenant
                    var userRole = await _userService.GetUserRoleAsync(employee.UserId, "attendance");

                    // Skip if role fetch failed or user has no role
                    if (string.IsNullOrEmpty(userRole))
                        continue;

                    // Exclude Guards and SystemAdmins - they don't use attendance system
                    if (userRole.Equals("Guard", StringComparison.OrdinalIgnoreCase) ||
                        userRole.Equals("SystemAdmin", StringComparison.OrdinalIgnoreCase))
                        continue;

                    // Create EmployeeWithRoleDto including the role information
                    filteredEmployees.Add(new EmployeeWithRoleDto(
                        employee.Id,
                        employee.UserId,
                        employee.EmployeeId,
                        employee.FirstName,
                        employee.LastName,
                        employee.DepartmentId,
                        employee.DepartmentName,
                        employee.Department,
                        employee.ManagerId,
                        employee.Manager,
                        employee.Email,
                        employee.IsActive,
                        employee.PhoneNumber,
                        userRole
                    ));
                }

                return Ok(ApiResponse<List<EmployeeWithRoleDto>>.SuccessResponse(filteredEmployees));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching users");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Update user details including employee information
        /// </summary>
        [HttpPut("users/{userId}")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> UpdateUser(Guid userId, [FromBody] UpdateUserRequest request)
        {
            try
            {
                // First, get the employee to find their actual User ID
                var employees = await _teamHelper.GetAllEmployeesAsync();
                if (employees == null)
                    return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch employees"));

                var employee = employees.FirstOrDefault(e => e.Id == userId.ToString());
                if (employee == null)
                    return NotFound(ApiResponse<object>.ErrorResponse($"Employee {userId} not found"));

                // Parse nullable Guid fields
                Guid? managerId = request.ManagerId.HasValue && Guid.TryParse(request.ManagerId.ToString(), out var managerGuid)
                    ? managerGuid
                    : null;

                Guid? departmentId = request.DepartmentId.HasValue && Guid.TryParse(request.DepartmentId.ToString(), out var deptGuid)
                    ? deptGuid
                    : null;

                // Update user using UserService
                var updateResponse = await _userService.UpdateUserAsync(
                    employee.UserId,
                    request.Email,
                    request.FirstName,
                    request.LastName,
                    request.PhoneNumber,
                    request.Role,
                    managerId,
                    departmentId,
                    request.IsActive
                );

                if (!updateResponse)
                    return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to update user"));

                // Fetch updated employee data
                var updatedEmployees = await _teamHelper.GetAllEmployeesAsync();
                if (updatedEmployees == null)
                    return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch updated user"));

                var updatedEmployee = updatedEmployees.FirstOrDefault(e => e.Id == userId.ToString());
                if (updatedEmployee == null)
                    return NotFound(ApiResponse<object>.ErrorResponse($"User {userId} not found"));

                // Get the user's role
                var userRole = await _userService.GetUserRoleAsync(updatedEmployee.UserId, "attendance");

                // Create EmployeeWithRoleDto including the role information
                var result = new EmployeeWithRoleDto(
                    updatedEmployee.Id,
                    updatedEmployee.UserId,
                    updatedEmployee.EmployeeId,
                    updatedEmployee.FirstName,
                    updatedEmployee.LastName,
                    updatedEmployee.DepartmentId,
                    updatedEmployee.DepartmentName,
                    updatedEmployee.Department,
                    updatedEmployee.ManagerId,
                    updatedEmployee.Manager,
                    updatedEmployee.Email,
                    updatedEmployee.IsActive,
                    updatedEmployee.PhoneNumber,
                    userRole
                );

                return Ok(ApiResponse<EmployeeWithRoleDto>.SuccessResponse(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user {UserId}", userId);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpGet("departments")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> GetDepartments()
        {
            var departments = await _userService.GetAllDepartmentsAsync();
            if (departments == null)
                return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch departments"));

            // Convert to DTOs
            var data = departments.Select(d => new DepartmentDto(
                Id: d.Id.ToString(),
                Name: d.Name,
                Description: d.Description,
                WeeklyOffDays: d.WeeklyOffDays != null ? d.WeeklyOffDays.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Length>0).ToList() : null,
                IsActive: d.IsActive
            )).ToList();

            return Ok(ApiResponse<List<DepartmentDto>>.SuccessResponse(data));
        }

        // Accept weeklyOffDays as either array or comma-separated string
        public class DepartmentRequest
        {
            public string? Name { get; set; }
            public string? Description { get; set; }
            public object? WeeklyOffDays { get; set; }
            public bool? IsActive { get; set; }
        }

        private List<string>? NormalizeWeeklyOffDays(object? value)
        {
            if (value == null) return null;
            try
            {
                // If it's already a simple string
                if (value is string s)
                {
                    if (string.IsNullOrWhiteSpace(s)) return new List<string>();
                    return s.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
                }

                // Serialize and parse to handle JsonElement/arrays
                var json = System.Text.Json.JsonSerializer.Serialize(value);
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    var parts = new List<string>();
                    foreach (var el in doc.RootElement.EnumerateArray())
                    {
                        if (el.ValueKind == System.Text.Json.JsonValueKind.String)
                            parts.Add(el.GetString() ?? string.Empty);
                        else
                            parts.Add(el.ToString());
                    }
                    return parts.Where(p => !string.IsNullOrWhiteSpace(p)).ToList();
                }
            }
            catch { }

            // Fallback to string conversion
            var asStr = value.ToString();
            if (string.IsNullOrWhiteSpace(asStr)) return new List<string>();
            return asStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        }

        [HttpPost("departments")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> CreateDepartment([FromBody] DepartmentRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse<object>.ErrorResponse("Invalid request"));

            var weekly = NormalizeWeeklyOffDays(request.WeeklyOffDays);
            string? weeklyOffDaysStr = weekly != null ? string.Join(",", weekly) : null;

            var department = new Vermillion.Auth.Domain.Models.Entities.Department
            {
                Name = request.Name ?? string.Empty,
                Description = request.Description,
                WeeklyOffDays = weeklyOffDaysStr ?? string.Empty,
                IsActive = request.IsActive ?? true
            };

            var created = await _userService.CreateDepartmentAsync(department);

            var dto = new DepartmentDto(
                Id: created.Id.ToString(),
                Name: created.Name,
                Description: created.Description,
                WeeklyOffDays: created.WeeklyOffDays != null ? created.WeeklyOffDays.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Length>0).ToList() : null,
                IsActive: created.IsActive
            );

            return Ok(ApiResponse<DepartmentDto>.SuccessResponse(dto, "Department created"));
        }

        [HttpPut("departments/{id}")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> UpdateDepartment(string id, [FromBody] DepartmentDto request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ApiResponse<object>.ErrorResponse("Invalid request"));

            if (!Guid.TryParse(id, out var departmentId))
                return BadRequest(ApiResponse<object>.ErrorResponse("Invalid department ID"));

            string? weeklyOffDaysStr = request.WeeklyOffDays != null ? string.Join(",", request.WeeklyOffDays) : null;

            var department = new Vermillion.Auth.Domain.Models.Entities.Department
            {
                Id = departmentId,
                Name = request.Name ?? string.Empty,
                Description = request.Description,
                WeeklyOffDays = weeklyOffDaysStr ?? string.Empty,
                IsActive = request.IsActive
            };

            var updated = await _userService.UpdateDepartmentAsync(departmentId, department);
            if (updated == null)
                return NotFound(ApiResponse<object>.ErrorResponse("Department not found"));

            var dto = new DepartmentDto(
                Id: updated.Id.ToString(),
                Name: updated.Name,
                Description: updated.Description,
                WeeklyOffDays: updated.WeeklyOffDays != null ? updated.WeeklyOffDays.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Length>0).ToList() : null,
                IsActive: updated.IsActive
            );

            return Ok(ApiResponse<DepartmentDto>.SuccessResponse(dto, "Department updated"));
        }

        [HttpDelete("departments/{id}")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> DeleteDepartment(string id)
        {
            if (!Guid.TryParse(id, out var departmentId))
                return BadRequest(ApiResponse<object>.ErrorResponse("Invalid department ID"));

            var success = await _userService.DeleteDepartmentAsync(departmentId);
            if (!success)
                return NotFound(ApiResponse<object>.ErrorResponse("Department not found"));

            return Ok(new ApiResponse<object> { Success = true, Data = default, Message = "Department deleted" });
        }

        // Public Holiday endpoints
        [HttpGet("holidays")]
        public async Task<IActionResult> GetPublicHolidays([FromQuery] int? year)
        {
            try
            {
                var yearParam = year ?? DateTime.UtcNow.Year;
                var holidays = await _db.PublicHolidays
                    .AsNoTracking()
                    .Where(h => h.Year == yearParam && h.IsActive)
                    .OrderBy(h => h.Date)
                    .ToListAsync();

                var dtos = holidays.Select(h => new PublicHolidayDto
                {
                    Id = h.Id,
                    Date = h.Date,
                    Name = h.Name,
                    Description = h.Description,
                    Year = h.Year,
                    IsActive = h.IsActive
                }).ToList();

                return Ok(ApiResponse<List<PublicHolidayDto>>.SuccessResponse(dtos));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching public holidays");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpPost("holidays")]
        // Allow both Admin (HR) and SystemAdmin to create holidays
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> CreatePublicHoliday([FromBody] CreatePublicHolidayRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ApiResponse<object>.ErrorResponse("Invalid request"));

                // Prevent duplicate by date
                var exists = await _db.PublicHolidays.AnyAsync(h => h.Date == request.Date && h.IsActive);
                if (exists)
                    return Conflict(ApiResponse<object>.ErrorResponse("A public holiday already exists for the specified date"));

                var ph = new PublicHoliday
                {
                    Date = request.Date,
                    Name = request.Name,
                    Description = request.Description,
                    Year = request.Date.Year,
                    IsActive = true
                };

                _db.PublicHolidays.Add(ph);
                await _db.SaveChangesAsync();

                var dto = new PublicHolidayDto
                {
                    Id = ph.Id,
                    Date = ph.Date,
                    Name = ph.Name,
                    Description = ph.Description,
                    Year = ph.Year,
                    IsActive = ph.IsActive
                };

                return Ok(ApiResponse<PublicHolidayDto>.SuccessResponse(dto, "Public holiday created"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating public holiday");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpDelete("holidays/{id}")]
        // Allow both Admin (HR) and SystemAdmin to delete holidays
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> DeletePublicHoliday(Guid id)
        {
            try
            {
                var ph = await _db.PublicHolidays.FindAsync(id);
                if (ph == null)
                    return NotFound(ApiResponse<object>.ErrorResponse("Public holiday not found"));

                // Mark as inactive instead of deleting to preserve history
                ph.IsActive = false;
                _db.PublicHolidays.Update(ph);
                await _db.SaveChangesAsync();

                return Ok(new ApiResponse<object> { Success = true, Data = default, Message = "Public holiday deactivated" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting public holiday");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        // Pending attendance approvals for a given date - accessible to Managers and Admins
        [HttpGet("attendance/pending")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> GetPendingAttendance([FromQuery] DateTime? date)
        {
            try
            {
                var target = date.HasValue ? DateOnly.FromDateTime(date.Value) : DateOnly.FromDateTime(DateTime.UtcNow);
                var query = _db.Attendances
                    .AsNoTracking()
                    .Where(a => a.Date == target && a.Status == ApprovalStatus.Pending)
                    .OrderBy(a => a.LoginTime)
                    .AsQueryable();

                // If caller is a Manager, limit results to their direct reports only
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch users from AuthAPI"));

                    query = query.Where(a => teamUserIds.Contains(a.UserId));
                }

                var records = await query.ToListAsync();

                var dtos = records.Select(att => new AttendanceDto
                {
                    Id = att.Id,
                    UserId = att.UserId,
                    UserName = string.Empty,
                    EmployeeId = string.Empty,
                    LoginTime = att.LoginTime,
                    LogoutTime = att.LogoutTime,
                    Date = att.Date,
                    IsWeekend = att.IsWeekend,
                    IsPublicHoliday = att.IsPublicHoliday,
                    Status = att.Status.ToString(),
                    ApproverName = null,
                    ApprovedAt = att.ApprovedAt,
                    WorkDuration = att.LogoutTime.HasValue ? att.LogoutTime.Value - att.LoginTime : (TimeSpan?)null
                }).ToList();

                return Ok(ApiResponse<List<AttendanceDto>>.SuccessResponse(dtos));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pending attendance");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Approve an attendance record
        /// </summary>
        [HttpPost("attendance/{attendanceId}/approve")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> ApproveAttendance(Guid attendanceId)
        {
            try
            {
                var attendance = await _db.Attendances.FindAsync(attendanceId);
                if (attendance == null)
                    return NotFound(ApiResponse<object>.ErrorResponse($"Attendance record {attendanceId} not found"));

                // Check if already processed
                if (attendance.Status != ApprovalStatus.Pending)
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Attendance already {attendance.Status}"));

                // Get current user ID
                var currentUserId = _currentUserService.GetCurrentUserId();
                if (!currentUserId.HasValue)
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));

                // Approve the attendance
                attendance.Status = ApprovalStatus.Approved;
                attendance.ApprovedBy = currentUserId.Value;
                attendance.ApprovedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<bool>.SuccessResponse(true, "Attendance approved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving attendance {AttendanceId}", attendanceId);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Reject an attendance record
        /// </summary>
        [HttpPost("attendance/{attendanceId}/reject")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> RejectAttendance(Guid attendanceId)
        {
            try
            {
                var attendance = await _db.Attendances.FindAsync(attendanceId);
                if (attendance == null)
                    return NotFound(ApiResponse<object>.ErrorResponse($"Attendance record {attendanceId} not found"));

                // Check if already processed
                if (attendance.Status != ApprovalStatus.Pending)
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Attendance already {attendance.Status}"));

                // Get current user ID
                var currentUserId = _currentUserService.GetCurrentUserId();
                if (!currentUserId.HasValue)
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));

                // Reject the attendance (note: Attendance entity doesn't have RejectionReason field)
                attendance.Status = ApprovalStatus.Rejected;
                attendance.ApprovedBy = currentUserId.Value;  // Track who rejected it
                attendance.ApprovedAt = DateTime.UtcNow;      // Track when it was rejected

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<bool>.SuccessResponse(true, "Attendance rejected successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting attendance {AttendanceId}", attendanceId);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        // Pending leave requests - accessible to Managers and Admins
        [HttpGet("leave/pending")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> GetPendingLeaveRequests()
        {
            try
            {
                var query = _db.LeaveRequests
                    .AsNoTracking()
                    .Where(l => l.Status == ApprovalStatus.Pending)
                    .OrderBy(l => l.CreatedAt)
                    .AsQueryable();

                // If caller is a Manager, limit to their direct reports
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch users from AuthAPI"));

                    query = query.Where(l => teamUserIds.Contains(l.UserId));
                }

                var pending = await query.ToListAsync();

                var dtos = pending.Select(l => new LeaveRequestResponse
                {
                    Id = l.Id,
                    UserId = l.UserId,
                    UserName = string.Empty,
                    EmployeeId = string.Empty,
                    LeaveType = l.LeaveType.ToString(),
                    StartDate = l.StartDate,
                    EndDate = l.EndDate,
                    TotalDays = l.TotalDays,
                    Reason = l.Reason,
                    Status = l.Status.ToString(),
                    ApproverName = null,
                    ApprovedAt = l.ApprovedAt,
                    RejectionReason = l.RejectionReason,
                    CreatedAt = l.CreatedAt
                }).ToList();

                return Ok(ApiResponse<List<LeaveRequestResponse>>.SuccessResponse(dtos));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pending leave requests");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Approve or reject a leave request
        /// </summary>
        [HttpPost("leave/approve")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> ApproveOrRejectLeave([FromBody] ApproveLeaveRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ApiResponse<object>.ErrorResponse("Invalid request"));

                var leaveRequest = await _db.LeaveRequests.FindAsync(request.LeaveRequestId);
                if (leaveRequest == null)
                    return NotFound(ApiResponse<object>.ErrorResponse($"Leave request {request.LeaveRequestId} not found"));

                // Check if already processed
                if (leaveRequest.Status != ApprovalStatus.Pending)
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Leave request already {leaveRequest.Status}"));

                // Get current user ID
                var currentUserId = _currentUserService.GetCurrentUserId();
                if (!currentUserId.HasValue)
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));

                // Update status
                if (request.Approved)
                {
                    leaveRequest.Status = ApprovalStatus.Approved;
                    leaveRequest.ApprovedBy = currentUserId.Value;
                    leaveRequest.ApprovedAt = DateTime.UtcNow;

                    // Deduct from leave balance
                    var year = leaveRequest.StartDate.Year;
                    var entitlement = await _db.LeaveEntitlements
                        .FirstOrDefaultAsync(e => e.UserId == leaveRequest.UserId && e.Year == year);

                    if (entitlement != null)
                    {
                        switch (leaveRequest.LeaveType)
                        {
                            case LeaveType.CasualLeave:
                                entitlement.CasualLeaveBalance -= leaveRequest.TotalDays;
                                break;
                            case LeaveType.EarnedLeave:
                                entitlement.EarnedLeaveBalance -= leaveRequest.TotalDays;
                                break;
                            case LeaveType.CompensatoryOff:
                                entitlement.CompensatoryOffBalance -= leaveRequest.TotalDays;
                                break;
                        }
                        entitlement.UpdatedAt = DateTime.UtcNow;
                    }
                }
                else
                {
                    leaveRequest.Status = ApprovalStatus.Rejected;
                    leaveRequest.RejectionReason = request.RejectionReason;
                    leaveRequest.ApprovedBy = currentUserId.Value;  // Track who rejected it
                    leaveRequest.ApprovedAt = DateTime.UtcNow;      // Track when it was rejected
                }

                leaveRequest.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                return Ok(ApiResponse<bool>.SuccessResponse(true, $"Leave request {(request.Approved ? "approved" : "rejected")} successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing leave request");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        // Team members for a manager. If managerId not provided, uses caller's user id.
        [HttpGet("team-members")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> GetTeamMembers([FromQuery] string? managerId)
        {
            try
            {
                // Determine caller id from claims
                var callerId = _currentUserService.GetCurrentUserId();
                if (!callerId.HasValue)
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));

                var data = await _teamHelper.GetAllEmployeesAsync();
                if (data == null)
                    return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch users"));

                if ((User.IsInRole("Admin") || User.IsInRole("SystemAdmin")) && string.IsNullOrEmpty(managerId))
                {
                    var all = await BuildTeamMemberDtosExcludingSystemAdminsAsync(data);
                    return Ok(ApiResponse<List<TeamMemberDto>>.SuccessResponse(all));
                }

                var effectiveManagerId = managerId ?? callerId.Value.ToString();

                // If requesting another manager's team, ensure caller is Admin or SystemAdmin
                if (!string.IsNullOrEmpty(managerId) && managerId != callerId.Value.ToString() && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                    return Forbid();

                var filtered = data.Where(e => !string.IsNullOrEmpty(e.ManagerId) && e.ManagerId == effectiveManagerId);
                var list = await BuildTeamMemberDtosExcludingSystemAdminsAsync(filtered);

                return Ok(ApiResponse<List<TeamMemberDto>>.SuccessResponse(list));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching team members");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        // Attendance history for admins/managers across users
        [HttpGet("attendance/history")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> GetAttendanceHistory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            try
            {
                var end = endDate?.Date ?? DateTime.UtcNow.Date;
                var start = startDate?.Date ?? end.AddDays(-30);

                var query = _db.Attendances.AsNoTracking().AsQueryable();
                query = query.Where(a => a.Date >= DateOnly.FromDateTime(start) && a.Date <= DateOnly.FromDateTime(end));

                // Manager should see only their team members unless they are Admin/SystemAdmin
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch users from AuthAPI"));

                    if (userId.HasValue)
                    {
                        // If requesting a specific user's history, ensure that user is in manager's team
                        if (!teamUserIds.Contains(userId.Value))
                            return Forbid();

                        query = query.Where(a => a.UserId == userId.Value);
                    }
                    else
                    {
                        query = query.Where(a => teamUserIds.Contains(a.UserId));
                    }
                }
                else
                {
                    if (userId.HasValue)
                        query = query.Where(a => a.UserId == userId.Value);
                }

                // validate paging
                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 500);
                var skip = (page - 1) * pageSize;

                var records = await query.OrderByDescending(a => a.Date).Skip(skip).Take(pageSize).ToListAsync();

                var dtos = records.Select(att => new AttendanceDto
                {
                    Id = att.Id,
                    UserId = att.UserId,
                    UserName = string.Empty,
                    EmployeeId = string.Empty,
                    LoginTime = att.LoginTime,
                    LogoutTime = att.LogoutTime,
                    Date = att.Date,
                    IsWeekend = att.IsWeekend,
                    IsPublicHoliday = att.IsPublicHoliday,
                    Status = att.Status.ToString(),
                    ApproverName = null,
                    ApprovedAt = att.ApprovedAt,
                    WorkDuration = att.LogoutTime.HasValue ? att.LogoutTime.Value - att.LoginTime : (TimeSpan?)null
                }).ToList();

                return Ok(ApiResponse<List<AttendanceDto>>.SuccessResponse(dtos));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching attendance history");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        // Leave history for admins/managers across users
        [HttpGet("leave/history")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> GetLeaveHistory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            try
            {
                var end = endDate?.Date ?? DateTime.UtcNow.Date;
                var start = startDate?.Date ?? end.AddDays(-90);

                var query = _db.LeaveRequests.AsNoTracking().AsQueryable();
                query = query.Where(l => l.StartDate >= DateOnly.FromDateTime(start) && l.StartDate <= DateOnly.FromDateTime(end));

                // Manager should see only their team members unless they are Admin/SystemAdmin
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch users from AuthAPI"));

                    if (userId.HasValue)
                    {
                        if (!teamUserIds.Contains(userId.Value))
                            return Forbid();

                        query = query.Where(l => l.UserId == userId.Value);
                    }
                    else
                    {
                        query = query.Where(l => teamUserIds.Contains(l.UserId));
                    }
                }
                else
                {
                    if (userId.HasValue)
                        query = query.Where(l => l.UserId == userId.Value);
                }

                page = Math.Max(1, page);
                pageSize = Math.Clamp(pageSize, 1, 500);
                var skip = (page - 1) * pageSize;

                var records = await query.OrderByDescending(l => l.CreatedAt).Skip(skip).Take(pageSize).ToListAsync();

                var dtos = records.Select(l => new LeaveRequestResponse
                {
                    Id = l.Id,
                    UserId = l.UserId,
                    UserName = string.Empty,
                    EmployeeId = string.Empty,
                    LeaveType = l.LeaveType.ToString(),
                    StartDate = l.StartDate,
                    EndDate = l.EndDate,
                    TotalDays = l.TotalDays,
                    Reason = l.Reason,
                    Status = l.Status.ToString(),
                    ApproverName = null,
                    ApprovedAt = l.ApprovedAt,
                    RejectionReason = l.RejectionReason,
                    CreatedAt = l.CreatedAt
                }).ToList();

                return Ok(ApiResponse<List<LeaveRequestResponse>>.SuccessResponse(dtos));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching leave history");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        // Allocate leave entitlement (Admin UI) - upsert per user-year
        [HttpPost("leave-entitlement")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> AllocateLeaveEntitlement([FromBody] AllocateLeaveEntitlementRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ApiResponse<object>.ErrorResponse("Invalid request"));

                int userId;
                
                // Check if the userId is a GUID (Employee.Id) or an integer (User.Id)
                if (Guid.TryParse(request.UserId, out var employeeGuid))
                {
                    // It's an Employee GUID, need to look up the User.Id
                    var employees = await _teamHelper.GetAllEmployeesAsync();
                    if (employees == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch employees"));

                    var employee = employees.FirstOrDefault(e => e.Id == request.UserId);
                    if (employee == null)
                        return NotFound(ApiResponse<object>.ErrorResponse($"Employee {request.UserId} not found"));

                    userId = employee.UserId;
                }
                else if (!int.TryParse(request.UserId, out userId))
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse("Invalid userId format"));
                }

                // Upsert: try to find an existing entitlement row for the same user and year.
                // The LeaveEntitlement entity doesn't have an explicit Year column, so we use CreatedAt/UpdatedAt year as the marker.
                var existing = await _db.LeaveEntitlements
                    .Where(e => e.UserId == userId && e.Year == request.Year)
                    .OrderByDescending(e => e.UpdatedAt)
                    .FirstOrDefaultAsync();

                if (existing != null)
                {
                    // Update existing record
                    existing.CasualLeaveBalance = request.CasualLeaveBalance;
                    existing.EarnedLeaveBalance = request.EarnedLeaveBalance;
                    existing.CompensatoryOffBalance = request.CompensatoryOffBalance;
                    existing.UpdatedAt = DateTime.UtcNow;

                    _db.LeaveEntitlements.Update(existing);
                }
                else
                {
                    // Create a new entitlement entry (year is inferred from CreatedAt)
                    var entitlement = new LeaveEntitlement
                    {
                        UserId = userId,
                        LeaveType = LeaveType.CasualLeave, // placeholder; entity keeps balances rather than per-type rows
                        CasualLeaveBalance = request.CasualLeaveBalance,
                        EarnedLeaveBalance = request.EarnedLeaveBalance,
                        CompensatoryOffBalance = request.CompensatoryOffBalance,
                        Year = request.Year,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _db.LeaveEntitlements.Add(entitlement);
                }
                await _db.SaveChangesAsync();

                return Ok(ApiResponse<bool>.SuccessResponse(true, "Leave entitlement allocated"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error allocating leave entitlement");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        // Get leave entitlement for a user for a year
        [HttpGet("leave-entitlement/{userId}")]
        [Authorize(Roles = "Admin,SystemAdmin")]
        public async Task<IActionResult> GetLeaveEntitlement(string userId, [FromQuery] int? year)
        {
            try
            {
                if (!int.TryParse(userId, out var uid))
                    return BadRequest(ApiResponse<object>.ErrorResponse("Invalid userId"));

                var targetYear = year ?? DateTime.UtcNow.Year;

                // Find an entitlement for the requested year (match CreatedAt or UpdatedAt year)
                var ent = await _db.LeaveEntitlements
                    .AsNoTracking()
                    .Where(e => e.UserId == uid && e.Year == targetYear)
                    .OrderByDescending(e => e.UpdatedAt)
                    .FirstOrDefaultAsync();

                if (ent == null)
                {
                    // Return default zeros if not found
                    var empty = new LeaveEntitlementDto
                    {
                        UserId = userId,
                        Year = targetYear,
                        CasualLeaveBalance = 0m,
                        EarnedLeaveBalance = 0m,
                        CompensatoryOffBalance = 0m
                    };
                    return Ok(ApiResponse<LeaveEntitlementDto>.SuccessResponse(empty));
                }

                var dto = new LeaveEntitlementDto
                {
                    UserId = userId,
                    Year = targetYear,
                    CasualLeaveBalance = ent.CasualLeaveBalance,
                    EarnedLeaveBalance = ent.EarnedLeaveBalance,
                    CompensatoryOffBalance = ent.CompensatoryOffBalance
                };

                return Ok(ApiResponse<LeaveEntitlementDto>.SuccessResponse(dto));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching leave entitlement");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }
    }
}
