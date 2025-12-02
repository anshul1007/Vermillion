using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Vermillion.Shared.Domain.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Vermillion.EntryExit.Domain.Services;

public interface IAdminService
{
    Task<ApiResponse<ProjectDto>> CreateProjectAsync(CreateProjectDto dto);
    Task<ApiResponse<List<ProjectDto>>> GetProjectsAsync(bool? activeOnly);
    Task<ApiResponse<ProjectDto>> UpdateProjectAsync(int id, UpdateProjectDto dto);
    Task<ApiResponse<bool>> DeleteProjectAsync(int id);
    Task<ApiResponse<ContractorDto>> CreateContractorAsync(CreateContractorDto dto);
    Task<ApiResponse<List<ContractorDto>>> GetContractorsAsync(int? projectId, bool? activeOnly);
    Task<ApiResponse<ContractorDto>> UpdateContractorAsync(int id, UpdateContractorDto dto);
    Task<ApiResponse<bool>> DeleteContractorAsync(int id);
    Task<ApiResponse<GuardDto>> AssignGuardToProjectAsync(AssignGuardToProjectDto dto, string assignedBy);
    Task<ApiResponse<bool>> UnassignGuardFromProjectAsync(UnassignGuardFromProjectDto dto);
    Task<ApiResponse<List<GuardDto>>> GetGuardsAsync(int? projectId, bool? activeOnly);
    Task<ApiResponse<List<GuardProjectInfo>>> GetGuardAssignmentsAsync(int authUserId);
}

public class AdminService : IAdminService
{
    private readonly EntryExitDbContext _context;
    private readonly ILogger<AdminService> _logger;

    public AdminService(EntryExitDbContext context, ILogger<AdminService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ApiResponse<ProjectDto>> CreateProjectAsync(CreateProjectDto dto)
    {
        try
        {
            // Check if project name already exists
            var existing = await _context.Projects
                .FirstOrDefaultAsync(p => p.Name.ToLower() == dto.Name.ToLower());

            if (existing != null)
            {
                return ApiResponse<ProjectDto>.ErrorResponse("Project with this name already exists");
            }

            var project = new Project
            {
                Name = dto.Name,
                Description = dto.Description,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            return ApiResponse<ProjectDto>.SuccessResponse(new ProjectDto
            {
                Id = project.Id,
                Name = project.Name,
                Description = project.Description,
                IsActive = project.IsActive
            }, "Project created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating project");
            return ApiResponse<ProjectDto>.ErrorResponse("Error creating project", ex.Message);
        }
    }

    public async Task<ApiResponse<List<ProjectDto>>> GetProjectsAsync(bool? activeOnly)
    {
        try
        {
            var query = _context.Projects.AsQueryable();

            if (activeOnly == true)
            {
                query = query.Where(p => p.IsActive);
            }

            var projects = await query.OrderBy(p => p.Name).ToListAsync();

            var dtos = projects.Select(p => new ProjectDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                IsActive = p.IsActive
            }).ToList();

            return new ApiResponse<List<ProjectDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} project(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting projects");
            return new ApiResponse<List<ProjectDto>>
            {
                Success = false,
                Message = "Error getting projects",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<ProjectDto>> UpdateProjectAsync(int id, UpdateProjectDto dto)
    {
        try
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null)
            {
                return ApiResponse<ProjectDto>.ErrorResponse("Project not found");
            }

            // Update only provided fields
            if (dto.Name != null)
            {
                // Check if new name already exists (excluding current project)
                var existing = await _context.Projects
                    .FirstOrDefaultAsync(p => p.Name.ToLower() == dto.Name.ToLower() && p.Id != id);

                if (existing != null)
                {
                    return ApiResponse<ProjectDto>.ErrorResponse("Project with this name already exists");
                }
                project.Name = dto.Name;
            }

            if (dto.Description != null)
                project.Description = dto.Description;

            if (dto.IsActive.HasValue)
                project.IsActive = dto.IsActive.Value;

            project.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var resultDto = new ProjectDto
            {
                Id = project.Id,
                Name = project.Name,
                Description = project.Description,
                IsActive = project.IsActive
            };

            return ApiResponse<ProjectDto>.SuccessResponse(resultDto
            , "Project updated successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating project");
            return ApiResponse<ProjectDto>.ErrorResponse("Error updating project", ex.Message);
        }
    }

    public async Task<ApiResponse<bool>> DeleteProjectAsync(int id)
    {
        try
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null)
            {
                return ApiResponse<bool>.ErrorResponse("Project not found");
            }

            // Check if project has contractors
            var hasContractors = await _context.Contractors
                .AnyAsync(c => c.Projects.Any(p => p.Id == id));

            if (hasContractors)
            {
                return ApiResponse<bool>.ErrorResponse("Cannot delete project with associated contractors. Please delete or reassign contractors first.");
            }

            // Check if project has guard assignments
            var hasGuardAssignments = await _context.GuardProjectAssignments
                .AnyAsync(g => g.ProjectId == id);

            if (hasGuardAssignments)
            {
                return ApiResponse<bool>.ErrorResponse("Cannot delete project with guard assignments. Please unassign guards first.");
            }

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            return ApiResponse<bool>.SuccessResponse(true
            , "Project deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting project");
            return ApiResponse<bool>.ErrorResponse("Error deleting project", ex.Message);
        }
    }

