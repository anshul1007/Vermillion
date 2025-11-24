namespace Vermillion.Attendance.Domain.Models.DTOs
{
    public class AttendanceLoginRequest
    {
        // User ID is extracted from JWT token, no need to pass it
    }

    public class AttendanceLogoutRequest
    {
        // User ID is extracted from JWT token, no need to pass it
    }

    public class AttendanceResponse
    {
        public Guid AttendanceId { get; set; }
        public DateTime LoginTime { get; set; }
        public DateTime? LogoutTime { get; set; }
        public DateOnly Date { get; set; }
        public bool IsWeekend { get; set; }
        public bool IsPublicHoliday { get; set; }
        public string? Duration { get; set; }
        public bool CompensatoryOffEarned { get; set; }
        public string? Message { get; set; }
    }

    public class AttendanceDto
    {
        public Guid Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string EmployeeId { get; set; } = string.Empty;
        public DateTime LoginTime { get; set; }
        public DateTime? LogoutTime { get; set; }
        public DateOnly Date { get; set; }
        public bool IsWeekend { get; set; }
        public bool IsPublicHoliday { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? ApproverName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public TimeSpan? WorkDuration { get; set; }
    }

    public class AttendanceHistoryRequest
    {
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public Guid? UserId { get; set; } // For managers to view team attendance
    }
}
