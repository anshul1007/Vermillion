using EntryExitAPI.Data;
using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EntryExitAPI.Services;

public interface IVisitorService
{
    Task<ApiResponse<VisitorDto>> RegisterVisitorAsync(CreateVisitorDto dto, string registeredBy);
    Task<ApiResponse<List<VisitorDto>>> SearchVisitorAsync(string? name, string? phone);
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
            if (string.IsNullOrEmpty(dto.PhotoBase64))
                return new ApiResponse<VisitorDto>
                {
                    Success = false,
                    Message = "Photo is required for visitor registration"
                };

            // Save photo
            string photoUrl = await _photoStorage.SavePhotoAsync(dto.PhotoBase64, "visitor");

            var visitor = new Visitor
            {
                Name = dto.Name,
                PhoneNumber = dto.PhoneNumber,
                CompanyName = dto.CompanyName,
                Purpose = dto.Purpose,
                PhotoUrl = photoUrl,
                RegisteredBy = registeredBy,
                RegisteredAt = DateTime.UtcNow
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
            var query = _context.Visitors.AsQueryable();

            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(v => v.Name.Contains(name));
            }

            if (!string.IsNullOrEmpty(phone))
            {
                query = query.Where(v => v.PhoneNumber.Contains(phone));
            }

            var results = await query
                .OrderByDescending(v => v.RegisteredAt)
                .Take(50)
                .ToListAsync();

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

    private VisitorDto MapToDto(Visitor visitor)
    {
        return new VisitorDto
        {
            Id = visitor.Id,
            Name = visitor.Name,
            PhoneNumber = visitor.PhoneNumber,
            CompanyName = visitor.CompanyName,
            Purpose = visitor.Purpose,
            PhotoUrl = visitor.PhotoUrl,
            RegisteredBy = visitor.RegisteredBy,
            RegisteredAt = visitor.RegisteredAt
        };
    }
}
