using System.Text.Json;
using System.Text.Json.Serialization;

namespace AttendanceAPI.Services
{
    public interface IAuthApiClient
    {
        Task<string?> GetUserRoleAsync(int authUserId);
        Task<(int Id, string? Name, bool IsActive)?> GetRoleByIdAsync(int roleId);
        Task<string?> GetEmailByAuthUserIdAsync(int authUserId);
        Task<(string? FirstName, string? LastName, bool? IsActive)?> GetNameByAuthUserIdAsync(int authUserId);
        Task<bool?> GetUserIsActiveAsync(int authUserId);
        Task<int?> GetUserIdByEmailAsync(string email);
        Task<List<Models.DTOs.EmployeeDto>?> GetAllEmployeesAsync();
        Task<List<Models.DTOs.DepartmentDto>?> GetAllDepartmentsAsync();
        Task<(bool Success, string? Message, Models.DTOs.DepartmentDto? Department)> CreateDepartmentAsync(Models.DTOs.DepartmentDto request);
        Task<(bool Success, string? Message, Models.DTOs.DepartmentDto? Department)> UpdateDepartmentAsync(string departmentId, Models.DTOs.DepartmentDto request);
        Task<(bool Success, string? Message)> DeleteDepartmentAsync(string departmentId);
        Task<bool> UpdateUserAsync(string userId, Models.DTOs.UpdateUserRequest request);
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

        // Calls AuthAPI to fetch the user's effective role for the attendance tenant.
        public async Task<string?> GetUserRoleAsync(int authUserId)
        {
            try
            {
                var resp = await SendGetAsync($"/api/users/{authUserId}/effective-role?tenantDomain=attendance");
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when fetching role for {UserId}", resp.StatusCode, authUserId);
                    return null;
                }

                var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (doc.ValueKind == JsonValueKind.Object && doc.TryGetProperty("role", out var roleProp))
                {
                    return roleProp.GetString();
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling AuthAPI for user role {UserId}", authUserId);
                return null;
            }
        }

        public async Task<(int Id, string? Name, bool IsActive)?> GetRoleByIdAsync(int roleId)
        {
            try
            {
                var resp = await SendGetAsync($"/api/roles/{roleId}");
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when fetching role {RoleId}", resp.StatusCode, roleId);
                    return null;
                }

                var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (doc.ValueKind == JsonValueKind.Object)
                {
                    var id = doc.GetProperty("data").GetProperty("id").GetInt32();
                    var name = doc.GetProperty("data").GetProperty("name").GetString();
                    var isActive = doc.GetProperty("data").GetProperty("isActive").GetBoolean();
                    return (id, name, isActive);
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching role {RoleId} from AuthAPI", roleId);
                return null;
            }
        }

        public async Task<string?> GetEmailByAuthUserIdAsync(int authUserId)
        {
            try
            {
                var resp = await SendGetAsync($"/api/users/{authUserId}");
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when fetching user {UserId}", resp.StatusCode, authUserId);
                    return null;
                }

                var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (doc.ValueKind == JsonValueKind.Object && doc.TryGetProperty("email", out var emailProp))
                {
                    return emailProp.GetString();
                }

                // Try nested data shape
                if (doc.ValueKind == JsonValueKind.Object && doc.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object && data.TryGetProperty("email", out var emailProp2))
                {
                    return emailProp2.GetString();
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user profile {UserId} from AuthAPI", authUserId);
                return null;
            }
        }

        public async Task<(string? FirstName, string? LastName, bool? IsActive)?> GetNameByAuthUserIdAsync(int authUserId)
        {
            try
            {
                var resp = await SendGetAsync($"/api/users/{authUserId}");
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when fetching user {UserId}", resp.StatusCode, authUserId);
                    return null;
                }

                var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (doc.ValueKind == JsonValueKind.Object)
                {
                    // Try direct properties
                    string? first = null;
                    string? last = null;
                    bool? isActive = null;
                    if (doc.TryGetProperty("firstName", out var fn)) first = fn.GetString();
                    if (doc.TryGetProperty("lastName", out var ln)) last = ln.GetString();
                    if (doc.TryGetProperty("isActive", out var ia)) isActive = ia.GetBoolean();

                    // Try nested data shape
                    if ((first == null || last == null) && doc.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object)
                    {
                        if (first == null && data.TryGetProperty("firstName", out var fn2)) first = fn2.GetString();
                        if (last == null && data.TryGetProperty("lastName", out var ln2)) last = ln2.GetString();
                        if (isActive == null && data.TryGetProperty("isActive", out var ia2)) isActive = ia2.GetBoolean();
                    }

                    if (first != null || last != null || isActive != null)
                    {
                        return (first, last, isActive);
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching name for user {UserId} from AuthAPI", authUserId);
                return null;
            }
        }

        public async Task<bool?> GetUserIsActiveAsync(int authUserId)
        {
            try
            {
                var resp = await SendGetAsync($"/api/users/{authUserId}");
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when fetching user {UserId}", resp.StatusCode, authUserId);
                    return null;
                }

                var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (doc.ValueKind == JsonValueKind.Object)
                {
                    if (doc.TryGetProperty("isActive", out var ia))
                        return ia.GetBoolean();

                    if (doc.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object && data.TryGetProperty("isActive", out var ia2))
                        return ia2.GetBoolean();
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching isActive for user {UserId} from AuthAPI", authUserId);
                return null;
            }
        }

        public async Task<int?> GetUserIdByEmailAsync(string email)
        {
            const int maxAttempts = 3;
            int attempt = 0;
            while (attempt < maxAttempts)
            {
                attempt++;
                try
                {
                    var resp = await SendGetAsync($"/api/users/by-email/{Uri.EscapeDataString(email)}");
                    if (!resp.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("AuthAPI returned {Status} when looking up user by email {Email} (attempt {Attempt})", resp.StatusCode, email, attempt);
                        return null;
                    }

                    var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.ValueKind == JsonValueKind.Object && doc.TryGetProperty("id", out var idProp))
                    {
                        return idProp.GetInt32();
                    }

                    if (doc.ValueKind == JsonValueKind.Object && doc.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object && data.TryGetProperty("id", out var id2))
                    {
                        return id2.GetInt32();
                    }

                    return null;
                }
                catch (HttpRequestException ex) when (attempt < maxAttempts)
                {
                    _logger.LogWarning(ex, "Transient network error resolving user by email {Email}, retrying (attempt {Attempt})", email, attempt);
                    await Task.Delay(500 * attempt);
                    continue;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error looking up user id by email {Email}", email);
                    return null;
                }
            }

            return null;
        }

