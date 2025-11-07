using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthAPI.Models.Entities
{
    /// <summary>
    /// Department/Division within the organization
    /// </summary>
    [Table("Departments")]
    public class Department
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        /// <summary>
        /// Comma-separated list of week day numbers (0=Sunday, 6=Saturday) 
        /// Example: "0,6" for Sunday and Saturday
        /// </summary>
        public string WeeklyOffDays { get; set; } = "0,6"; // Default: Sunday and Saturday

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    }
}
