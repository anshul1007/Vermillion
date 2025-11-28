namespace Vermillion.Shared.Domain.Services;

/// <summary>
/// System implementation of ITimeProvider
/// Returns actual system time
/// </summary>
public class SystemTimeProvider : ITimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;

    public DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public DateTime Now => DateTime.Now;
}