        // Proxy to AuthAPI /api/users/employees which returns list of employees and their user info
        public async Task<List<Models.DTOs.EmployeeDto>?> GetAllEmployeesAsync()
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
                options.Converters.Add(new StringOrArrayConverter());

                // Try ApiResponse<List<EmployeeDto>> shape first
                try
                {
                    var wrapped = JsonSerializer.Deserialize<Models.DTOs.ApiResponse<List<Models.DTOs.EmployeeDto>>>(content, options);
                    if (wrapped != null && wrapped.Data != null)
                        return wrapped.Data;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Failed to deserialize employees as ApiResponse<List<EmployeeDto>>");
                }

                // Try raw array
                try
                {
                    var list = JsonSerializer.Deserialize<List<Models.DTOs.EmployeeDto>>(content, options);
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

        public async Task<List<Models.DTOs.DepartmentDto>?> GetAllDepartmentsAsync()
        {
            try
            {
                var resp = await SendGetAsync($"/api/users/departments");
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when fetching departments", resp.StatusCode);
                    return null;
                }

                var content = await resp.Content.ReadAsStringAsync();
                if (string.IsNullOrWhiteSpace(content))
                    return null;

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                options.Converters.Add(new StringOrArrayConverter());

                // Try wrapped ApiResponse<List<DepartmentDto>>
                try
                {
                    var wrapped = JsonSerializer.Deserialize<Models.DTOs.ApiResponse<List<Models.DTOs.DepartmentDto>>>(content, options);
                    if (wrapped != null && wrapped.Data != null)
                        return wrapped.Data;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Failed to deserialize departments as ApiResponse<List<DepartmentDto>>");
                }

                // Try raw array
                try
                {
                    var list = JsonSerializer.Deserialize<List<Models.DTOs.DepartmentDto>>(content, options);
                    if (list != null)
                        return list;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Failed to deserialize departments as List<DepartmentDto>");
                }

                _logger.LogWarning("Unexpected payload shape when fetching departments from AuthAPI. Content: {ContentPreview}", content.Length > 200 ? content.Substring(0, 200) + "..." : content);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching departments from AuthAPI");
                return null;
            }
        }

        public async Task<(bool Success, string? Message, Models.DTOs.DepartmentDto? Department)> CreateDepartmentAsync(Models.DTOs.DepartmentDto request)
        {
            try
            {
                var json = JsonSerializer.Serialize(new
                {
                    name = request.Name,
                    description = request.Description,
                    weeklyOffDays = request.WeeklyOffDays != null ? string.Join(',', request.WeeklyOffDays) : null,
                    isActive = request.IsActive
                });

                var httpContent = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                var req = new HttpRequestMessage(HttpMethod.Post, "/api/admin/departments") { Content = httpContent };
                try
                {
                    var auth = _httpContextAccessor?.HttpContext?.Request?.Headers["Authorization"].FirstOrDefault();
                    if (!string.IsNullOrEmpty(auth)) req.Headers.TryAddWithoutValidation("Authorization", auth);
                }
                catch { }

                var resp = await _http.SendAsync(req);
                var content = await resp.Content.ReadAsStringAsync();

                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when creating department. Response: {Response}", resp.StatusCode, content);
                    return (false, content, null);
                }

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                try
                {
                    var wrapped = JsonSerializer.Deserialize<Models.DTOs.ApiResponse<Models.DTOs.DepartmentDto>>(content, options);
                    if (wrapped != null && wrapped.Data != null)
                        return (true, null, wrapped.Data);
                }
                catch { }

                try
                {
                    var dept = JsonSerializer.Deserialize<Models.DTOs.DepartmentDto>(content, options);
                    if (dept != null) return (true, null, dept);
                }
                catch { }

                return (true, null, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating department in AuthAPI");
                return (false, ex.Message, null);
            }
        }

