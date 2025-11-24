using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Vermillion.EntryExit.Domain.Services;

public interface IAdminService
{
    Task<AuthApiResponse<ProjectDto>> CreateProjectAsync(CreateProjectDto dto);
    Task<AuthApiResponse<List<ProjectDto>>> GetProjectsAsync(bool? activeOnly);
    Task<AuthApiResponse<ProjectDto>> UpdateProjectAsync(int id, UpdateProjectDto dto);
    Task<AuthApiResponse<bool>> DeleteProjectAsync(int id);
    Task<AuthApiResponse<ContractorDto>> CreateContractorAsync(CreateContractorDto dto);
    Task<AuthApiResponse<List<ContractorDto>>> GetContractorsAsync(int? projectId, bool? activeOnly);
    Task<AuthApiResponse<ContractorDto>> UpdateContractorAsync(int id, UpdateContractorDto dto);
    Task<AuthApiResponse<bool>> DeleteContractorAsync(int id);
    Task<AuthApiResponse<GuardDto>> AssignGuardToProjectAsync(AssignGuardToProjectDto dto, string assignedBy);
    Task<AuthApiResponse<bool>> UnassignGuardFromProjectAsync(UnassignGuardFromProjectDto dto);
    Task<AuthApiResponse<List<GuardDto>>> GetGuardsAsync(int? projectId, bool? activeOnly);
    Task<AuthApiResponse<List<GuardProjectInfo>>> GetGuardAssignmentsAsync(int authUserId);
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

