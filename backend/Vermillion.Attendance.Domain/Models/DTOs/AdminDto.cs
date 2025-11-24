using System.ComponentModel.DataAnnotations;

namespace Vermillion.Attendance.Domain.Models.DTOs
{
    public class CreateUserRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        public int? AuthUserId { get; set; } // Links to Auth API Users table (optional for now)

        [Required]
        [MaxLength(100)]
        public string FirstName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string LastName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string EmployeeId { get; set; } = string.Empty;

        [Required]
        public int Role { get; set; } 

        public Guid? ManagerId { get; set; }

        public Guid? DepartmentId { get; set; }
    }

    public class UpdateUserRequest
    {
        [EmailAddress]
        public string? Email { get; set; }

        [MaxLength(100)]
        public string? FirstName { get; set; }

        [MaxLength(100)]
        public string? LastName { get; set; }

        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        public int? Role { get; set; }

        public Guid? ManagerId { get; set; }

        public Guid? DepartmentId { get; set; }

        public bool? IsActive { get; set; }
    }

    public class AllocateLeaveRequest
    {
        [Required]
        public Guid UserId { get; set; }

        [Required]
        public int Year { get; set; }

        [Required]
        [Range(0, 365)]
        public decimal CasualLeaveBalance { get; set; }

        [Required]
        [Range(0, 365)]
        public decimal EarnedLeaveBalance { get; set; }

        [Range(0, 365)]
        public decimal CompensatoryOffBalance { get; set; } = 0;
    }

    // New request shape: frontend sends userId as string; accept string and parse when handling
    public class AllocateLeaveEntitlementRequest
    {
        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        public int Year { get; set; }

        [Required]
        [Range(0, 365)]
        public decimal CasualLeaveBalance { get; set; }

        [Required]
        [Range(0, 365)]
        public decimal EarnedLeaveBalance { get; set; }

        [Range(0, 365)]
        public decimal CompensatoryOffBalance { get; set; } = 0;
    }

    public class CreatePublicHolidayRequest
    {
        [Required]
        public DateOnly Date { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }
    }

    public class PublicHolidayDto
    {
        public Guid Id { get; set; }
        public DateOnly Date { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int Year { get; set; }
        public bool IsActive { get; set; }
    }

    public class LeaveEntitlementDto
    {
        public string UserId { get; set; } = string.Empty;
        public int Year { get; set; }
        public decimal CasualLeaveBalance { get; set; }
        public decimal EarnedLeaveBalance { get; set; }
        public decimal CompensatoryOffBalance { get; set; }
    }
}
