namespace Vermillion.Shared.Domain.Models.DTOs;

/// <summary>
/// Unified API response wrapper for all controllers
/// Provides consistent response structure across all domains
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }
    public List<string>? Errors { get; set; }
    public string? CorrelationId { get; set; }

    /// <summary>
    /// Creates a successful response with data
    /// </summary>
    public static ApiResponse<T> SuccessResponse(T data, string? message = null)
    {
        return new ApiResponse<T>
        {
            Success = true,
            Data = data,
            Message = message
        };
    }

    /// <summary>
    /// Creates an error response with message and optional errors list
    /// </summary>
    public static ApiResponse<T> ErrorResponse(string message)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Errors = new List<string> { }
        };
    }

    /// <summary>
    /// Creates an error response with message and optional errors list
    /// </summary>
    public static ApiResponse<T> ErrorResponse(string message, List<string>? errors = null)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Errors = errors
        };
    }

    /// <summary>
    /// Creates an error response with a single error detail
    /// </summary>
    public static ApiResponse<T> ErrorResponse(string message, string errorDetail)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Errors = new List<string> { errorDetail ?? string.Empty }
        };
    }
}
