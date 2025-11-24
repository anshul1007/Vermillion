namespace Vermillion.Attendance.Domain.Services
{
    /// <summary>
    /// Service to resolve the current authenticated user's ID from JWT claims
    /// </summary>
    public interface ICurrentUserService
    {
        /// <summary>
        /// Gets the current user's ID from JWT claims (sub or NameIdentifier)
        /// </summary>
        /// <returns>User ID if found and valid, null otherwise</returns>
        int? GetCurrentUserId();

        /// <summary>
        /// Gets the current user's ID from JWT claims or throws UnauthorizedAccessException
        /// </summary>
        /// <returns>User ID</returns>
        /// <exception cref="UnauthorizedAccessException">If user claim is missing or invalid</exception>
        int GetCurrentUserIdOrThrow();
    }
}
