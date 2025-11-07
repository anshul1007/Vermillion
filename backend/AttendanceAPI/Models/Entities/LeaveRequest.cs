using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceAPI.Models.Entities
{
    [Table("LeaveRequests")]
    public class LeaveRequest
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public int UserId { get; set; }

        [Required]
        public LeaveType LeaveType { get; set; }

        [Required]
        public DateOnly StartDate { get; set; }

        [Required]
        public DateOnly EndDate { get; set; }

        [Required, Column(TypeName = "decimal(5,2)")]
        public decimal TotalDays { get; set; }

        [Required, MaxLength(1000)]
        public string Reason { get; set; } = string.Empty;

        [Required]
        public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

        public int? ApprovedBy { get; set; }

        public DateTime? ApprovedAt { get; set; }

        [MaxLength(500)]
        public string? RejectionReason { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum LeaveType
    {
        CasualLeave = 1,
        EarnedLeave = 2,
        CompensatoryOff = 3
    }

    public enum ApprovalStatus
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2,
        Cancelled = 3
    }
}
