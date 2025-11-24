namespace Vermillion.Attendance.Domain.Models.DTOs;

public class TeamMemberDto
{
    public Guid Id { get; set; }
    public required string EmployeeId { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public required string Email { get; set; }
    public decimal? CasualLeaveBalance { get; set; }
    public decimal? EarnedLeaveBalance { get; set; }
    public decimal? CompensatoryOffBalance { get; set; }
    public List<UpcomingLeaveDto>? UpcomingLeaves { get; set; }
}

public class UpcomingLeaveDto
{
    public Guid Id { get; set; }
    public required string LeaveType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public required string Status { get; set; }
}

public class AssignCompOffRequest
{
    public Guid EmployeeId { get; set; }
    public decimal Days { get; set; }
    public required string Reason { get; set; }
}

public class LogPastAttendanceRequest
{
    public Guid EmployeeId { get; set; }
    public required string Date { get; set; }
    public required string LoginTime { get; set; }
    public string? LogoutTime { get; set; }
}
