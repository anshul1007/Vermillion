using EntryExitAPI.Models.DTOs;
using System.Collections.Concurrent;

namespace EntryExitAPI.Services;

/// <summary>
/// Caching wrapper for AuthApiClient to reduce N+1 calls
/// Uses in-memory cache with configurable TTL
/// </summary>
public class CachedAuthApiClient : IAuthApiClient
{
    private readonly IAuthApiClient _authApiClient;
    private readonly ILogger<CachedAuthApiClient> _logger;
    private readonly TimeSpan _cacheDuration;

    private readonly ConcurrentDictionary<string, (object Value, DateTime ExpiresAt)> _cache = new();

    public CachedAuthApiClient(IAuthApiClient authApiClient, ILogger<CachedAuthApiClient> logger, TimeSpan? cacheDuration = null)
    {
        _authApiClient = authApiClient;
        _logger = logger;
        _cacheDuration = cacheDuration ?? TimeSpan.FromSeconds(60);
    }

    public async Task<List<EmployeeDto>?> GetAllEmployeesAsync()
    {
        var key = "all_employees";
        if (TryGetCached<List<EmployeeDto>>(key, out var cachedList))
        {
            return cachedList;
        }

        var result = await _authApiClient.GetAllEmployeesAsync();
        if (result != null)
        {
            SetCache(key, result);
            return result;
        }

        return null;
    }

    public async Task<string?> GetUserRoleAsync(int userId, string tenantDomain = "entryexit")
    {
        var key = $"role_{userId}_{tenantDomain}";
        if (TryGetCached<string>(key, out var cached))
        {
            return cached;
        }

        var result = await _authApiClient.GetUserRoleAsync(userId, tenantDomain);
        SetCache(key, result);
        return result;
    }

    public async Task<(bool Success, string Message)> CreateGuardUserAsync(CreateGuardDto createDto)
    {
        // Don't cache create operations, just delegate
        var result = await _authApiClient.CreateGuardUserAsync(createDto);
        
        // Invalidate employees cache since we just created a new user
        InvalidateEmployeesCache();
        
        return result;
    }

    public async Task<bool> UpdateUserAsync(string userId, UpdateGuardDto request)
    {
        var result = await _authApiClient.UpdateUserAsync(userId, request);
        // Invalidate employees cache on update
        InvalidateEmployeesCache();
        return result;
    }

    private bool TryGetCached<T>(string key, out T? value)
    {
        if (_cache.TryGetValue(key, out var entry))
        {
            if (DateTime.UtcNow < entry.ExpiresAt)
            {
                value = (T)entry.Value;
                return true;
            }
            else
            {
                _cache.TryRemove(key, out _);
            }
        }

        value = default;
        return false;
    }

    private void SetCache(string key, object? value)
    {
        if (value != null)
        {
            _cache[key] = (value, DateTime.UtcNow.Add(_cacheDuration));
        }
    }

    public void InvalidateCache()
    {
        _cache.Clear();
    }

    public void InvalidateEmployeesCache()
    {
        _cache.TryRemove("all_employees", out _);
    }
}
