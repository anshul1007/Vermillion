using AttendanceAPI.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.FeatureManagement;

namespace AttendanceAPI.Services
{
    public class DatabaseFeatureDefinitionProvider : IFeatureDefinitionProvider
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DatabaseFeatureDefinitionProvider> _logger;

        public DatabaseFeatureDefinitionProvider(
            IServiceProvider serviceProvider,
            ILogger<DatabaseFeatureDefinitionProvider> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async IAsyncEnumerable<FeatureDefinition> GetAllFeatureDefinitionsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var features = await context.FeatureToggles.ToListAsync();

            foreach (var feature in features)
            {
                yield return new FeatureDefinition
                {
                    Name = feature.FeatureKey,
                    EnabledFor = feature.IsEnabled
                        ? new List<FeatureFilterConfiguration>()
                        : null
                };
            }
        }

        public async Task<FeatureDefinition?> GetFeatureDefinitionAsync(string featureName)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var feature = await context.FeatureToggles
                .FirstOrDefaultAsync(f => f.FeatureKey == featureName);

            if (feature == null)
            {
                return null;
            }

            return new FeatureDefinition
            {
                Name = feature.FeatureKey,
                EnabledFor = feature.IsEnabled
                    ? new List<FeatureFilterConfiguration>()
                    : null
            };
        }
    }
}
