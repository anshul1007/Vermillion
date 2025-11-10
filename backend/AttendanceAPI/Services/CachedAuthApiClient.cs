using System.Collections.Concurrent;

namespace AttendanceAPI.Services
{
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

        public async Task<string?> GetUserRoleAsync(int authUserId)
        {
            var key = $"role_{authUserId}";
            if (TryGetCached<string>(key, out var cached))
            {
                return cached;
            }

            var result = await _authApiClient.GetUserRoleAsync(authUserId);
            SetCache(key, result);
            return result;
        }

        public async Task<(int Id, string? Name, bool IsActive)?> GetRoleByIdAsync(int roleId)
        {
            var key = $"roleInfo_{roleId}";
            if (TryGetCached<(int, string?, bool)?>(key, out var cached))
            {
                return cached;
            }

            var result = await _authApiClient.GetRoleByIdAsync(roleId);
            SetCache(key, result);
            return result;
        }

        public async Task<(string? FirstName, string? LastName, bool? IsActive)?> GetNameByAuthUserIdAsync(int authUserId)
        {
            var key = $"name_{authUserId}";
            if (TryGetCached<(string?, string?, bool?)?>(key, out var cached))
            {
                return cached;
            }

            var result = await _authApiClient.GetNameByAuthUserIdAsync(authUserId);
            SetCache(key, result);
            return result;
        }

        public async Task<bool?> GetUserIsActiveAsync(int authUserId)
        {
            var key = $"isActive_{authUserId}";
            if (TryGetCached<bool?>(key, out var cached))
            {
                return cached;
            }

            var result = await _authApiClient.GetUserIsActiveAsync(authUserId);
            SetCache(key, result);
            return result;
        }

        public async Task<string?> GetEmailByAuthUserIdAsync(int authUserId)
        {
            var key = $"email_{authUserId}";
            if (TryGetCached<string>(key, out var cached))
            {
                return cached;
            }

            var result = await _authApiClient.GetEmailByAuthUserIdAsync(authUserId);
            SetCache(key, result);
            return result;
        }

        public Task<int?> GetUserIdByEmailAsync(string email)
        {
            // Don't cache email lookups as they're used less frequently
            return _authApiClient.GetUserIdByEmailAsync(email);
        }

        public async Task<List<Models.DTOs.EmployeeDto>?> GetAllEmployeesAsync()
        {
            var key = "all_employees";
            if (TryGetCached<List<Models.DTOs.EmployeeDto>>(key, out var cachedList))
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

        public async Task<List<Models.DTOs.DepartmentDto>?> GetAllDepartmentsAsync()
        {
            var key = "all_departments";
            if (TryGetCached<List<Models.DTOs.DepartmentDto>>(key, out var cachedDeptList))
            {
                return cachedDeptList;
            }

            var result = await _authApiClient.GetAllDepartmentsAsync();
            if (result != null)
            {
                SetCache(key, result);
                return result;
            }

            return null;
        }

        public async Task<(bool Success, string? Message, Models.DTOs.DepartmentDto? Department)> CreateDepartmentAsync(Models.DTOs.DepartmentDto request)
        {
            // Invalidate departments cache so next read reflects new item
            _cache.TryRemove("all_departments", out _);
            return await _authApiClient.CreateDepartmentAsync(request);
        }

        public async Task<(bool Success, string? Message, Models.DTOs.DepartmentDto? Department)> UpdateDepartmentAsync(string departmentId, Models.DTOs.DepartmentDto request)
        {
            // Invalidate departments cache
            _cache.TryRemove("all_departments", out _);
            return await _authApiClient.UpdateDepartmentAsync(departmentId, request);
        }

        public async Task<(bool Success, string? Message)> DeleteDepartmentAsync(string departmentId)
        {
            // Invalidate departments cache
            _cache.TryRemove("all_departments", out _);
            return await _authApiClient.DeleteDepartmentAsync(departmentId);
        }

        public async Task<bool> UpdateUserAsync(string userId, Models.DTOs.UpdateUserRequest request)
        {
            // Invalidate relevant caches when updating a user
            InvalidateUserCache(userId);
            
            // Delegate to the underlying client
            return await _authApiClient.UpdateUserAsync(userId, request);
        }

        private void InvalidateUserCache(string userId)
        {
            // Remove specific user-related cache entries
            _cache.TryRemove("all_employees", out _);
            // You could add more specific cache invalidation here if needed
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
    }
}
