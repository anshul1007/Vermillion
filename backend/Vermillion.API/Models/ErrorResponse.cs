namespace Vermillion.API.Models;

/// <summary>
/// Standard error response format for the API
/// </summary>
public class ErrorResponse
{
    /// <summary>
    /// HTTP status code
    /// </summary>
    public int StatusCode { get; set; }

    /// <summary>
    /// User-friendly error message
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Detailed error information (only in Development environment)
    /// </summary>
    public string? Details { get; set; }

    /// <summary>
    /// Stack trace (only in Development environment)
    /// </summary>
    public string? StackTrace { get; set; }

    /// <summary>
    /// Timestamp when the error occurred
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Request path that caused the error
    /// </summary>
    public string? Path { get; set; }
}
