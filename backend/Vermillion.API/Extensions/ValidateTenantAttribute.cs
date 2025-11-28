using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Extensions
{
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
    public class ValidateTenantAttribute : ActionFilterAttribute
    {
        private readonly string _expectedTenant;

        public ValidateTenantAttribute(string expectedTenant)
        {
            _expectedTenant = expectedTenant;
        }

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var controller = context.Controller as ControllerBase;
            if (controller == null)
            {
                base.OnActionExecuting(context);
                return;
            }

            // Check claim first
            var tenantClaim = controller.User?.FindFirst("tenant")?.Value;
            if (!string.IsNullOrEmpty(tenantClaim) && string.Equals(tenantClaim, _expectedTenant, StringComparison.OrdinalIgnoreCase))
            {
                base.OnActionExecuting(context);
                return;
            }

            // Fallback to header
            if (controller.Request.Headers.TryGetValue("X-Tenant", out var headerValues))
            {
                var headerTenant = headerValues.ToString();
                if (!string.IsNullOrEmpty(headerTenant) && string.Equals(headerTenant, _expectedTenant, StringComparison.OrdinalIgnoreCase))
                {
                    base.OnActionExecuting(context);
                    return;
                }
            }

            var response = ApiResponse<string>.ErrorResponse(
                "Invalid tenant",
                new List<string> { "Request not permitted for current tenant" }
            );

            context.Result = new BadRequestObjectResult(response);
        }
    }
}
