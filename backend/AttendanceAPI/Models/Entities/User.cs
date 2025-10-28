using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceAPI.Models.Entities
{
    [Table("Users")]
    public class User
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(256)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        public string EmployeeId { get; set; } = string.Empty;

        [Required]
        public UserRole Role { get; set; }

        public Guid? ManagerId { get; set; }

        [ForeignKey(nameof(ManagerId))]
        public User? Manager { get; set; }

        public Guid? DepartmentId { get; set; }

        [ForeignKey(nameof(DepartmentId))]
        public Department? Department { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
        public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
        public ICollection<LeaveEntitlement> LeaveEntitlements { get; set; } = new List<LeaveEntitlement>();
        public ICollection<User> Subordinates { get; set; } = new List<User>();
    }

    public enum UserRole
    {
        Employee = 1,
        Manager = 2,
        Administrator = 3,
        SystemUser = 4
    }
}
