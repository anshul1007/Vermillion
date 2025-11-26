using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;

namespace Vermillion.API.Extensions
{
    public static class TenantValidationExtensions
    {
        public static IActionResult? ValidateTenantOrBadRequest(this ControllerBase controller, string expectedTenant)
        {
            // Prefer a tenant claim, fall back to header `X-Tenant` if present
            var tenantClaim = controller.User?.Claims?.FirstOrDefault(c => c.Type == "tenant")?.Value;
            if (!string.IsNullOrEmpty(tenantClaim))
            {
                if (!string.Equals(tenantClaim, expectedTenant, StringComparison.OrdinalIgnoreCase))
                    return controller.BadRequest(new EntryExit.Domain.Models.DTOs.AuthApiResponse<object> { Success = false, Message = "Invalid tenant for this endpoint" });
                return null;
            }

            if (controller.Request?.Headers != null && controller.Request.Headers.TryGetValue("X-Tenant", out var headerVal))
            {
                if (!string.Equals(headerVal.ToString(), expectedTenant, StringComparison.OrdinalIgnoreCase))
                    return controller.BadRequest(new EntryExit.Domain.Models.DTOs.AuthApiResponse<object> { Success = false, Message = "Invalid tenant for this endpoint" });
            }

            return null;
        }
    }
}
