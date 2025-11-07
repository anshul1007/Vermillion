using AuthAPI.Models.DTOs;
using AuthAPI.Models.Entities;

namespace AuthAPI.Services;

public interface IAuthService
{
    Task<(bool Success, LoginResponse? Response, string? Error)> LoginAsync(LoginRequest request);
    Task<(bool Success, LoginResponse? Response, string? Error)> RefreshTokenAsync(RefreshTokenRequest request);
    Task<(bool Success, User? User, string? Error)> RegisterUserAsync(RegisterUserRequest request);
    Task<bool> RevokeRefreshTokenAsync(string token);
}
