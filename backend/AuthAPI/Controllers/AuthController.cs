using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuthAPI.Models.DTOs;
using AuthAPI.Services;
using AuthAPI.Data;

namespace AuthAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly AuthDbContext _context;

    public AuthController(IAuthService authService, AuthDbContext context)
    {
        _authService = authService;
        _context = context;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (success, response, error) = await _authService.LoginAsync(request);
        
        if (!success)
            return Unauthorized(new ApiResponse<string>(false, null, error));

        return Ok(new ApiResponse<LoginResponse>(true, response, "Login successful"));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var (success, response, error) = await _authService.RefreshTokenAsync(request);
        
        if (!success)
            return Unauthorized(new ApiResponse<string>(false, null, error));

        return Ok(new ApiResponse<LoginResponse>(true, response, "Token refreshed"));
    }

    [HttpPost("revoke")]
    public async Task<IActionResult> RevokeToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RevokeRefreshTokenAsync(request.RefreshToken);
        
        if (!result)
            return NotFound(new ApiResponse<string>(false, null, "Token not found"));

        return Ok(new ApiResponse<string>(true, null, "Token revoked"));
    }
}
