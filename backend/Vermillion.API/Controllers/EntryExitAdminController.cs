using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Services;
using Vermillion.Auth.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/entryexit/admin")]
[Authorize]
public class EntryExitAdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly ILogger<EntryExitAdminController> _logger;
    private readonly IUserService _userService;

    public EntryExitAdminController(IAdminService adminService, ILogger<EntryExitAdminController> logger, IUserService userService)
    {
        _adminService = adminService;
        _logger = logger;
        _userService = userService;
    }

    // Get users for EntryExit tenant (Guards)
    [HttpGet("users")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult> GetUsers()
    {
        try
        {
            var employees = await _userService.GetAllEmployeesAsync(excludeGuards: false);
            if (employees == null)
                return StatusCode(502, new { success = false, message = "Failed to fetch users" });

            // Filter users with Guard role in EntryExit tenant
            var guardsWithRoles = new List<GuardListItemDto>();

            foreach (var emp in employees)
            {
                // Get role for EntryExit tenant
                var roleName = await _userService.GetUserRoleAsync(emp.UserId, "entryexit");

                // Only include users with Guard role in EntryExit tenant
                if (roleName == "Guard")
                {
                    guardsWithRoles.Add(new GuardListItemDto
                    {
                        Id = emp.UserId.ToString(),
                        EmployeeId = emp.EmployeeId,
                        FirstName = emp.FirstName ?? string.Empty,
                        LastName = emp.LastName ?? string.Empty,
                        Email = emp.User?.Email ?? string.Empty,
                        PhoneNumber = emp.PhoneNumber,
                        IsActive = emp.User?.IsActive ?? false,
                        Role = roleName
                    });
                }
            }

            return Ok(new { success = true, data = guardsWithRoles, message = (string?)null });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users");
            return StatusCode(500, new { success = false, message = "Error getting users", errors = new[] { ex.Message } });
        }
    }

    // Guards - simplified endpoints for guard management
    [HttpGet("guards/list")]
    public async Task<ActionResult> GetGuardsList()
    {
        try
        {
            var employees = await _userService.GetAllEmployeesAsync(excludeGuards: false);
            if (employees == null)
                return StatusCode(502, new { success = false, message = "Failed to fetch users" });

            // Filter users with Guard role in EntryExit tenant
            var guardsWithRoles = new List<GuardListItemDto>();

            foreach (var emp in employees)
            {
                // Get role for EntryExit tenant
                var roleName = await _userService.GetUserRoleAsync(emp.UserId, "entryexit");

                // Only include users with Guard role in EntryExit tenant
                if (roleName == "Guard")
                {
                    guardsWithRoles.Add(new GuardListItemDto
                    {
                        Id = emp.UserId.ToString(),
                        EmployeeId = emp.EmployeeId,
                        FirstName = emp.FirstName ?? string.Empty,
                        LastName = emp.LastName ?? string.Empty,
                        Email = emp.User?.Email ?? string.Empty,
                        PhoneNumber = emp.PhoneNumber,
                        IsActive = emp.User?.IsActive ?? false,
                        Role = roleName
                    });
                }
            }

            return Ok(new { success = true, data = guardsWithRoles, message = (string?)null });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting guards list");
            return StatusCode(500, new { success = false, message = "Error getting guards list", errors = new[] { ex.Message } });
        }
    }

    [HttpPost("guards/create")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult> CreateGuard([FromBody] CreateGuardDto createDto)
    {
        try
        {
            // Hash the password (you should use proper password hashing in production)
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(createDto.Password);

            var (success, message, userId) = await _userService.CreateUserAsync(
                username: createDto.Email,
                email: createDto.Email,
                passwordHash: passwordHash,
                tenantDomain: "entryexit",
                roleName: "Guard",
                employeeId: createDto.EmployeeId,
                firstName: createDto.FirstName,
                lastName: createDto.LastName,
                phoneNumber: createDto.PhoneNumber,
                departmentId: null,
                managerId: null
            );

            if (!success)
            {
                return BadRequest(new { success = false, message = "Failed to create guard", error = message });
            }

            return Ok(new { success = true, message = "Guard created successfully", userId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating guard");
            return StatusCode(500, new { success = false, message = "Error creating guard", errors = new[] { ex.Message } });
        }
    }

    [HttpPut("guards/{authUserId}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult> UpdateGuard(string authUserId, [FromBody] UpdateGuardDto updateDto)
    {
        try
        {
            if (!int.TryParse(authUserId, out var userId))
                return BadRequest(new { success = false, message = "Invalid user ID" });

            var ok = await _userService.UpdateUserAsync(
                userId: userId,
                email: updateDto.Email,
                firstName: updateDto.FirstName,
                lastName: updateDto.LastName,
                phoneNumber: updateDto.PhoneNumber,
                roleId: null,
                managerId: null,
                departmentId: null,
                isActive: updateDto.IsActive
            );

            if (!ok)
                return BadRequest(new { success = false, message = "Failed to update guard" });

            return Ok(new { success = true, message = "Guard updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating guard");
            return StatusCode(500, new { success = false, message = "Error updating guard", errors = new[] { ex.Message } });
        }
    }

    // Projects
    [HttpPost("projects")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<ProjectDto>>> CreateProject([FromBody] CreateProjectDto dto)
    {
        var result = await _adminService.CreateProjectAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("projects")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<List<ProjectDto>>>> GetProjects([FromQuery] bool? activeOnly = true)
    {
        var result = await _adminService.GetProjectsAsync(activeOnly);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("projects/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<ProjectDto>>> UpdateProject(int id, [FromBody] UpdateProjectDto dto)
    {
        var result = await _adminService.UpdateProjectAsync(id, dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("projects/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<bool>>> DeleteProject(int id)
    {
        var result = await _adminService.DeleteProjectAsync(id);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // Contractors
    [HttpPost("contractors")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<ContractorDto>>> CreateContractor([FromBody] CreateContractorDto dto)
    {
        var result = await _adminService.CreateContractorAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("contractors")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]  // Allow Guards to view contractors
    public async Task<ActionResult<AuthApiResponse<List<ContractorDto>>>> GetContractors(
        [FromQuery] int? projectId,
        [FromQuery] bool? activeOnly = true)
    {
        var result = await _adminService.GetContractorsAsync(projectId, activeOnly);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("projects/{projectId}/contractors")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]  // Allow Guards to view contractors
    public async Task<ActionResult<AuthApiResponse<List<ContractorDto>>>> GetContractorsByProject(int projectId)
    {
        _logger.LogInformation("Getting contractors for project {ProjectId}", projectId);
        var result = await _adminService.GetContractorsAsync(projectId, activeOnly: true);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("contractors/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<ContractorDto>>> UpdateContractor(int id, [FromBody] UpdateContractorDto dto)
    {
        var result = await _adminService.UpdateContractorAsync(id, dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("contractors/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<bool>>> DeleteContractor(int id)
    {
        var result = await _adminService.DeleteContractorAsync(id);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // Guard Project Assignments
    [HttpPost("guards/assign")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<GuardDto>>> AssignGuardToProject([FromBody] AssignGuardToProjectDto dto)
    {
        var userEmail = User.Identity?.Name ?? "System";
        var result = await _adminService.AssignGuardToProjectAsync(dto, userEmail);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("guards/unassign")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<AuthApiResponse<bool>>> UnassignGuardFromProject([FromBody] UnassignGuardFromProjectDto dto)
    {
        var result = await _adminService.UnassignGuardFromProjectAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("guards")]
    public async Task<ActionResult<AuthApiResponse<List<GuardDto>>>> GetGuards(
        [FromQuery] int? projectId,
        [FromQuery] bool? activeOnly = true)
    {
        var result = await _adminService.GetGuardsAsync(projectId, activeOnly);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("guards/{authUserId}/assignments")]
    public async Task<ActionResult<AuthApiResponse<List<GuardProjectInfo>>>> GetGuardAssignments(int authUserId)
    {
        var result = await _adminService.GetGuardAssignmentsAsync(authUserId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("guards/my-assignments")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]  // Allow Guards to access their own assignments
    public async Task<ActionResult<AuthApiResponse<List<GuardProjectInfo>>>> GetMyAssignments()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var authUserId))
        {
            return Unauthorized(new AuthApiResponse<List<GuardProjectInfo>>
            {
                Success = false,
                Message = "User not authenticated"
            });
        }

        var result = await _adminService.GetGuardAssignmentsAsync(authUserId);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
