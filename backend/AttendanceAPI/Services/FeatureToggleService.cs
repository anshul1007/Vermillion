using AttendanceAPI.Data;
using AttendanceAPI.Models.DTOs;
using AttendanceAPI.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.FeatureManagement;

namespace AttendanceAPI.Services
{
    public interface IFeatureToggleService
    {
        Task<List<FeatureToggleDto>> GetAllFeatureTogglesAsync();
        Task<FeatureToggleDto?> GetFeatureToggleAsync(Guid id);
        Task<FeatureToggleDto?> GetFeatureToggleByKeyAsync(string featureKey);
        Task<bool> IsFeatureEnabledAsync(string featureKey);
        Task<FeatureToggleDto> CreateFeatureToggleAsync(CreateFeatureToggleRequest request, Guid userId);
        Task<FeatureToggleDto> UpdateFeatureToggleAsync(Guid id, UpdateFeatureToggleRequest request, Guid userId);
        Task<FeatureToggleDto> ToggleFeatureAsync(Guid id, bool isEnabled, Guid userId);
        Task<bool> DeleteFeatureToggleAsync(Guid id);
    }

    public class FeatureToggleService : IFeatureToggleService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FeatureToggleService> _logger;
        private readonly IFeatureManager _featureManager;

        public FeatureToggleService(
            ApplicationDbContext context, 
            ILogger<FeatureToggleService> logger,
            IFeatureManager featureManager)
        {
            _context = context;
            _logger = logger;
            _featureManager = featureManager;
        }

        public async Task<List<FeatureToggleDto>> GetAllFeatureTogglesAsync()
        {
            var toggles = await _context.FeatureToggles
                .Include(f => f.LastModifiedByUser)
                .OrderBy(f => f.FeatureName)
                .ToListAsync();

            return toggles.Select(MapToDto).ToList();
        }

        public async Task<FeatureToggleDto?> GetFeatureToggleAsync(Guid id)
        {
            var toggle = await _context.FeatureToggles
                .Include(f => f.LastModifiedByUser)
                .FirstOrDefaultAsync(f => f.Id == id);

            return toggle != null ? MapToDto(toggle) : null;
        }

        public async Task<FeatureToggleDto?> GetFeatureToggleByKeyAsync(string featureKey)
        {
            var toggle = await _context.FeatureToggles
                .Include(f => f.LastModifiedByUser)
                .FirstOrDefaultAsync(f => f.FeatureKey == featureKey);

            return toggle != null ? MapToDto(toggle) : null;
        }

        public async Task<bool> IsFeatureEnabledAsync(string featureKey)
        {
            // Use Microsoft's Feature Manager to check if feature is enabled
            return await _featureManager.IsEnabledAsync(featureKey);
        }

        public async Task<FeatureToggleDto> CreateFeatureToggleAsync(CreateFeatureToggleRequest request, Guid userId)
        {
            // Check if feature key already exists
            var exists = await _context.FeatureToggles
                .AnyAsync(f => f.FeatureKey == request.FeatureKey);

            if (exists)
            {
                throw new InvalidOperationException($"Feature toggle with key '{request.FeatureKey}' already exists");
            }

            var toggle = new FeatureToggle
            {
                FeatureKey = request.FeatureKey,
                FeatureName = request.FeatureName,
                Description = request.Description,
                IsEnabled = request.IsEnabled,
                LastModifiedBy = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.FeatureToggles.Add(toggle);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Feature toggle created: {FeatureKey} by user {UserId}", request.FeatureKey, userId);

            // Reload with user info
            var created = await _context.FeatureToggles
                .Include(f => f.LastModifiedByUser)
                .FirstAsync(f => f.Id == toggle.Id);

            return MapToDto(created);
        }

        public async Task<FeatureToggleDto> UpdateFeatureToggleAsync(Guid id, UpdateFeatureToggleRequest request, Guid userId)
        {
            var toggle = await _context.FeatureToggles.FindAsync(id);
            if (toggle == null)
            {
                throw new InvalidOperationException("Feature toggle not found");
            }

            toggle.FeatureName = request.FeatureName;
            toggle.Description = request.Description;
            toggle.IsEnabled = request.IsEnabled;
            toggle.LastModifiedBy = userId;
            toggle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Feature toggle updated: {FeatureKey} by user {UserId}", toggle.FeatureKey, userId);

            // Reload with user info
            var updated = await _context.FeatureToggles
                .Include(f => f.LastModifiedByUser)
                .FirstAsync(f => f.Id == toggle.Id);

            return MapToDto(updated);
        }

        public async Task<FeatureToggleDto> ToggleFeatureAsync(Guid id, bool isEnabled, Guid userId)
        {
            var toggle = await _context.FeatureToggles.FindAsync(id);
            if (toggle == null)
            {
                throw new InvalidOperationException("Feature toggle not found");
            }

            toggle.IsEnabled = isEnabled;
            toggle.LastModifiedBy = userId;
            toggle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Feature toggle {Action}: {FeatureKey} by user {UserId}", 
                isEnabled ? "enabled" : "disabled", toggle.FeatureKey, userId);

            // Reload with user info
            var updated = await _context.FeatureToggles
                .Include(f => f.LastModifiedByUser)
                .FirstAsync(f => f.Id == toggle.Id);

            return MapToDto(updated);
        }

        public async Task<bool> DeleteFeatureToggleAsync(Guid id)
        {
            var toggle = await _context.FeatureToggles.FindAsync(id);
            if (toggle == null)
            {
                return false;
            }

            _context.FeatureToggles.Remove(toggle);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Feature toggle deleted: {FeatureKey}", toggle.FeatureKey);

            return true;
        }

        private static FeatureToggleDto MapToDto(FeatureToggle toggle)
        {
            return new FeatureToggleDto
            {
                Id = toggle.Id,
                FeatureKey = toggle.FeatureKey,
                FeatureName = toggle.FeatureName,
                Description = toggle.Description,
                IsEnabled = toggle.IsEnabled,
                CreatedAt = toggle.CreatedAt,
                UpdatedAt = toggle.UpdatedAt,
                LastModifiedBy = toggle.LastModifiedBy,
                LastModifiedByName = toggle.LastModifiedByUser != null
                    ? $"{toggle.LastModifiedByUser.FirstName} {toggle.LastModifiedByUser.LastName}"
                    : null
            };
        }
    }
}
