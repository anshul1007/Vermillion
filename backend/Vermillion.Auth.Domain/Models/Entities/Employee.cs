using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Vermillion.Auth.Domain.Models.Entities
{
    /// <summary>
    /// Employee organizational profile - links User (identity) to organizational data
    /// This is the central employee record that all services reference
    /// </summary>
    [Table("Employees")]
    public class Employee
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>
        /// Foreign key to Users table (same database)
        /// This links the employee record to the authentication/identity record
        /// </summary>
        [Required]
        public int UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        /// <summary>
        /// Human-readable employee ID (e.g., "EMP001", "EMP002")
        /// </summary>
        [Required, MaxLength(50)]
        public string EmployeeId { get; set; } = string.Empty;

        /// <summary>
        /// Employee's first name (organizational record)
        /// </summary>
        [MaxLength(100)]
        public string? FirstName { get; set; }

        /// <summary>
        /// Employee's last name (organizational record)
        /// </summary>
        [MaxLength(100)]
        public string? LastName { get; set; }


        public Guid? ManagerId { get; set; }

        [ForeignKey(nameof(ManagerId))]
        public Employee? Manager { get; set; }

        public Guid? DepartmentId { get; set; }

        [ForeignKey(nameof(DepartmentId))]
        public Department? Department { get; set; }

        /// <summary>
        /// Phone number (used by all roles, especially Guards)
        /// </summary>
        [MaxLength(20)]
        public string? PhoneNumber { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<Employee> Subordinates { get; set; } = new List<Employee>();
    }
}
