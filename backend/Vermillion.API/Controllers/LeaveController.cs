using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vermillion.Attendance.Domain.Data;
using Vermillion.Attendance.Domain.Models.DTOs;
using Vermillion.Attendance.Domain.Models.Entities;
using Vermillion.Attendance.Domain.Services;

namespace Vermillion.API.Controllers
{
    [ApiController]
    [Route("api/attendance/leave")]
    [Authorize]
    public class LeaveController : ControllerBase
    {
        private readonly AttendanceDbContext _db;
        private readonly ICurrentUserService _currentUserService;
        private readonly ILogger<LeaveController> _logger;
        private readonly ITeamManagementHelper _teamHelper;

        public LeaveController(AttendanceDbContext db, ICurrentUserService currentUserService, ILogger<LeaveController> logger, ITeamManagementHelper teamHelper)
        {
            _db = db;
            _currentUserService = currentUserService;
            _logger = logger;
            _teamHelper = teamHelper;
        }

        // Helper: converts user ID to Employee GUID for team management
        private async Task<Guid?> GetEmployeeGuidFromUserIdAsync(int userId)
        {
            var allEmployees = await _teamHelper.GetAllEmployeesAsync();
            if (allEmployees == null)
                return null;

            var employee = allEmployees.FirstOrDefault(e => e.UserId == userId);
            if (employee == null || !Guid.TryParse(employee.Id, out var employeeGuid))
                return null;

            return employeeGuid;
        }

