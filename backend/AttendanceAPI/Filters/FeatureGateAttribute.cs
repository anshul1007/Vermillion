using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.FeatureManagement;

namespace AttendanceAPI.Filters
{
    /// <summary>
    /// Use this attribute to gate controller actions behind feature toggles
    /// Example: [FeatureGate("AttendanceGeolocation")]
    /// </summary>
    public class FeatureGateAttribute : ActionFilterAttribute
    {
        private readonly string _featureName;

        public FeatureGateAttribute(string featureName)
        {
            _featureName = featureName;
        }

        public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var featureManager = context.HttpContext.RequestServices.GetRequiredService<IFeatureManager>();
            
            if (!await featureManager.IsEnabledAsync(_featureName))
            {
                // Return 403 Forbidden to indicate the user is authenticated but the feature is not available
                context.Result = new ObjectResult(new
                {
                    success = false,
                    message = $"Feature '{_featureName}' is currently disabled",
                    errors = new[] { "This feature is not available for your tenant or configuration" }
                })
                {
                    StatusCode = StatusCodes.Status403Forbidden
                };
                return;
            }

            await next();
        }
    }
}