    public async Task<AuthApiResponse<ProjectDto>> CreateProjectAsync(CreateProjectDto dto)
    {
        try
        {
            // Check if project name already exists
            var existing = await _context.Projects
                .FirstOrDefaultAsync(p => p.Name.ToLower() == dto.Name.ToLower());

            if (existing != null)
            {
                return new AuthApiResponse<ProjectDto>
                {
                    Success = false,
                    Message = "Project with this name already exists"
                };
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

            return new AuthApiResponse<ProjectDto>
            {
                Success = true,
                Message = "Project created successfully",
                Data = new ProjectDto
                {
                    Id = project.Id,
                    Name = project.Name,
                    Description = project.Description,
                    IsActive = project.IsActive
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating project");
            return new AuthApiResponse<ProjectDto>
            {
                Success = false,
                Message = "Error creating project",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<List<ProjectDto>>> GetProjectsAsync(bool? activeOnly)
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

            return new AuthApiResponse<List<ProjectDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} project(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting projects");
            return new AuthApiResponse<List<ProjectDto>>
            {
                Success = false,
                Message = "Error getting projects",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<ProjectDto>> UpdateProjectAsync(int id, UpdateProjectDto dto)
    {
        try
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null)
            {
                return new AuthApiResponse<ProjectDto>
                {
                    Success = false,
                    Message = "Project not found"
                };
            }

            // Update only provided fields
            if (dto.Name != null)
            {
                // Check if new name already exists (excluding current project)
                var existing = await _context.Projects
                    .FirstOrDefaultAsync(p => p.Name.ToLower() == dto.Name.ToLower() && p.Id != id);
                
                if (existing != null)
                {
                    return new AuthApiResponse<ProjectDto>
                    {
                        Success = false,
                        Message = "Project with this name already exists"
                    };
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

            return new AuthApiResponse<ProjectDto>
            {
                Success = true,
                Message = "Project updated successfully",
                Data = resultDto
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating project");
            return new AuthApiResponse<ProjectDto>
            {
                Success = false,
                Message = "Error updating project",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<bool>> DeleteProjectAsync(int id)
    {
        try
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null)
            {
                return new AuthApiResponse<bool>
                {
                    Success = false,
                    Message = "Project not found"
                };
            }

            // Check if project has contractors
            var hasContractors = await _context.Contractors
                .AnyAsync(c => c.ProjectId == id);

            if (hasContractors)
            {
                return new AuthApiResponse<bool>
                {
                    Success = false,
                    Message = "Cannot delete project with associated contractors. Please delete or reassign contractors first."
                };
            }

            // Check if project has guard assignments
            var hasGuardAssignments = await _context.GuardProjectAssignments
                .AnyAsync(g => g.ProjectId == id);

            if (hasGuardAssignments)
            {
                return new AuthApiResponse<bool>
                {
                    Success = false,
                    Message = "Cannot delete project with guard assignments. Please unassign guards first."
                };
            }

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            return new AuthApiResponse<bool>
            {
                Success = true,
                Message = "Project deleted successfully",
                Data = true
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting project");
            return new AuthApiResponse<bool>
            {
                Success = false,
                Message = "Error deleting project",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<ContractorDto>> CreateContractorAsync(CreateContractorDto dto)
    {
        try
        {
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null || !project.IsActive)
            {
                return new AuthApiResponse<ContractorDto>
                {
                    Success = false,
                    Message = "Invalid or inactive project"
                };
            }

            var contractor = new Contractor
            {
                Name = dto.Name,
                ContactPerson = dto.ContactPerson,
                PhoneNumber = dto.PhoneNumber,
                ProjectId = dto.ProjectId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Contractors.Add(contractor);
            await _context.SaveChangesAsync();

            return new AuthApiResponse<ContractorDto>
            {
                Success = true,
                Message = "Contractor created successfully",
                Data = new ContractorDto
                {
                    Id = contractor.Id,
                    Name = contractor.Name,
                    ContactPerson = contractor.ContactPerson,
                    PhoneNumber = contractor.PhoneNumber,
                    ProjectId = contractor.ProjectId,
                    IsActive = contractor.IsActive
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating contractor");
            return new AuthApiResponse<ContractorDto>
            {
                Success = false,
                Message = "Error creating contractor",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<List<ContractorDto>>> GetContractorsAsync(int? projectId, bool? activeOnly)
    {
        try
        {
            var query = _context.Contractors.AsQueryable();

            if (projectId.HasValue)
            {
                query = query.Where(c => c.ProjectId == projectId.Value);
            }

            if (activeOnly == true)
            {
                query = query.Where(c => c.IsActive);
            }

            var contractors = await query.OrderBy(c => c.Name).ToListAsync();

            var dtos = contractors.Select(c => new ContractorDto
            {
                Id = c.Id,
                Name = c.Name,
                ContactPerson = c.ContactPerson,
                PhoneNumber = c.PhoneNumber,
                ProjectId = c.ProjectId,
                IsActive = c.IsActive
            }).ToList();

            return new AuthApiResponse<List<ContractorDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} contractor(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting contractors");
            return new AuthApiResponse<List<ContractorDto>>
            {
                Success = false,
                Message = "Error getting contractors",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<ContractorDto>> UpdateContractorAsync(int id, UpdateContractorDto dto)
    {
        try
        {
            var contractor = await _context.Contractors.FindAsync(id);
            if (contractor == null)
            {
                return new AuthApiResponse<ContractorDto>
                {
                    Success = false,
                    Message = "Contractor not found"
                };
            }

            // Update only provided fields
            if (dto.Name != null)
                contractor.Name = dto.Name;

            if (dto.ContactPerson != null)
                contractor.ContactPerson = dto.ContactPerson;

            if (dto.PhoneNumber != null)
                contractor.PhoneNumber = dto.PhoneNumber;

            if (dto.ProjectId.HasValue)
            {
                // Verify new project exists and is active
                var project = await _context.Projects.FindAsync(dto.ProjectId.Value);
                if (project == null || !project.IsActive)
                {
                    return new AuthApiResponse<ContractorDto>
                    {
                        Success = false,
                        Message = "Invalid or inactive project"
                    };
                }
                contractor.ProjectId = dto.ProjectId.Value;
            }

            if (dto.IsActive.HasValue)
                contractor.IsActive = dto.IsActive.Value;

            contractor.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var resultDto = new ContractorDto
            {
                Id = contractor.Id,
                Name = contractor.Name,
                ContactPerson = contractor.ContactPerson,
                PhoneNumber = contractor.PhoneNumber,
                ProjectId = contractor.ProjectId,
                IsActive = contractor.IsActive
            };

            return new AuthApiResponse<ContractorDto>
            {
                Success = true,
                Message = "Contractor updated successfully",
                Data = resultDto
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating contractor");
            return new AuthApiResponse<ContractorDto>
            {
                Success = false,
                Message = "Error updating contractor",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<bool>> DeleteContractorAsync(int id)
    {
        try
        {
            var contractor = await _context.Contractors.FindAsync(id);
            if (contractor == null)
            {
                return new AuthApiResponse<bool>
                {
                    Success = false,
                    Message = "Contractor not found"
                };
            }

            _context.Contractors.Remove(contractor);
            await _context.SaveChangesAsync();

            return new AuthApiResponse<bool>
            {
                Success = true,
                Message = "Contractor deleted successfully",
                Data = true
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting contractor");
            return new AuthApiResponse<bool>
            {
                Success = false,
                Message = "Error deleting contractor",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<GuardDto>> AssignGuardToProjectAsync(AssignGuardToProjectDto dto, string assignedBy)
    {
        try
        {
            // Check if project exists and is active
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null || !project.IsActive)
            {
                return new AuthApiResponse<GuardDto>
                {
                    Success = false,
                    Message = "Invalid or inactive project"
                };
            }

            // Check if assignment already exists
            var existingAssignment = await _context.GuardProjectAssignments
                .FirstOrDefaultAsync(a => a.AuthUserId == dto.AuthUserId && a.ProjectId == dto.ProjectId);

            if (existingAssignment != null)
            {
                if (existingAssignment.IsActive)
                {
                    return new AuthApiResponse<GuardDto>
                    {
                        Success = false,
                        Message = "Guard is already assigned to this project"
                    };
                }

                // Reactivate existing assignment
                existingAssignment.IsActive = true;
                existingAssignment.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return new AuthApiResponse<GuardDto>
                {
                    Success = true,
                    Message = "Guard reassigned to project successfully"
                };
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

            return new AuthApiResponse<GuardDto>
            {
                Success = true,
                Message = "Guard assigned to project successfully"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning guard to project");
            return new AuthApiResponse<GuardDto>
            {
                Success = false,
                Message = "Error assigning guard to project",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<bool>> UnassignGuardFromProjectAsync(UnassignGuardFromProjectDto dto)
    {
        try
        {
            var assignment = await _context.GuardProjectAssignments
                .FirstOrDefaultAsync(a => a.AuthUserId == dto.AuthUserId && a.ProjectId == dto.ProjectId && a.IsActive);

            if (assignment == null)
            {
                return new AuthApiResponse<bool>
                {
                    Success = false,
                    Message = "Guard assignment not found or already inactive"
                };
            }

            assignment.IsActive = false;
            assignment.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new AuthApiResponse<bool>
            {
                Success = true,
                Message = "Guard unassigned from project successfully",
                Data = true
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unassigning guard from project");
            return new AuthApiResponse<bool>
            {
                Success = false,
                Message = "Error unassigning guard from project",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<List<GuardDto>>> GetGuardsAsync(int? projectId, bool? activeOnly)
    {
        try
        {
            // This method will need to call AuthAPI to get guards
            // For now, returning empty list - needs AuthAPI client integration
            return new AuthApiResponse<List<GuardDto>>
            {
                Success = true,
                Message = "Guards retrieval requires AuthAPI integration",
                Data = new List<GuardDto>()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting guards");
            return new AuthApiResponse<List<GuardDto>>
            {
                Success = false,
                Message = "Error getting guards",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<List<GuardProjectInfo>>> GetGuardAssignmentsAsync(int authUserId)
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

            return new AuthApiResponse<List<GuardProjectInfo>>
            {
                Success = true,
                Message = $"Found {projectInfos.Count} project assignment(s)",
                Data = projectInfos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting guard assignments");
            return new AuthApiResponse<List<GuardProjectInfo>>
            {
                Success = false,
                Message = "Error getting guard assignments",
                Errors = new List<string> { ex.Message }
            };
        }
    }
}
