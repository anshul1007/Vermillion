using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EntryExitAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SystemAdmin,Admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly ILogger<AdminController> _logger;
    private readonly IAuthApiClient _authClient;

    public AdminController(IAdminService adminService, ILogger<AdminController> logger, IAuthApiClient authClient)
    {
        _adminService = adminService;
        _logger = logger;
        _authClient = authClient;
    }

    // Get users for EntryExit tenant (Guards)
    [HttpGet("users")]
    public async Task<ActionResult> GetUsers()
    {
        try
        {
            var employees = await _authClient.GetAllEmployeesAsync();
            if (employees == null)
                return StatusCode(502, new { success = false, message = "Failed to fetch users from AuthAPI" });

            // Filter users with Guard role in EntryExit tenant
            var guardsWithRoles = new List<GuardListItemDto>();

            foreach (var emp in employees)
            {
                // Get role for EntryExit tenant
                var roleName = await _authClient.GetUserRoleAsync(emp.UserId, "entryexit");

                // Only include users with Guard role in EntryExit tenant
                if (roleName == "Guard")
                {
                    guardsWithRoles.Add(new GuardListItemDto
                    {
                        Id = emp.UserId.ToString(),
                        EmployeeId = emp.EmployeeId,
                        FirstName = emp.FirstName,
                        LastName = emp.LastName,
                        Email = emp.Email,
                        PhoneNumber = emp.PhoneNumber,
                        IsActive = emp.IsActive,
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
            var employees = await _authClient.GetAllEmployeesAsync();
            if (employees == null)
                return StatusCode(502, new { success = false, message = "Failed to fetch users from AuthAPI" });

            // Filter users with Guard role in EntryExit tenant
            var guardsWithRoles = new List<GuardListItemDto>();

            foreach (var emp in employees)
            {
                // Get role for EntryExit tenant
                var roleName = await _authClient.GetUserRoleAsync(emp.UserId, "entryexit");

                // Only include users with Guard role in EntryExit tenant
                if (roleName == "Guard")
                {
                    guardsWithRoles.Add(new GuardListItemDto
                    {
                        Id = emp.UserId.ToString(),
                        EmployeeId = emp.EmployeeId,
                        FirstName = emp.FirstName,
                        LastName = emp.LastName,
                        Email = emp.Email,
                        PhoneNumber = emp.PhoneNumber,
                        IsActive = emp.IsActive,
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
    public async Task<ActionResult> CreateGuard([FromBody] CreateGuardDto createDto)
    {
        try
        {
            var (success, message) = await _authClient.CreateGuardUserAsync(createDto);

            if (!success)
            {
                return BadRequest(new { success = false, message = "Failed to create guard", error = message });
            }

            return Ok(new { success = true, message = "Guard created successfully", data = message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating guard");
            return StatusCode(500, new { success = false, message = "Error creating guard", errors = new[] { ex.Message } });
        }
    }

    [HttpPut("guards/{authUserId}")]
    public async Task<ActionResult> UpdateGuard(string authUserId, [FromBody] UpdateGuardDto updateDto)
    {
        try
        {
            var ok = await _authClient.UpdateUserAsync(authUserId, updateDto);
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
    public async Task<ActionResult<ApiResponse<ProjectDto>>> CreateProject([FromBody] CreateProjectDto dto)
    {
        var result = await _adminService.CreateProjectAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("projects")]
    [Authorize] // Previously allowed anonymous for guards; now require auth
    public async Task<ActionResult<ApiResponse<List<ProjectDto>>>> GetProjects([FromQuery] bool? activeOnly = true)
    {
        var result = await _adminService.GetProjectsAsync(activeOnly);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("projects/{id}")]
    public async Task<ActionResult<ApiResponse<ProjectDto>>> UpdateProject(int id, [FromBody] UpdateProjectDto dto)
    {
        var result = await _adminService.UpdateProjectAsync(id, dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("projects/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteProject(int id)
    {
        var result = await _adminService.DeleteProjectAsync(id);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // Contractors
    [HttpPost("contractors")]
    public async Task<ActionResult<ApiResponse<ContractorDto>>> CreateContractor([FromBody] CreateContractorDto dto)
    {
        var result = await _adminService.CreateContractorAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("contractors")]
    [Authorize] // Previously allowed anonymous for guards; now require auth
    public async Task<ActionResult<ApiResponse<List<ContractorDto>>>> GetContractors(
        [FromQuery] int? projectId,
        [FromQuery] bool? activeOnly = true)
    {
        var result = await _adminService.GetContractorsAsync(projectId, activeOnly);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("contractors/{id}")]
    public async Task<ActionResult<ApiResponse<ContractorDto>>> UpdateContractor(int id, [FromBody] UpdateContractorDto dto)
    {
        var result = await _adminService.UpdateContractorAsync(id, dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("contractors/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteContractor(int id)
    {
        var result = await _adminService.DeleteContractorAsync(id);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // Guard Project Assignments
    [HttpPost("guards/assign")]
    public async Task<ActionResult<ApiResponse<GuardDto>>> AssignGuardToProject([FromBody] AssignGuardToProjectDto dto)
    {
        var userEmail = User.Identity?.Name ?? "System";
        var result = await _adminService.AssignGuardToProjectAsync(dto, userEmail);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("guards/unassign")]
    public async Task<ActionResult<ApiResponse<bool>>> UnassignGuardFromProject([FromBody] UnassignGuardFromProjectDto dto)
    {
        var result = await _adminService.UnassignGuardFromProjectAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("guards")]
    public async Task<ActionResult<ApiResponse<List<GuardDto>>>> GetGuards(
        [FromQuery] int? projectId,
        [FromQuery] bool? activeOnly = true)
    {
        var result = await _adminService.GetGuardsAsync(projectId, activeOnly);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("guards/{authUserId}/assignments")]
    public async Task<ActionResult<ApiResponse<List<GuardProjectInfo>>>> GetGuardAssignments(int authUserId)
    {
        var result = await _adminService.GetGuardAssignmentsAsync(authUserId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("guards/my-assignments")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<List<GuardProjectInfo>>>> GetMyAssignments()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var authUserId))
        {
            return Unauthorized(new ApiResponse<List<GuardProjectInfo>>
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
