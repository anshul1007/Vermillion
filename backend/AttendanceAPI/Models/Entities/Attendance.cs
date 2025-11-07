using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceAPI.Models.Entities
{
    [Table("Attendance")]
    public class Attendance
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public int UserId { get; set; }

        [Required]
        public DateTime LoginTime { get; set; }

        public DateTime? LogoutTime { get; set; }

        [Required]
        public DateOnly Date { get; set; }

        public bool IsWeekend { get; set; } = false;
        public bool IsPublicHoliday { get; set; } = false;

        [Required]
        public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;

        public int? ApprovedBy { get; set; }

        public DateTime? ApprovedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
