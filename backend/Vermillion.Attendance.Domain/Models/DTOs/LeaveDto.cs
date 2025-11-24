using System.ComponentModel.DataAnnotations;

namespace Vermillion.Attendance.Domain.Models.DTOs
{
    public class LeaveRequestDto
    {
        [Required]
        public int LeaveType { get; set; } // 1=Casual, 2=Earned, 3=CompensatoryOff

        [Required]
        public DateOnly StartDate { get; set; }

        [Required]
        public DateOnly EndDate { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Reason { get; set; } = string.Empty;
    }

    public class LeaveRequestResponse
    {
        public Guid Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string EmployeeId { get; set; } = string.Empty;
        public string LeaveType { get; set; } = string.Empty;
        public DateOnly StartDate { get; set; }
        public DateOnly EndDate { get; set; }
        public decimal TotalDays { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? ApproverName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ApproveLeaveRequest
    {
        [Required]
        public Guid LeaveRequestId { get; set; }

        [Required]
        public bool Approved { get; set; }

        [MaxLength(500)]
        public string? RejectionReason { get; set; }
    }

    public class LeaveBalanceDto
    {
        public int Year { get; set; }
        public decimal CasualLeaveBalance { get; set; }
        public decimal EarnedLeaveBalance { get; set; }
        public decimal CompensatoryOffBalance { get; set; }
    }
}
