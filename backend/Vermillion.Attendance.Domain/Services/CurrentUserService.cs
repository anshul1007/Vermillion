using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Vermillion.Attendance.Domain.Services
{
    /// <summary>
    /// Implementation of ICurrentUserService that extracts user ID from HttpContext claims
    /// </summary>
    public class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public int? GetCurrentUserId()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null) return null;

            var sub = user.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                      ?? user.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(sub) || !int.TryParse(sub, out var userId))
            {
                return null;
            }

            return userId;
        }

        public int GetCurrentUserIdOrThrow()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                throw new UnauthorizedAccessException("Invalid or missing user claim");
            }

            return userId.Value;
        }
    }
}
