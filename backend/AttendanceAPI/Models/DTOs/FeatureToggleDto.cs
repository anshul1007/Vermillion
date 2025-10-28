namespace AttendanceAPI.Models.DTOs
{
    public class FeatureToggleDto
    {
        public Guid Id { get; set; }
        public string FeatureKey { get; set; } = string.Empty;
        public string FeatureName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public Guid? LastModifiedBy { get; set; }
        public string? LastModifiedByName { get; set; }
    }

    public class CreateFeatureToggleRequest
    {
        public string FeatureKey { get; set; } = string.Empty;
        public string FeatureName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsEnabled { get; set; } = false;
    }

    public class UpdateFeatureToggleRequest
    {
        public string FeatureName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
    }

    public class ToggleFeatureRequest
    {
        public bool IsEnabled { get; set; }
    }
}
