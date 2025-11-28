using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.EntryExit.Domain.Services;

public interface IVisitorService
{
    Task<ApiResponse<VisitorDto>> RegisterVisitorAsync(CreateVisitorDto dto, string registeredBy);
    Task<ApiResponse<List<VisitorDto>>> SearchVisitorAsync(string? name, string? phone);
    Task<ApiResponse<List<VisitorDto>>> GetVisitorsByProjectAsync(int projectId);
    Task<ApiResponse<VisitorDto>> GetVisitorAsync(int id);
}

public class VisitorService : IVisitorService
{
    private readonly EntryExitDbContext _context;
    private readonly IPhotoStorageService _photoStorage;
    private readonly ILogger<VisitorService> _logger;

    public VisitorService(
        EntryExitDbContext context,
        IPhotoStorageService photoStorage,
        ILogger<VisitorService> logger)
    {
        _context = context;
        _photoStorage = photoStorage;
        _logger = logger;
    }

    public async Task<ApiResponse<VisitorDto>> RegisterVisitorAsync(CreateVisitorDto dto, string registeredBy)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.PhotoBase64))
                return new ApiResponse<VisitorDto>
                {
                    Success = false,
                    Message = "Photo is required for visitor registration"
                };

            // Validate project exists
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null)
            {
                return new ApiResponse<VisitorDto>
                {
                    Success = false,
                    Message = "Project not found"
                };
            }

            // Validate and process photo
            string photoUrl = await _photoStorage.SavePhotoAsync(dto.PhotoBase64, "visitor");

            var visitor = new Visitor
            {
                Name = dto.Name,
                PhoneNumber = dto.PhoneNumber,
                CompanyName = dto.CompanyName,
                Purpose = dto.Purpose,
                PhotoUrl = photoUrl,
                RegisteredBy = registeredBy,
                RegisteredAt = DateTime.UtcNow,
                ProjectId = dto.ProjectId
            };

            _context.Visitors.Add(visitor);
            await _context.SaveChangesAsync();

            return new ApiResponse<VisitorDto>
            {
                Success = true,
                Message = "Visitor registered successfully",
                Data = MapToDto(visitor)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering visitor");
            return new ApiResponse<VisitorDto>
            {
                Success = false,
                Message = "An error occurred while registering visitor",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<List<VisitorDto>>> SearchVisitorAsync(string? name, string? phone)
    {
        try
        {
            _logger.LogInformation("SearchVisitorAsync called with name='{Name}' phone='{Phone}'", name, phone);
            var query = _context.Visitors.AsQueryable();

            if (!string.IsNullOrWhiteSpace(name))
            {
                var nameLower = name.ToLower();
                query = query.Where(v => v.Name != null && v.Name.ToLower().Contains(nameLower));
            }

            List<Visitor> results;

            if (!string.IsNullOrWhiteSpace(phone))
            {
                // Coarse DB filter: phone substring or name match
                var phoneLower = phone.ToLower();

                var coarse = await query
                    .Where(v => (v.PhoneNumber != null && v.PhoneNumber.Contains(phone)) || (v.Name != null && v.Name.ToLower().Contains(phoneLower)))
                    .OrderByDescending(v => v.RegisteredAt)
                    .Take(200)
                    .ToListAsync();

                // Refine in-memory using digit-only comparison
                var digitsQuery = new string(phone.Where(char.IsDigit).ToArray());
                _logger.LogInformation("Visitor coarse candidates={Count} for query='{Query}' digitsQuery='{Digits}'", coarse.Count, phone, digitsQuery);

                if (!string.IsNullOrEmpty(digitsQuery))
                {
                    results = coarse.Where(v =>
                        (!string.IsNullOrEmpty(v.PhoneNumber) && new string(v.PhoneNumber.Where(char.IsDigit).ToArray()).Contains(digitsQuery)) ||
                        (!string.IsNullOrEmpty(v.Name) && v.Name.ToLower().Contains(phoneLower)))
                        .Take(50)
                        .ToList();

                    // If refined filtering removed all coarse candidates, fall back to coarse results
                    if (results.Count == 0 && coarse.Count > 0)
                    {
                        _logger.LogInformation("Refined filter removed all candidates; falling back to coarse results (count={Count})", coarse.Count);
                        results = coarse.Take(50).ToList();
                    }
                }
                else
                {
                    results = coarse.Take(50).ToList();
                }
            }
            else
            {
                results = await query
                    .OrderByDescending(v => v.RegisteredAt)
                    .Take(50)
                    .ToListAsync();
            }

            var dtos = results.Select(MapToDto).ToList();

            return new ApiResponse<List<VisitorDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} visitor(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching visitors");
            return new ApiResponse<List<VisitorDto>>
            {
                Success = false,
                Message = "An error occurred while searching",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<VisitorDto>> GetVisitorAsync(int id)
    {
        try
        {
            var visitor = await _context.Visitors.FindAsync(id);

            if (visitor == null)
                return new ApiResponse<VisitorDto>
                {
                    Success = false,
                    Message = "Visitor not found"
                };

            return new ApiResponse<VisitorDto>
            {
                Success = true,
                Data = MapToDto(visitor)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting visitor");
            return new ApiResponse<VisitorDto>
            {
                Success = false,
                Message = "An error occurred",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<List<VisitorDto>>> GetVisitorsByProjectAsync(int projectId)
    {
        try
        {
            _logger.LogInformation("GetVisitorsByProjectAsync called for projectId={ProjectId}", projectId);

            // Query visitors directly by ProjectId
            var visitors = await _context.Visitors
                .Include(v => v.Project)
                .Where(v => v.ProjectId == projectId)
                .OrderByDescending(v => v.RegisteredAt)
                .ToListAsync();

            var dtos = visitors.Select(MapToDto).ToList();

            return new ApiResponse<List<VisitorDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} visitor(s) for project {projectId}",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting visitors by project");
            return new ApiResponse<List<VisitorDto>>
            {
                Success = false,
                Message = "An error occurred while retrieving visitors for the project",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    private VisitorDto MapToDto(Visitor visitor)
    {
        return new VisitorDto
        {
            Id = visitor.Id,
            Name = visitor.Name,
            PhoneNumber = visitor.PhoneNumber,
            CompanyName = visitor.CompanyName,
            Purpose = visitor.Purpose,
            PhotoUrl = string.IsNullOrWhiteSpace(visitor.PhotoUrl) ? string.Empty : (visitor.PhotoUrl.StartsWith("/api/entryexit/photos/") ? visitor.PhotoUrl : $"/api/entryexit/photos/{visitor.PhotoUrl}"),
            RegisteredBy = visitor.RegisteredBy,
            RegisteredAt = visitor.RegisteredAt,
            ProjectId = visitor.ProjectId,
            ProjectName = visitor.Project?.Name ?? string.Empty
        };
    }
}