        [HttpPost("request")]
        public async Task<IActionResult> CreateLeaveRequest([FromBody] LeaveRequestDto request)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                // Validate dates
                if (request.EndDate < request.StartDate)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse("End date cannot be before start date"));
                }

                // Calculate total days (including weekends)
                var totalDays = request.EndDate.DayNumber - request.StartDate.DayNumber + 1;

                // Validate leave type
                if (!Enum.IsDefined(typeof(LeaveType), request.LeaveType))
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse("Invalid leave type"));
                }

                var leaveType = (LeaveType)request.LeaveType;

                // Check leave balance
                var entitlement = await _db.LeaveEntitlements
                    .Where(e => e.UserId == userId.Value && e.Year == DateTime.UtcNow.Year)
                    .FirstOrDefaultAsync();

                if (entitlement == null)
                {
                    // Create default entitlement if not exists
                    entitlement = new LeaveEntitlement
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId.Value,
                        LeaveType = leaveType,
                        CasualLeaveBalance = 12,
                        EarnedLeaveBalance = 15,
                        CompensatoryOffBalance = 0,
                        Year = DateTime.UtcNow.Year,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.LeaveEntitlements.Add(entitlement);
                    await _db.SaveChangesAsync();
                }

                // Check if user has sufficient balance
                decimal availableBalance = leaveType switch
                {
                    LeaveType.CasualLeave => entitlement.CasualLeaveBalance,
                    LeaveType.EarnedLeave => entitlement.EarnedLeaveBalance,
                    LeaveType.CompensatoryOff => entitlement.CompensatoryOffBalance,
                    _ => 0
                };

                if (availableBalance < totalDays)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Insufficient leave balance. Available: {availableBalance}, Requested: {totalDays}"));
                }

                // Check for overlapping leave requests
                var hasOverlap = await _db.LeaveRequests
                    .AnyAsync(lr => lr.UserId == userId.Value &&
                                   lr.Status != ApprovalStatus.Rejected &&
                                   lr.Status != ApprovalStatus.Cancelled &&
                                   ((lr.StartDate <= request.EndDate && lr.EndDate >= request.StartDate)));

                if (hasOverlap)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse("You already have a leave request for overlapping dates"));
                }

                // Create leave request
                var leaveRequest = new LeaveRequest
                {
                    Id = Guid.NewGuid(),
                    UserId = userId.Value,
                    LeaveType = leaveType,
                    StartDate = request.StartDate,
                    EndDate = request.EndDate,
                    TotalDays = totalDays,
                    Reason = request.Reason,
                    Status = ApprovalStatus.Pending,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.LeaveRequests.Add(leaveRequest);
                await _db.SaveChangesAsync();

                var response = new LeaveRequestResponse
                {
                    Id = leaveRequest.Id,
                    UserId = leaveRequest.UserId,
                    UserName = string.Empty,
                    EmployeeId = string.Empty,
                    LeaveType = leaveRequest.LeaveType.ToString(),
                    StartDate = leaveRequest.StartDate,
                    EndDate = leaveRequest.EndDate,
                    TotalDays = leaveRequest.TotalDays,
                    Reason = leaveRequest.Reason,
                    Status = leaveRequest.Status.ToString(),
                    ApproverName = null,
                    ApprovedAt = null,
                    RejectionReason = null,
                    CreatedAt = leaveRequest.CreatedAt
                };

                return Ok(ApiResponse<LeaveRequestResponse>.SuccessResponse(response, "Leave request submitted successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating leave request");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred while creating leave request", ex.Message));
            }
        }

        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            var userId = _currentUserService.GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
            }

            var ent = await _db.LeaveEntitlements
                .AsNoTracking()
                .Where(e => e.UserId == userId.Value)
                .OrderByDescending(e => e.UpdatedAt)
                .FirstOrDefaultAsync();

            var dto = new LeaveBalanceDto
            {
                Year = DateTime.UtcNow.Year,
                CasualLeaveBalance = ent?.CasualLeaveBalance ?? 0m,
                EarnedLeaveBalance = ent?.EarnedLeaveBalance ?? 0m,
                CompensatoryOffBalance = ent?.CompensatoryOffBalance ?? 0m,
            };

            return Ok(ApiResponse<LeaveBalanceDto>.SuccessResponse(dto));
        }

        [HttpGet("my-requests")]
        public async Task<IActionResult> GetMyRequests()
        {
            var userId = _currentUserService.GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
            }

            var requests = await _db.LeaveRequests
                .AsNoTracking()
                .Where(r => r.UserId == userId.Value)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var dtos = requests.Select(r => new LeaveRequestResponse
            {
                Id = r.Id,
                UserId = r.UserId,
                UserName = string.Empty,
                EmployeeId = string.Empty,
                LeaveType = r.LeaveType.ToString(),
                StartDate = r.StartDate,
                EndDate = r.EndDate,
                TotalDays = r.TotalDays,
                Reason = r.Reason,
                Status = r.Status.ToString(),
                ApproverName = null,
                ApprovedAt = r.ApprovedAt,
                RejectionReason = r.RejectionReason,
                CreatedAt = r.CreatedAt
            }).ToList();

            return Ok(ApiResponse<List<LeaveRequestResponse>>.SuccessResponse(dtos));
        }

        [HttpPost("cancel/{id}")]
        public async Task<IActionResult> CancelLeaveRequest(Guid id)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var leaveRequest = await _db.LeaveRequests
                    .Where(r => r.Id == id && r.UserId == userId.Value)
                    .FirstOrDefaultAsync();

                if (leaveRequest == null)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Leave request not found or you don't have permission to cancel it"));
                }

                // Only allow cancellation of pending or approved requests
                if (leaveRequest.Status == ApprovalStatus.Cancelled)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse("Leave request is already cancelled"));
                }

                if (leaveRequest.Status == ApprovalStatus.Rejected)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse("Cannot cancel a rejected leave request"));
                }

                // If the leave was approved, return the days back to balance
                if (leaveRequest.Status == ApprovalStatus.Approved)
                {
                    var entitlement = await _db.LeaveEntitlements
                        .Where(e => e.UserId == userId.Value && e.Year == DateTime.UtcNow.Year)
                        .FirstOrDefaultAsync();

                    if (entitlement != null)
                    {
                        switch (leaveRequest.LeaveType)
                        {
                            case LeaveType.CasualLeave:
                                entitlement.CasualLeaveBalance += leaveRequest.TotalDays;
                                break;
                            case LeaveType.EarnedLeave:
                                entitlement.EarnedLeaveBalance += leaveRequest.TotalDays;
                                break;
                            case LeaveType.CompensatoryOff:
                                entitlement.CompensatoryOffBalance += leaveRequest.TotalDays;
                                break;
                        }
                        entitlement.UpdatedAt = DateTime.UtcNow;
                    }
                }

                leaveRequest.Status = ApprovalStatus.Cancelled;
                leaveRequest.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                var response = new LeaveRequestResponse
                {
                    Id = leaveRequest.Id,
                    UserId = leaveRequest.UserId,
                    UserName = string.Empty,
                    EmployeeId = string.Empty,
                    LeaveType = leaveRequest.LeaveType.ToString(),
                    StartDate = leaveRequest.StartDate,
                    EndDate = leaveRequest.EndDate,
                    TotalDays = leaveRequest.TotalDays,
                    Reason = leaveRequest.Reason,
                    Status = leaveRequest.Status.ToString(),
                    ApproverName = null,
                    ApprovedAt = leaveRequest.ApprovedAt,
                    RejectionReason = leaveRequest.RejectionReason,
                    CreatedAt = leaveRequest.CreatedAt
                };

                return Ok(ApiResponse<LeaveRequestResponse>.SuccessResponse(response, "Leave request cancelled successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling leave request");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred while cancelling leave request", ex.Message));
            }
        }

        [HttpGet("pending-approvals")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> GetPendingApprovals()
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var query = _db.LeaveRequests
                    .AsNoTracking()
                    .Where(l => l.Status == ApprovalStatus.Pending)
                    .OrderBy(l => l.CreatedAt)
                    .AsQueryable();

                // If caller is a Manager (not Admin/SystemAdmin), limit to their team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var managerEmployeeGuid = await GetEmployeeGuidFromUserIdAsync(userId.Value);
                    if (!managerEmployeeGuid.HasValue)
                        return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to resolve manager employee record"));

                    var teamUserIds = await _teamHelper.GetManagerTeamUserIdsAsync(managerEmployeeGuid.Value);
                    if (teamUserIds == null)
                        return StatusCode(502, ApiResponse<object>.ErrorResponse("Failed to fetch team members"));

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
                _logger.LogError(ex, "Error fetching pending leave approvals");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpPost("{id}/approve")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> ApproveLeaveRequest(Guid id)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var leaveRequest = await _db.LeaveRequests.FindAsync(id);
                if (leaveRequest == null)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Leave request not found"));
                }

                // If Manager, verify the user is in their team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var managerEmployeeGuid = await GetEmployeeGuidFromUserIdAsync(userId.Value);
                    if (!managerEmployeeGuid.HasValue)
                        return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to resolve manager employee record"));

                    var teamUserIds = await _teamHelper.GetManagerTeamUserIdsAsync(managerEmployeeGuid.Value);
                    if (teamUserIds == null || !teamUserIds.Contains(leaveRequest.UserId))
                    {
                        return Forbid();
                    }
                }

                if (leaveRequest.Status != ApprovalStatus.Pending)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Cannot approve leave request with status: {leaveRequest.Status}"));
                }

                // Deduct leave balance
                var entitlement = await _db.LeaveEntitlements
                    .Where(e => e.UserId == leaveRequest.UserId && e.Year == DateTime.UtcNow.Year)
                    .FirstOrDefaultAsync();

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

                leaveRequest.Status = ApprovalStatus.Approved;
                leaveRequest.ApprovedBy = userId.Value;
                leaveRequest.ApprovedAt = DateTime.UtcNow;
                leaveRequest.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<object>.SuccessResponse(new { }, "Leave request approved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error approving leave request");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpPost("{id}/reject")]
        [Authorize(Roles = "Manager,Admin,SystemAdmin")]
        public async Task<IActionResult> RejectLeaveRequest(Guid id, [FromBody] RejectLeaveRequest request)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<object>.ErrorResponse("Invalid or missing user claim"));
                }

                var leaveRequest = await _db.LeaveRequests.FindAsync(id);
                if (leaveRequest == null)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Leave request not found"));
                }

                // If Manager, verify the user is in their team
                if (User.IsInRole("Manager") && !User.IsInRole("Admin") && !User.IsInRole("SystemAdmin"))
                {
                    var managerEmployeeGuid = await GetEmployeeGuidFromUserIdAsync(userId.Value);
                    if (!managerEmployeeGuid.HasValue)
                        return StatusCode(500, ApiResponse<object>.ErrorResponse("Failed to resolve manager employee record"));

                    var teamUserIds = await _teamHelper.GetManagerTeamUserIdsAsync(managerEmployeeGuid.Value);
                    if (teamUserIds == null || !teamUserIds.Contains(leaveRequest.UserId))
                    {
                        return Forbid();
                    }
                }

                if (leaveRequest.Status != ApprovalStatus.Pending)
                {
                    return BadRequest(ApiResponse<object>.ErrorResponse($"Cannot reject leave request with status: {leaveRequest.Status}"));
                }

                leaveRequest.Status = ApprovalStatus.Rejected;
                leaveRequest.ApprovedBy = userId.Value;
                leaveRequest.ApprovedAt = DateTime.UtcNow;
                leaveRequest.RejectionReason = request.RejectionReason;
                leaveRequest.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<object>.SuccessResponse(new { }, "Leave request rejected successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rejecting leave request");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }
    }

    public class RejectLeaveRequest
    {
        public string? RejectionReason { get; set; }
    }
}

