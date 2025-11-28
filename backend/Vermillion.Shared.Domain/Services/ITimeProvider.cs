namespace Vermillion.Shared.Domain.Services;

/// <summary>
/// Provides access to system time in a testable way
/// Allows mocking time for unit tests
/// </summary>
public interface ITimeProvider
{
    /// <summary>
    /// Gets the current UTC DateTime
    /// </summary>
    DateTime UtcNow { get; }

    /// <summary>
    /// Gets the current UTC date
    /// </summary>
    DateOnly Today { get; }

    /// <summary>
    /// Gets the current local DateTime
    /// </summary>
    DateTime Now { get; }
}
