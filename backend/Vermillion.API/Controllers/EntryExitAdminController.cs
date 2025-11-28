using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Services;
using Vermillion.Auth.Domain.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vermillion.Shared.Domain.Models.DTOs;
using Vermillion.API.Extensions;

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
    public async Task<IActionResult> GetUsers()
    {
        try
        {
            var guardList = await BuildGuardListAsync();
            if (!guardList.Success)
            {
                return this.ServiceUnavailable<List<GuardListItemDto>>(guardList.Message ?? "Failed to fetch users", guardList.Errors);
            }

            return Ok(guardList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users");
            return this.ServerError("Error getting users");
        }
    }

    // Guards - simplified endpoints for guard management
    [HttpGet("guards/list")]
    public async Task<IActionResult> GetGuardsList()
    {
        try
        {
            var guardList = await BuildGuardListAsync();
            if (!guardList.Success)
            {
                return this.ServiceUnavailable<List<GuardListItemDto>>(guardList.Message ?? "Failed to fetch users", guardList.Errors);
            }

            return Ok(guardList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting guards list");
            return this.ServerError("Error getting guards list");
        }
    }

    [HttpPost("guards/create")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<IActionResult> CreateGuard([FromBody] CreateGuardDto createDto)
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
                return BadRequest(ApiResponse<string>.ErrorResponse("Failed to create guard", new List<string> { message }));
            }

            return Ok(ApiResponse<IdResponseDto>.SuccessResponse(new IdResponseDto { Id = userId ?? 0 }, "Guard created successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating guard");
            return this.ServerError("Error creating guard");
        }
    }

    [HttpPut("guards/{authUserId:int}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<IActionResult> UpdateGuard(int authUserId, [FromBody] UpdateGuardDto updateDto)
    {
        try
        {
            var ok = await _userService.UpdateUserAsync(
                userId: authUserId,
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
                return BadRequest(ApiResponse<string>.ErrorResponse("Failed to update guard"));

            return Ok(ApiResponse<EmptyResponseDto>.SuccessResponse(new EmptyResponseDto(), "Guard updated"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating guard");
            return this.ServerError("Error updating guard");
        }
    }

    // Projects
    [HttpPost("projects")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<ProjectDto>>> CreateProject([FromBody] CreateProjectDto dto)
    {
        var result = await _adminService.CreateProjectAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("projects")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<List<ProjectDto>>>> GetProjects([FromQuery] bool? activeOnly = true)
    {
        var result = await _adminService.GetProjectsAsync(activeOnly);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("projects/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<ProjectDto>>> UpdateProject(int id, [FromBody] UpdateProjectDto dto)
    {
        var result = await _adminService.UpdateProjectAsync(id, dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("projects/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteProject(int id)
    {
        var result = await _adminService.DeleteProjectAsync(id);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // Contractors
    [HttpPost("contractors")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<ContractorDto>>> CreateContractor([FromBody] CreateContractorDto dto)
    {
        var result = await _adminService.CreateContractorAsync(dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("contractors")]
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]  // Allow Guards to view contractors
    public async Task<ActionResult<ApiResponse<List<ContractorDto>>>> GetContractors(
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
    public async Task<ActionResult<ApiResponse<List<ContractorDto>>>> GetContractorsByProject(int projectId)
    {
        _logger.LogInformation("Getting contractors for project {ProjectId}", projectId);
        var result = await _adminService.GetContractorsAsync(projectId, activeOnly: true);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("contractors/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<ContractorDto>>> UpdateContractor(int id, [FromBody] UpdateContractorDto dto)
    {
        var result = await _adminService.UpdateContractorAsync(id, dto);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("contractors/{id}")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteContractor(int id)
    {
        var result = await _adminService.DeleteContractorAsync(id);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    // Guard Project Assignments
    [HttpPost("guards/assign")]
    [Authorize(Roles = "SystemAdmin,Admin")]
    public async Task<ActionResult<ApiResponse<GuardDto>>> AssignGuardToProject([FromBody] AssignGuardToProjectDto dto)
    {
        var userEmail = User.Identity?.Name ?? "System";
        var result = await _adminService.AssignGuardToProjectAsync(dto, userEmail);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("guards/unassign")]
    [Authorize(Roles = "SystemAdmin,Admin")]
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
    [Authorize(Roles = "Guard,SystemAdmin,Admin")]  // Allow Guards to access their own assignments
    public async Task<ActionResult<ApiResponse<List<GuardProjectInfo>>>> GetMyAssignments()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var authUserId))
        {
            return Unauthorized(ApiResponse<List<GuardProjectInfo>>.ErrorResponse("User not authenticated"));
        }

        var result = await _adminService.GetGuardAssignmentsAsync(authUserId);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    private async Task<ApiResponse<List<GuardListItemDto>>> BuildGuardListAsync()
    {
        var employees = await _userService.GetAllEmployeesAsync(excludeGuards: false);
        if (employees == null)
        {
            return ApiResponse<List<GuardListItemDto>>.ErrorResponse("Failed to fetch users");
        }

        var employeeList = employees.ToList();
        if (employeeList.Count == 0)
        {
            return ApiResponse<List<GuardListItemDto>>.SuccessResponse(new List<GuardListItemDto>());
        }

        var roleTasks = employeeList
            .Select(emp => _userService.GetUserRoleAsync(emp.UserId, "entryexit"))
            .ToList();

        var roles = await Task.WhenAll(roleTasks);

        var guardsWithRoles = new List<GuardListItemDto>();
        for (var index = 0; index < employeeList.Count; index++)
        {
            var roleName = roles[index];
            if (!string.Equals(roleName, "Guard", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var employee = employeeList[index];
            guardsWithRoles.Add(new GuardListItemDto
            {
                Id = employee.UserId.ToString(),
                EmployeeId = employee.EmployeeId,
                FirstName = employee.FirstName ?? string.Empty,
                LastName = employee.LastName ?? string.Empty,
                Email = employee.User?.Email ?? string.Empty,
                PhoneNumber = employee.PhoneNumber,
                IsActive = employee.User?.IsActive ?? false,
                Role = roleName ?? string.Empty
            });
        }

        return ApiResponse<List<GuardListItemDto>>.SuccessResponse(guardsWithRoles);
    }
}
