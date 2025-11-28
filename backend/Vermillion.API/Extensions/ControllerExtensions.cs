using Microsoft.AspNetCore.Mvc;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Extensions
{
    public static class ControllerExtensions
    {
        private const string HeaderKey = "X-Correlation-Id";

        public static ActionResult ServerError(this ControllerBase controller, string message)
        {
            var ctx = controller.HttpContext;
            string? correlationId = null;

            if (ctx.Items.ContainsKey(HeaderKey))
            {
                correlationId = ctx.Items[HeaderKey] as string;
            }

            var resp = ApiResponse<string>.ErrorResponse(message ?? "An unexpected error occurred.");
            resp.CorrelationId = correlationId;

            return controller.StatusCode(StatusCodes.Status500InternalServerError, resp);
        }

        public static ActionResult ServiceUnavailable<T>(this ControllerBase controller, string message, List<string>? errors = null)
        {
            var ctx = controller.HttpContext;
            string? correlationId = null;

            if (ctx.Items.ContainsKey(HeaderKey))
            {
                correlationId = ctx.Items[HeaderKey] as string;
            }

            var resp = ApiResponse<T>.ErrorResponse(message ?? "Service unavailable", errors);
            resp.CorrelationId = correlationId;

            return controller.StatusCode(StatusCodes.Status503ServiceUnavailable, resp);
        }
    }
}
