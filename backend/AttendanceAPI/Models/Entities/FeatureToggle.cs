using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AttendanceAPI.Models.Entities
{
    [Table("FeatureToggles")]
    public class FeatureToggle
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required, MaxLength(100)]
        public string FeatureKey { get; set; } = string.Empty;

        [Required, MaxLength(200)]
        public string FeatureName { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        public bool IsEnabled { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public Guid? LastModifiedBy { get; set; }

        [ForeignKey(nameof(LastModifiedBy))]
        public User? LastModifiedByUser { get; set; }
    }
}