        public async Task<(bool Success, string? Message, Models.DTOs.DepartmentDto? Department)> UpdateDepartmentAsync(string departmentId, Models.DTOs.DepartmentDto request)
        {
            try
            {
                var json = JsonSerializer.Serialize(new
                {
                    name = request.Name,
                    description = request.Description,
                    weeklyOffDays = request.WeeklyOffDays != null ? string.Join(',', request.WeeklyOffDays) : null,
                    isActive = request.IsActive
                });

                var httpContent = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                var req = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/departments/{Uri.EscapeDataString(departmentId)}") { Content = httpContent };
                try
                {
                    var auth = _httpContextAccessor?.HttpContext?.Request?.Headers["Authorization"].FirstOrDefault();
                    if (!string.IsNullOrEmpty(auth)) req.Headers.TryAddWithoutValidation("Authorization", auth);
                }
                catch { }

                var resp = await _http.SendAsync(req);
                var content = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when updating department {Id}. Response: {Response}", resp.StatusCode, departmentId, content);
                    return (false, content, null);
                }

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                try
                {
                    var wrapped = JsonSerializer.Deserialize<Models.DTOs.ApiResponse<Models.DTOs.DepartmentDto>>(content, options);
                    if (wrapped != null && wrapped.Data != null)
                        return (true, null, wrapped.Data);
                }
                catch { }

                try
                {
                    var dept = JsonSerializer.Deserialize<Models.DTOs.DepartmentDto>(content, options);
                    if (dept != null) return (true, null, dept);
                }
                catch { }

                return (true, null, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating department in AuthAPI");
                return (false, ex.Message, null);
            }
        }

        public async Task<(bool Success, string? Message)> DeleteDepartmentAsync(string departmentId)
        {
            try
            {
                var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/admin/departments/{Uri.EscapeDataString(departmentId)}");
                try
                {
                    var auth = _httpContextAccessor?.HttpContext?.Request?.Headers["Authorization"].FirstOrDefault();
                    if (!string.IsNullOrEmpty(auth)) req.Headers.TryAddWithoutValidation("Authorization", auth);
                }
                catch { }

                var resp = await _http.SendAsync(req);
                var content = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AuthAPI returned {Status} when deleting department {Id}. Response: {Response}", resp.StatusCode, departmentId, content);
                    return (false, content);
                }

                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting department in AuthAPI");
                return (false, ex.Message);
            }
        }

        public async Task<bool> UpdateUserAsync(string userId, Models.DTOs.UpdateUserRequest request)
        {
            try
            {
                // Forward the JWT token
                var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].ToString();
                if (!string.IsNullOrEmpty(token))
                    _http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token.Replace("Bearer ", ""));

                // Build the update request for AuthAPI
                var authApiRequest = new
                {
                    email = request.Email,
                    firstName = request.FirstName,
                    lastName = request.LastName,
                    role = request.Role,
                    managerId = request.ManagerId != null ? request.ManagerId.ToString() : null,
                    departmentId = request.DepartmentId != null ? request.DepartmentId.ToString() : null,
                    isActive = request.IsActive
                };

                var response = await _http.PutAsJsonAsync($"api/Admin/users/{userId}", authApiRequest);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to update user {UserId} in AuthAPI. Status: {Status}, Error: {Error}", 
                        userId, response.StatusCode, errorContent);
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user {UserId} in AuthAPI", userId);
                return false;
            }
        }
    }
}

// Converter to handle JSON that sometimes encodes a list of strings as a single comma-separated string
internal class StringOrArrayConverter : JsonConverter<List<string>?>
{
    public override List<string>? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return null;

        if (reader.TokenType == JsonTokenType.StartArray)
        {
            var list = new List<string>();
            while (reader.Read())
            {
                if (reader.TokenType == JsonTokenType.EndArray)
                    break;
                if (reader.TokenType == JsonTokenType.String)
                {
                    list.Add(reader.GetString()!);
                }
                else
                {
                    // Read the value as JsonDocument and append its raw text or string representation
                    try
                    {
                        var doc = JsonDocument.ParseValue(ref reader);
                        list.Add(doc.RootElement.ToString());
                    }
                    catch
                    {
                        // fall back
                        list.Add(string.Empty);
                    }
                }
            }
            return list;
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            if (string.IsNullOrWhiteSpace(s)) return new List<string>();
            return s.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        }

        // unexpected token - try to deserialize generically
        try
        {
            var doc = JsonDocument.ParseValue(ref reader);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                return doc.RootElement.EnumerateArray().Select(e => e.GetString() ?? e.ToString()).ToList();
            }
        }
        catch { }

        return null;
    }

    public override void Write(Utf8JsonWriter writer, List<string>? value, JsonSerializerOptions options)
    {
        if (value == null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStartArray();
        foreach (var s in value)
            writer.WriteStringValue(s);
        writer.WriteEndArray();
    }
}