    public async Task<ApiResponse<ContractorDto>> CreateContractorAsync(CreateContractorDto dto)
    {
        try
        {
            if (dto.ProjectIds == null || dto.ProjectIds.Count == 0)
            {
                return ApiResponse<ContractorDto>.ErrorResponse("At least one project association is required");
            }

            var distinctProjectIds = dto.ProjectIds.Distinct().ToList();
            var projects = await _context.Projects
                .Where(p => distinctProjectIds.Contains(p.Id) && p.IsActive)
                .ToListAsync();

            if (projects.Count != distinctProjectIds.Count)
            {
                return ApiResponse<ContractorDto>.ErrorResponse("One or more projects are invalid or inactive");
            }

            var contractor = new Contractor
            {
                Name = dto.Name,
                ContactPerson = dto.ContactPerson,
                PhoneNumber = dto.PhoneNumber,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            foreach (var project in projects)
            {
                contractor.Projects.Add(project);
            }

            _context.Contractors.Add(contractor);
            await _context.SaveChangesAsync();

            return ApiResponse<ContractorDto>.SuccessResponse(MapContractor(contractor), "Contractor created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating contractor");
            return ApiResponse<ContractorDto>.ErrorResponse("Error creating contractor", ex.Message);
        }
    }

    public async Task<ApiResponse<List<ContractorDto>>> GetContractorsAsync(int? projectId, bool? activeOnly)
    {
        try
        {
            var query = _context.Contractors
                .Include(c => c.Projects)
                .AsQueryable();

            if (projectId.HasValue)
            {
                query = query.Where(c => c.Projects.Any(p => p.Id == projectId.Value));
            }

            if (activeOnly == true)
            {
                query = query.Where(c => c.IsActive);
            }

            var contractors = await query.OrderBy(c => c.Name).ToListAsync();

            var dtos = contractors.Select(MapContractor).ToList();

            return new ApiResponse<List<ContractorDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} contractor(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contractors");
            return new ApiResponse<List<ContractorDto>>
            {
                Success = false,
                Message = "Error getting contractors",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<ContractorDto>> UpdateContractorAsync(int id, UpdateContractorDto dto)
    {
        try
        {
            var contractor = await _context.Contractors
                .Include(c => c.Projects)
                .FirstOrDefaultAsync(c => c.Id == id);
            if (contractor == null)
            {
                return ApiResponse<ContractorDto>.ErrorResponse("Contractor not found");
            }

            // Update only provided fields
            if (dto.Name != null)
                contractor.Name = dto.Name;

            if (dto.ContactPerson != null)
                contractor.ContactPerson = dto.ContactPerson;

            if (dto.PhoneNumber != null)
                contractor.PhoneNumber = dto.PhoneNumber;

            if (dto.ProjectIds != null)
            {
                if (dto.ProjectIds.Count == 0)
                {
                    return ApiResponse<ContractorDto>.ErrorResponse("At least one project association is required");
                }

                var distinctProjectIds = dto.ProjectIds.Distinct().ToList();
                var projects = await _context.Projects
                    .Where(p => distinctProjectIds.Contains(p.Id) && p.IsActive)
                    .ToListAsync();

                if (projects.Count != distinctProjectIds.Count)
                {
                    return ApiResponse<ContractorDto>.ErrorResponse("One or more projects are invalid or inactive");
                }

                contractor.Projects.Clear();
                foreach (var project in projects)
                {
                    contractor.Projects.Add(project);
                }
            }

            if (dto.IsActive.HasValue)
                contractor.IsActive = dto.IsActive.Value;

            contractor.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return ApiResponse<ContractorDto>.SuccessResponse(MapContractor(contractor)
            , "Contractor updated successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating contractor");
            return ApiResponse<ContractorDto>.ErrorResponse("Error updating contractor", ex.Message);
        }
    }

    public async Task<ApiResponse<bool>> DeleteContractorAsync(int id)
    {
        try
        {
            var contractor = await _context.Contractors.FindAsync(id);
            if (contractor == null)
            {
                return ApiResponse<bool>.ErrorResponse("Contractor not found");
            }

            _context.Contractors.Remove(contractor);
            await _context.SaveChangesAsync();

            return ApiResponse<bool>.SuccessResponse(true
            , "Contractor deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting contractor");
            return ApiResponse<bool>.ErrorResponse("Error deleting contractor", ex.Message);
        }
    }

    public async Task<ApiResponse<GuardDto>> AssignGuardToProjectAsync(AssignGuardToProjectDto dto, string assignedBy)
    {
        try
        {
            // Check if project exists and is active
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null || !project.IsActive)
            {
                return ApiResponse<GuardDto>.ErrorResponse("Invalid or inactive project");
            }

            // Check if assignment already exists
            var existingAssignment = await _context.GuardProjectAssignments
                .FirstOrDefaultAsync(a => a.AuthUserId == dto.AuthUserId && a.ProjectId == dto.ProjectId);

            if (existingAssignment != null)
            {
                if (existingAssignment.IsActive)
                {
                    return ApiResponse<GuardDto>.ErrorResponse("Guard is already assigned to this project");
                }

                // Reactivate existing assignment
                existingAssignment.IsActive = true;
                existingAssignment.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return ApiResponse<GuardDto>.SuccessResponse(new GuardDto(), "Guard reassigned to project successfully");
            }

            // Create new assignment
            var assignment = new GuardProjectAssignment
            {
                AuthUserId = dto.AuthUserId,
                ProjectId = dto.ProjectId,
                IsActive = true,
                AssignedAt = DateTime.UtcNow,
                AssignedBy = assignedBy
            };

            _context.GuardProjectAssignments.Add(assignment);
            await _context.SaveChangesAsync();

            return ApiResponse<GuardDto>.SuccessResponse(new GuardDto(), "Guard assigned to project successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning guard to project");
            return ApiResponse<GuardDto>.ErrorResponse("Error assigning guard to project", ex.Message);
        }
    }

    public async Task<ApiResponse<bool>> UnassignGuardFromProjectAsync(UnassignGuardFromProjectDto dto)
    {
        try
        {
            var assignment = await _context.GuardProjectAssignments
                .FirstOrDefaultAsync(a => a.AuthUserId == dto.AuthUserId && a.ProjectId == dto.ProjectId && a.IsActive);

            if (assignment == null)
            {
                return ApiResponse<bool>.ErrorResponse("Guard assignment not found or already inactive");
            }

            assignment.IsActive = false;
            assignment.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return ApiResponse<bool>.SuccessResponse(true
            , "Guard unassigned from project successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unassigning guard from project");
            return ApiResponse<bool>.ErrorResponse("Error unassigning guard from project", ex.Message);
        }
    }

    public Task<ApiResponse<List<GuardDto>>> GetGuardsAsync(int? projectId, bool? activeOnly)
    {
        // This method will need to call AuthAPI to get guards.
        // For now return a completed Task with an empty result (placeholder for future integration).
        var response = new ApiResponse<List<GuardDto>>
        {
            Success = true,
            Message = "Guards retrieval requires AuthAPI integration",
            Data = new List<GuardDto>()
        };

        return Task.FromResult(response);
    }

    public async Task<ApiResponse<List<GuardProjectInfo>>> GetGuardAssignmentsAsync(int authUserId)
    {
        try
        {
            var assignments = await _context.GuardProjectAssignments
                .Include(a => a.Project)
                .Where(a => a.AuthUserId == authUserId && a.IsActive)
                .OrderBy(a => a.AssignedAt)
                .ToListAsync();

            var projectInfos = assignments.Select(a => new GuardProjectInfo
            {
                ProjectId = a.ProjectId,
                ProjectName = a.Project?.Name ?? "Unknown",
                IsActive = a.IsActive,
                AssignedAt = a.AssignedAt
            }).ToList();

            return new ApiResponse<List<GuardProjectInfo>>
            {
                Success = true,
                Message = $"Found {projectInfos.Count} project assignment(s)",
                Data = projectInfos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting guard assignments");
            return new ApiResponse<List<GuardProjectInfo>>
            {
                Success = false,
                Message = "Error getting guard assignments",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    private ContractorDto MapContractor(Contractor contractor)
    {
        var summaries = contractor.Projects?
            .OrderBy(p => p.Name)
            .Select(p => new ProjectSummaryDto
            {
                Id = p.Id,
                Name = p.Name
            })
            .ToList() ?? new List<ProjectSummaryDto>();

        return new ContractorDto
        {
            Id = contractor.Id,
            Name = contractor.Name,
            ContactPerson = contractor.ContactPerson,
            PhoneNumber = contractor.PhoneNumber,
            ProjectIds = summaries.Select(s => s.Id).ToList(),
            Projects = summaries,
            IsActive = contractor.IsActive
        };
    }
}
