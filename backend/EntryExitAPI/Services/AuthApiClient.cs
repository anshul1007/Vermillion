using EntryExitAPI.Models.DTOs;
using System.Text;
using System.Text.Json;

namespace EntryExitAPI.Services;

public interface IAuthApiClient
{
    Task<List<EmployeeDto>?> GetAllEmployeesAsync();
    Task<string?> GetUserRoleAsync(int userId, string tenantDomain = "entryexit");
    Task<(bool Success, string Message)> CreateGuardUserAsync(CreateGuardDto createDto);
    Task<bool> UpdateUserAsync(string userId, UpdateGuardDto request);
}

public class AuthApiClient : IAuthApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AuthApiClient> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuthApiClient(HttpClient http, ILogger<AuthApiClient> logger, IHttpContextAccessor httpContextAccessor)
    {
        _http = http;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    // Helper that forwards the caller's Authorization header (if present) to the AuthAPI call
    private async Task<HttpResponseMessage> SendGetAsync(string path)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, path);
        try
        {
            var auth = _httpContextAccessor?.HttpContext?.Request?.Headers["Authorization"].FirstOrDefault();
            if (!string.IsNullOrEmpty(auth))
            {
                // copy header as-is (e.g., "Bearer <token>")
                req.Headers.TryAddWithoutValidation("Authorization", auth);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to copy Authorization header to outgoing AuthAPI request");
        }

        return await _http.SendAsync(req);
    }

    // Proxy to AuthAPI /api/users/employees which returns list of employees and their user info
    public async Task<List<EmployeeDto>?> GetAllEmployeesAsync()
    {
        try
        {
            var resp = await SendGetAsync($"/api/users/employees");
            if (!resp.IsSuccessStatusCode)
            {
                string body = string.Empty;
                try { body = await resp.Content.ReadAsStringAsync(); } catch { }
                _logger.LogWarning("AuthAPI returned {Status} when fetching all employees. Body: {Body}", resp.StatusCode, body);
                return null;
            }

            var content = await resp.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(content))
                return null;

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // Try AuthApiResponse<List<EmployeeDto>> shape first
            try
            {
                var wrapped = JsonSerializer.Deserialize<AuthApiResponse<List<EmployeeDto>>>(content, options);
                if (wrapped != null && wrapped.Data != null)
                    return wrapped.Data;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to deserialize employees as AuthApiResponse<List<EmployeeDto>>");
            }

            // Try raw array
            try
            {
                var list = JsonSerializer.Deserialize<List<EmployeeDto>>(content, options);
                if (list != null)
                    return list;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to deserialize employees as List<EmployeeDto>");
            }

            _logger.LogWarning("Unexpected payload shape when fetching all employees from AuthAPI. Content: {ContentPreview}", content.Length > 200 ? content.Substring(0, 200) + "..." : content);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all employees from AuthAPI");
            return null;
        }
    }

    // Calls AuthAPI to fetch the user's effective role for the specified tenant
    public async Task<string?> GetUserRoleAsync(int userId, string tenantDomain = "entryexit")
    {
        try
        {
            var resp = await SendGetAsync($"/api/users/{userId}/effective-role?tenantDomain={tenantDomain}");
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("AuthAPI returned {Status} when fetching role for user {UserId} in tenant {Tenant}", resp.StatusCode, userId, tenantDomain);
                return null;
            }

            var content = await resp.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(content))
                return null;

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // Response format: { role: "RoleName" }
            try
            {
                var doc = JsonSerializer.Deserialize<JsonElement>(content, options);
                if (doc.ValueKind == JsonValueKind.Object && doc.TryGetProperty("role", out var roleProp))
                {
                    return roleProp.GetString();
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to deserialize role response");
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling AuthAPI for user role {UserId}", userId);
            return null;
        }
    }

    // Creates a guard user in the AuthAPI
    public async Task<(bool Success, string Message)> CreateGuardUserAsync(CreateGuardDto createDto)
    {
        try
        {
            // Build the create user request for AuthAPI
            var createUserDto = new
            {
                tenantDomain = "entryexit",
                username = createDto.Email, // Use email as username
                email = createDto.Email,
                password = createDto.Password,
                role = "Guard",
                employeeId = createDto.EmployeeId,
                firstName = createDto.FirstName,
                lastName = createDto.LastName,
                phoneNumber = createDto.PhoneNumber
            };

            var json = JsonSerializer.Serialize(createUserDto);
            var httpContent = new StringContent(json, Encoding.UTF8, "application/json");

            // Forward the Authorization header
            var req = new HttpRequestMessage(HttpMethod.Post, "/api/admin/users")
            {
                Content = httpContent
            };

            try
            {
                var auth = _httpContextAccessor?.HttpContext?.Request?.Headers["Authorization"].FirstOrDefault();
                if (!string.IsNullOrEmpty(auth))
                {
                    req.Headers.TryAddWithoutValidation("Authorization", auth);
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to copy Authorization header");
            }

            var response = await _http.SendAsync(req);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("AuthAPI returned {Status} when creating guard. Response: {Response}", response.StatusCode, responseContent);
                return (false, $"Failed to create guard user: {responseContent}");
            }

            _logger.LogInformation("Successfully created guard user {Email}", createDto.Email);
            return (true, responseContent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating guard in AuthAPI");
            return (false, $"Error creating guard: {ex.Message}");
        }
    }

    public async Task<bool> UpdateUserAsync(string userId, UpdateGuardDto request)
    {
        try
        {
            var updateDto = new
            {
                username = request.Email, // using email as username if present
                email = request.Email,
                password = request.Password,
                firstName = request.FirstName,
                lastName = request.LastName,
                phoneNumber = request.PhoneNumber,
                isActive = request.IsActive
            };

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
            var json = JsonSerializer.Serialize(updateDto, options);
            var httpContent = new StringContent(json, Encoding.UTF8, "application/json");

            var req = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/users/{userId}")
            {
                Content = httpContent
            };

            try
            {
                var auth = _httpContextAccessor?.HttpContext?.Request?.Headers["Authorization"].FirstOrDefault();
                if (!string.IsNullOrEmpty(auth))
                {
                    req.Headers.TryAddWithoutValidation("Authorization", auth);
                }
            }
            catch { }

            var resp = await _http.SendAsync(req);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user in AuthAPI");
            return false;
        }
    }
}
