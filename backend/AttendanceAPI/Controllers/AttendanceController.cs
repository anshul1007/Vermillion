using AttendanceAPI.Models.DTOs;
using AttendanceAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AttendanceAPI.Filters;
using System.Security.Claims;

namespace AttendanceAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly IAttendanceService _attendanceService;
        private readonly IAdminService _adminService;
        private readonly ILogger<AttendanceController> _logger;

        public AttendanceController(IAttendanceService attendanceService, IAdminService adminService, ILogger<AttendanceController> logger)
        {
            _attendanceService = attendanceService;
            _adminService = adminService;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login()
        {
            try
            {
                var userId = GetCurrentUserId();
                var attendance = await _attendanceService.LoginAsync(userId);
                
                return Ok(ApiResponse<AttendanceDto>.SuccessResponse(attendance, "Login successful"));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during attendance login");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred during login", ex.Message));
            }
        }

        [HttpPost("logout")]
        [FeatureGate("ClockOut")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                var userId = GetCurrentUserId();
                var attendance = await _attendanceService.LogoutAsync(userId);
                
                return Ok(ApiResponse<AttendanceDto>.SuccessResponse(attendance, "Logout successful"));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during attendance logout");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred during logout", ex.Message));
            }
        }

        [HttpGet("today")]
        public async Task<IActionResult> GetTodayAttendance()
        {
            try
            {
                var userId = GetCurrentUserId();
                var attendance = await _attendanceService.GetTodayAttendanceAsync(userId);
                
                if (attendance == null)
                {
                    return Ok(ApiResponse<AttendanceDto?>.SuccessResponse(null, "No attendance record for today"));
                }
                
                return Ok(ApiResponse<AttendanceDto>.SuccessResponse(attendance));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting today's attendance");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var userId = GetCurrentUserId();
                var history = await _attendanceService.GetAttendanceHistoryAsync(userId, startDate, endDate);
                
                return Ok(ApiResponse<List<AttendanceDto>>.SuccessResponse(history));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting attendance history");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpGet("team")]
        [Authorize(Roles = "Manager,Administrator")]
        public async Task<IActionResult> GetTeamAttendance([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var managerId = GetCurrentUserId();
                var teamAttendance = await _attendanceService.GetTeamAttendanceAsync(managerId, startDate, endDate);
                
                return Ok(ApiResponse<List<AttendanceDto>>.SuccessResponse(teamAttendance));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting team attendance");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        [HttpGet("holidays")]
        public async Task<IActionResult> GetPublicHolidays([FromQuery] int year)
        {
            try
            {
                if (year == 0) year = DateTime.UtcNow.Year;

                var holidays = await _adminService.GetPublicHolidaysAsync(year);
                return Ok(ApiResponse<List<PublicHolidayDto>>.SuccessResponse(holidays));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting public holidays");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            {
                throw new UnauthorizedAccessException("User not authenticated");
            }
            return userId;
        }
    }
}
