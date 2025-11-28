using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vermillion.Attendance.Domain.Data;
using Vermillion.Attendance.Domain.Models.DTOs;
using Vermillion.Attendance.Domain.Models.Entities;
using Vermillion.Attendance.Domain.Services;
using Vermillion.Shared.Domain.Models.DTOs;
using Vermillion.API.Extensions;

namespace Vermillion.API.Controllers
{
    [ApiController]
    [Route("api/attendance")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly AttendanceDbContext _db;
        private readonly ICurrentUserService _currentUserService;
        private readonly ILogger<AttendanceController> _logger;

        public AttendanceController(AttendanceDbContext db, ICurrentUserService currentUserService, ILogger<AttendanceController> logger)
        {
            _db = db;
            _currentUserService = currentUserService;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] AttendanceLoginRequest request)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<string>.ErrorResponse("Invalid or missing user claim"));
                }

                var today = DateOnly.FromDateTime(DateTime.UtcNow);

                // Check if user has already logged in today
                var existingAttendance = await _db.Attendances
                    .Where(a => a.UserId == userId.Value && a.Date == today)
                    .FirstOrDefaultAsync();

                if (existingAttendance != null)
                {
                    return BadRequest(ApiResponse<string>.ErrorResponse("You have already logged in today"));
                }

                // Check if today is a weekend
                var isWeekend = DateTime.UtcNow.DayOfWeek == DayOfWeek.Saturday || DateTime.UtcNow.DayOfWeek == DayOfWeek.Sunday;

                // Check if today is a public holiday
                var isPublicHoliday = await _db.PublicHolidays
                    .AnyAsync(h => h.Date == today && h.IsActive);

                // Create new attendance record
                var attendance = new Attendance.Domain.Models.Entities.Attendance
                {
                    Id = Guid.NewGuid(),
                    UserId = userId.Value,
                    LoginTime = DateTime.UtcNow,
                    Date = today,
                    IsWeekend = isWeekend,
                    IsPublicHoliday = isPublicHoliday,
                    Status = ApprovalStatus.Pending,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Attendances.Add(attendance);
                await _db.SaveChangesAsync();

                var response = new AttendanceResponse
                {
                    AttendanceId = attendance.Id,
                    LoginTime = attendance.LoginTime,
                    LogoutTime = attendance.LogoutTime,
                    Date = attendance.Date,
                    IsWeekend = attendance.IsWeekend,
                    IsPublicHoliday = attendance.IsPublicHoliday,
                    Duration = null,
                    CompensatoryOffEarned = false,
                    Message = isWeekend || isPublicHoliday ? "Logged in on a weekend/holiday. You may earn compensatory off." : "Login successful"
                };

                return Ok(ApiResponse<AttendanceResponse>.SuccessResponse(response, "Attendance login recorded"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during attendance login");
                    return this.ServerError("An error occurred during login");
            }
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout([FromBody] AttendanceLogoutRequest request)
        {
            try
            {
                var userId = _currentUserService.GetCurrentUserId();
                if (!userId.HasValue)
                {
                    return Unauthorized(ApiResponse<string>.ErrorResponse("Invalid or missing user claim"));
                }

                var today = DateOnly.FromDateTime(DateTime.UtcNow);

                // Find today's attendance record
                var attendance = await _db.Attendances
                    .Where(a => a.UserId == userId.Value && a.Date == today)
                    .FirstOrDefaultAsync();

                if (attendance == null)
                {
                    return BadRequest(ApiResponse<string>.ErrorResponse("No login record found for today. Please login first."));
                }

                if (attendance.LogoutTime.HasValue)
                {
                    return BadRequest(ApiResponse<string>.ErrorResponse("You have already logged out today"));
                }

                // Update logout time
                attendance.LogoutTime = DateTime.UtcNow;
                attendance.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                var duration = attendance.LogoutTime.Value - attendance.LoginTime;
                var durationString = $"{(int)duration.TotalHours}h {duration.Minutes}m";

                // Check if compensatory off is earned (working on weekend/holiday for more than 4 hours)
                var compOffEarned = (attendance.IsWeekend || attendance.IsPublicHoliday) && duration.TotalHours >= 4;

                var response = new AttendanceResponse
                {
                    AttendanceId = attendance.Id,
                    LoginTime = attendance.LoginTime,
                    LogoutTime = attendance.LogoutTime,
                    Date = attendance.Date,
                    IsWeekend = attendance.IsWeekend,
                    IsPublicHoliday = attendance.IsPublicHoliday,
                    Duration = durationString,
                    CompensatoryOffEarned = compOffEarned,
                    Message = compOffEarned ? "Logout successful. You have earned compensatory off." : "Logout successful"
                };

                return Ok(ApiResponse<AttendanceResponse>.SuccessResponse(response, "Attendance logout recorded"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during attendance logout");
                    return this.ServerError("An error occurred during logout");
            }
        }

        [HttpGet("today")]
        public async Task<IActionResult> GetToday()
        {
            var userId = _currentUserService.GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(ApiResponse<string>.ErrorResponse("Invalid or missing user claim"));
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var att = await _db.Attendances
                .AsNoTracking()
                .Where(a => a.UserId == userId.Value && a.Date == today)
                .FirstOrDefaultAsync();

            if (att == null)
            {
                return Ok(ApiResponse<AttendanceDto?>.SuccessResponse(null, "No attendance record for today"));
            }

            var dto = new AttendanceDto
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
                WorkDuration = att.LogoutTime.HasValue ? att.LogoutTime.Value - att.LoginTime : null
            };

            return Ok(ApiResponse<AttendanceDto>.SuccessResponse(dto));
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int? userId)
        {
            // Determine date range
            var end = endDate?.Date ?? DateTime.UtcNow.Date;
            var start = startDate?.Date ?? end.AddDays(-30);

            // Determine user context
            var currentUserId = _currentUserService.GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized(ApiResponse<string>.ErrorResponse("Invalid or missing user claim"));
            }

            var effectiveUserId = currentUserId.Value;
            // If caller passed userId, allow only managers/admins
            if (userId.HasValue && userId.Value != currentUserId.Value)
            {
                if (!User.IsInRole("Manager") && !User.IsInRole("Admin"))
                {
                    return Forbid();
                }
                effectiveUserId = userId.Value;
            }

            var records = await _db.Attendances
                .AsNoTracking()
                .Where(a => a.UserId == effectiveUserId && a.Date >= DateOnly.FromDateTime(start) && a.Date <= DateOnly.FromDateTime(end))
                .OrderByDescending(a => a.Date)
                .ToListAsync();

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
                WorkDuration = att.LogoutTime.HasValue ? att.LogoutTime.Value - att.LoginTime : null
            }).ToList();

            return Ok(ApiResponse<List<AttendanceDto>>.SuccessResponse(dtos));
        }

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
                return this.ServerError("An error occurred");
            }
        }
    }
}
