using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AttendanceAPI.Data;
using AttendanceAPI.Models.DTOs;
using AttendanceAPI.Models.Entities;
using AttendanceAPI.Services;

namespace AttendanceAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Manager,Admin,SystemAdmin")]
    public class ApprovalController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUserService;
        private readonly ILogger<ApprovalController> _logger;
        private readonly ITeamManagementHelper _teamHelper;

        public ApprovalController(
            ApplicationDbContext db,
            ICurrentUserService currentUserService,
            ILogger<ApprovalController> logger,
            ITeamManagementHelper teamHelper)
        {
            _db = db;
            _currentUserService = currentUserService;
            _logger = logger;
            _teamHelper = teamHelper;
        }

        // Helper: returns set of userIds that report to the current manager, or null if employees fetch fails
        private async Task<HashSet<int>?> GetManagerTeamUserIdsAsync()
        {
            var callerId = _currentUserService.GetCurrentUserId();
            if (!callerId.HasValue)
                return new HashSet<int>(); // caller authorized earlier, return empty to result in no records

            return await _teamHelper.GetManagerTeamUserIdsAsync(callerId.Value);
        }

        // Build TeamMemberDto list but exclude any users who have the SystemAdmin role in AuthAPI
        private async Task<List<TeamMemberDto>> BuildTeamMemberDtosExcludingSystemAdminsAsync(IEnumerable<EmployeeDto> employees)
        {
            return await _teamHelper.BuildTeamMemberDtosExcludingSystemAdminsAsync(employees);
        }

        [HttpGet("attendance/pending")]
        public async Task<IActionResult> GetPendingAttendance([FromQuery] DateTime? date)
        {
            try
            {
                var target = date.HasValue ? DateOnly.FromDateTime(date.Value) : DateOnly.FromDateTime(DateTime.UtcNow);
                var query = _db.Attendance
                    .AsNoTracking()
                    .Where(a => a.Date == target && a.Status == ApprovalStatus.Pending)
                    .OrderBy(a => a.LoginTime)
                    .AsQueryable();

                // If caller is a Manager (not Admin/SystemAdmin), limit to their team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch team members"));

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

        [HttpPost("attendance/{id}/approve")]
        public async Task<IActionResult> ApproveAttendance(Guid id)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var attendance = await _db.Attendance.FindAsync(id);
                if (attendance == null)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Attendance record not found"));
                }

                // If Manager, verify the user is in their team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null || !teamUserIds.Contains(attendance.UserId))
                    {
                        return Forbid();
                    }
                }

                if (attendance.Status != ApprovalStatus.Pending)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Cannot approve attendance with status: {attendance.Status}"));
                }

                attendance.Status = ApprovalStatus.Approved;
                attendance.ApprovedBy = userId.Value;
                attendance.ApprovedAt = DateTime.UtcNow;
                attendance.UpdatedAt = DateTime.UtcNow;

                // If worked on weekend/holiday for 4+ hours, add compensatory off
                if ((attendance.IsWeekend || attendance.IsPublicHoliday) && attendance.LogoutTime.HasValue)
                {
                    var duration = attendance.LogoutTime.Value - attendance.LoginTime;
                    if (duration.TotalHours >= 4)
                    {
                        var entitlement = await _db.LeaveEntitlements
                            .Where(e => e.UserId == attendance.UserId && e.Year == DateTime.UtcNow.Year)
                            .FirstOrDefaultAsync();

                        if (entitlement != null)
                        {
                            entitlement.CompensatoryOffBalance += 1;
                            entitlement.UpdatedAt = DateTime.UtcNow;
                        }
                        else
                        {
                            // Create entitlement if doesn't exist
                            entitlement = new LeaveEntitlement
                            {
                                Id = Guid.NewGuid(),
                                UserId = attendance.UserId,
                                LeaveType = LeaveType.CompensatoryOff,
                                CasualLeaveBalance = 12,
                                EarnedLeaveBalance = 15,
                                CompensatoryOffBalance = 1,
                                Year = DateTime.UtcNow.Year,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            };
                            _db.LeaveEntitlements.Add(entitlement);
                        }
                    }
                }

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<object>.SuccessResponse(new { }, "Attendance approved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving attendance");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpPost("attendance/{id}/reject")]
        public async Task<IActionResult> RejectAttendance(Guid id, [FromBody] RejectAttendanceRequest request)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var attendance = await _db.Attendance.FindAsync(id);
                if (attendance == null)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Attendance record not found"));
                }

                // If Manager, verify the user is in their team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null || !teamUserIds.Contains(attendance.UserId))
                    {
                        return Forbid();
                    }
                }

                if (attendance.Status != ApprovalStatus.Pending)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Cannot reject attendance with status: {attendance.Status}"));
                }

                attendance.Status = ApprovalStatus.Rejected;
                attendance.ApprovedBy = userId.Value;
                attendance.ApprovedAt = DateTime.UtcNow;
                attendance.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<object>.SuccessResponse(new { }, "Attendance rejected successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting attendance");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpGet("attendance/history")]
        public async Task<IActionResult> GetTeamAttendanceHistory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var end = endDate?.Date ?? DateTime.UtcNow.Date;
                var start = startDate?.Date ?? end.AddDays(-30);

                var query = _db.Attendance
                    .AsNoTracking()
                    .Where(a => a.Date >= DateOnly.FromDateTime(start) && a.Date <= DateOnly.FromDateTime(end))
                    .OrderByDescending(a => a.Date)
                    .AsQueryable();

                // If Manager, limit to team members
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch team members"));

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
                _logger.LogError(ex, "Error fetching team attendance history");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpGet("leave/history")]
        public async Task<IActionResult> GetTeamLeaveHistory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var end = endDate?.Date ?? DateTime.UtcNow.Date;
                var start = startDate?.Date ?? end.AddDays(-30);

                var query = _db.LeaveRequests
                    .AsNoTracking()
                    .Where(l => l.StartDate >= DateOnly.FromDateTime(start) && l.EndDate <= DateOnly.FromDateTime(end))
                    .OrderByDescending(l => l.CreatedAt)
                    .AsQueryable();

                // If Manager, limit to team members
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch team members"));

                    query = query.Where(l => teamUserIds.Contains(l.UserId));
                }

                var records = await query.ToListAsync();

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
                _logger.LogError(ex, "Error fetching team leave history");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpGet("team-members")]
        public async Task<IActionResult> GetTeamMembers()
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var employees = await _teamHelper.GetAllEmployeesAsync();
                if (employees == null)
                    return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch employees from AuthAPI"));

                IEnumerable<EmployeeDto> filtered;

                // If caller is Manager (not Admin/SystemAdmin), filter to their direct reports
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    filtered = employees.Where(e => !string.IsNullOrEmpty(e.ManagerId) && e.ManagerId == userId.Value.ToString());
                }
                else
                {
                    filtered = employees;
                }

                var teamMembers = await BuildTeamMemberDtosExcludingSystemAdminsAsync(filtered);

                // Enrich with leave balances
                var teamUserIds = filtered.Select(e => e.UserId).ToHashSet();
                var entitlements = await _db.LeaveEntitlements
                    .AsNoTracking()
                    .Where(e => teamUserIds.Contains(e.UserId) && e.Year == DateTime.UtcNow.Year)
                    .ToListAsync();

                foreach (var member in teamMembers)
                {
                    // Find the corresponding employee to get UserId
                    var employee = filtered.FirstOrDefault(e => e.EmployeeId == member.EmployeeId);
                    if (employee != null)
                    {
                        var ent = entitlements.FirstOrDefault(e => e.UserId == employee.UserId);
                        if (ent != null)
                        {
                            member.CasualLeaveBalance = ent.CasualLeaveBalance;
                            member.EarnedLeaveBalance = ent.EarnedLeaveBalance;
                            member.CompensatoryOffBalance = ent.CompensatoryOffBalance;
                        }
                    }
                }

                return Ok(ApiResponse<List<TeamMemberDto>>.SuccessResponse(teamMembers));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching team members");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpPost("assign-comp-off")]
        public async Task<IActionResult> AssignCompensatoryOff([FromBody] AssignCompOffRequest request)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                // Verify the employee is in the manager's team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null || !teamUserIds.Contains((int)request.EmployeeId.GetHashCode()))
                    {
                        return Forbid();
                    }
                }

                var employeeId = (int)request.EmployeeId.GetHashCode();
                var entitlement = await _db.LeaveEntitlements
                    .Where(e => e.UserId == employeeId && e.Year == DateTime.UtcNow.Year)
                    .FirstOrDefaultAsync();

                if (entitlement == null)
                {
                    entitlement = new LeaveEntitlement
                    {
                        Id = Guid.NewGuid(),
                        UserId = employeeId,
                        LeaveType = LeaveType.CompensatoryOff,
                        CasualLeaveBalance = 12,
                        EarnedLeaveBalance = 15,
                        CompensatoryOffBalance = request.Days,
                        Year = DateTime.UtcNow.Year,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.LeaveEntitlements.Add(entitlement);
                }
                else
                {
                    entitlement.CompensatoryOffBalance += request.Days;
                    entitlement.UpdatedAt = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<object>.SuccessResponse(new { }, $"Assigned {request.Days} compensatory off day(s) successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning compensatory off");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpPost("log-past-attendance")]
        public async Task<IActionResult> LogPastAttendance([FromBody] LogPastAttendanceRequest request)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var employeeId = (int)request.EmployeeId.GetHashCode();

                // Verify the employee is in the manager's team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var teamUserIds = await GetManagerTeamUserIdsAsync();
                    if (teamUserIds == null || !teamUserIds.Contains(employeeId))
                    {
                        return Forbid();
                    }
                }

                var date = DateOnly.Parse(request.Date);
                var loginTime = DateTime.Parse($"{request.Date} {request.LoginTime}");
                DateTime? logoutTime = null;
                if (!string.IsNullOrEmpty(request.LogoutTime))
                {
                    logoutTime = DateTime.Parse($"{request.Date} {request.LogoutTime}");
                }

                // Check if attendance already exists for this date
                var existing = await _db.Attendance
                    .Where(a => a.UserId == employeeId && a.Date == date)
                    .FirstOrDefaultAsync();

                if (existing != null)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse("Attendance record already exists for this date"));
                }

                var isWeekend = loginTime.DayOfWeek == DayOfWeek.Saturday || loginTime.DayOfWeek == DayOfWeek.Sunday;
                var isPublicHoliday = await _db.PublicHolidays.AnyAsync(h => h.Date == date && h.IsActive);

                var attendance = new Attendance
                {
                    Id = Guid.NewGuid(),
                    UserId = employeeId,
                    LoginTime = loginTime,
                    LogoutTime = logoutTime,
                    Date = date,
                    IsWeekend = isWeekend,
                    IsPublicHoliday = isPublicHoliday,
                    Status = ApprovalStatus.Approved, // Manager-logged attendance is pre-approved
                    ApprovedBy = userId.Value,
                    ApprovedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Attendance.Add(attendance);
                await _db.SaveChangesAsync();

                return Ok(ApiResponse<object>.SuccessResponse(new { }, "Past attendance logged successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error logging past attendance");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }
    }

    public class RejectAttendanceRequest
    {
        public string? RejectionReason { get; set; }
    }
}
