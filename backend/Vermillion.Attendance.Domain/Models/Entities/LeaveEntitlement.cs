using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vermillion.Attendance.Domain.Models.Entities
{
    [Table("LeaveEntitlements")]
    public class LeaveEntitlement
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public int UserId { get; set; }

        [Required]
        public LeaveType LeaveType { get; set; }

        [Required, Column(TypeName = "decimal(5,2)")]
        public decimal CasualLeaveBalance { get; set; } = 0;

        [Required, Column(TypeName = "decimal(5,2)")]
        public decimal EarnedLeaveBalance { get; set; } = 0;

        [Required, Column(TypeName = "decimal(5,2)")]
        public decimal CompensatoryOffBalance { get; set; } = 0;

        [Required]
        public int Year { get; set; } = DateTime.UtcNow.Year;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
