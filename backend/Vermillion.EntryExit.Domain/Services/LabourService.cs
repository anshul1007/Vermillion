using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Vermillion.EntryExit.Domain.Services;

public interface ILabourService
{
    Task<AuthApiResponse<LabourDto>> RegisterLabourAsync(CreateLabourDto dto, string registeredBy);
    Task<AuthApiResponse<List<LabourDto>>> SearchLabourAsync(string? barcode, string? name, string? phone, int? projectId);
    Task<AuthApiResponse<LabourDto>> GetLabourAsync(int id);
    Task<AuthApiResponse<List<LabourDto>>> GetLabourByProjectAsync(int projectId);
    Task<AuthApiResponse<List<LabourDto>>> GetLabourByContractorAsync(int contractorId);
}

public class LabourService : ILabourService
{
    private readonly EntryExitDbContext _context;
    private readonly IEncryptionService _encryption;
    private readonly IPhotoStorageService _photoStorage;
    private readonly ILogger<LabourService> _logger;

    public LabourService(
        EntryExitDbContext context,
        IEncryptionService encryption,
        IPhotoStorageService photoStorage,
        ILogger<LabourService> logger)
    {
        _context = context;
        _encryption = encryption;
        _photoStorage = photoStorage;
        _logger = logger;
    }

    public async Task<AuthApiResponse<LabourDto>> RegisterLabourAsync(CreateLabourDto dto, string registeredBy)
    {
        try
        {
            _logger.LogInformation("Registering labour - Name: {Name}, Phone: {Phone}, Barcode: {Barcode}",
                dto.Name, dto.PhoneNumber, dto.Barcode);

            // Validate project and contractor exist
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null || !project.IsActive)
                return new AuthApiResponse<LabourDto>
                {
                    Success = false,
                    Message = "Invalid or inactive project"
                };

            var contractor = await _context.Contractors.FindAsync(dto.ContractorId);
            if (contractor == null || !contractor.IsActive || contractor.ProjectId != dto.ProjectId)
                return new AuthApiResponse<LabourDto>
                {
                    Success = false,
                    Message = "Invalid contractor for this project"
                };

            // Check if barcode already exists for this project
            var existingBarcode = await _context.Labours
                .AnyAsync(l => l.ProjectId == dto.ProjectId && l.Barcode == dto.Barcode);

            if (existingBarcode)
                return new AuthApiResponse<LabourDto>
                {
                    Success = false,
                    Message = "Barcode already registered for this project",
                    Errors = new List<string> { "DUPLICATE_BARCODE" }
                };

            // Validate and process photo (required)
            if (string.IsNullOrEmpty(dto.PhotoBase64))
            {
                return new AuthApiResponse<LabourDto>
                {
                    Success = false,
                    Message = "Photo is required for labour registration",
                    Errors = new List<string> { "PHOTO_REQUIRED" }
                };
            }

            string photoUrl = await _photoStorage.SavePhotoAsync(dto.PhotoBase64, "labour");

            // Create labour record
            var labour = new Labour
            {
                Name = dto.Name,
                PhoneNumber = dto.PhoneNumber,
                AadharNumberEncrypted = !string.IsNullOrEmpty(dto.AadharNumber)
                    ? _encryption.Encrypt(dto.AadharNumber)
                    : null,
                PhotoUrl = photoUrl,
                ProjectId = dto.ProjectId,
                ContractorId = dto.ContractorId,
                Barcode = dto.Barcode,
                RegisteredBy = registeredBy,
                RegisteredAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _logger.LogInformation("Created labour entity - Name: {Name}, Phone: {Phone}, Barcode: {Barcode}",
                labour.Name, labour.PhoneNumber, labour.Barcode);

            _context.Labours.Add(labour);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Saved labour with ID: {Id}", labour.Id);

            // Load labour with navigation properties
            var fullLabour = await _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .FirstAsync(l => l.Id == labour.Id);

            var result = MapToDto(fullLabour);

            return new AuthApiResponse<LabourDto>
            {
                Success = true,
                Message = "Labour registered successfully",
                Data = result
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering labour");
            return new AuthApiResponse<LabourDto>
            {
                Success = false,
                Message = "An error occurred while registering labour",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<List<LabourDto>>> SearchLabourAsync(string? barcode, string? name, string? phone, int? projectId)
    {
        try
        {
            var query = _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .Where(l => l.IsActive);

            if (!string.IsNullOrEmpty(barcode))
            {
                query = query.Where(l => l.Barcode == barcode);
            }

            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(l => EF.Functions.Like(l.Name, $"%{name}%"));
            }

            if (!string.IsNullOrEmpty(phone))
            {
                query = query.Where(l => EF.Functions.Like(l.PhoneNumber, $"%{phone}%"));
            }

            if (projectId.HasValue)
            {
                query = query.Where(l => l.ProjectId == projectId.Value);
            }

            var results = await query.Take(50).ToListAsync();
            var dtos = results.Select(MapToDto).ToList();

            return new AuthApiResponse<List<LabourDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} labour(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching labour");
            return new AuthApiResponse<List<LabourDto>>
            {
                Success = false,
                Message = "An error occurred while searching",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<LabourDto>> GetLabourAsync(int id)
    {
        try
        {
            var labour = await _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (labour == null)
                return new AuthApiResponse<LabourDto>
                {
                    Success = false,
                    Message = "Labour not found"
                };

            return new AuthApiResponse<LabourDto>
            {
                Success = true,
                Data = MapToDto(labour)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour");
            return new AuthApiResponse<LabourDto>
            {
                Success = false,
                Message = "An error occurred",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<List<LabourDto>>> GetLabourByProjectAsync(int projectId)
    {
        try
        {
            var labours = await _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .Where(l => l.ProjectId == projectId && l.IsActive)
                .OrderByDescending(l => l.RegisteredAt)
                .ToListAsync();

            var dtos = labours.Select(MapToDto).ToList();

            return new AuthApiResponse<List<LabourDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} labour(s) for project",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour by project");
            return new AuthApiResponse<List<LabourDto>>
            {
                Success = false,
                Message = "An error occurred",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<AuthApiResponse<List<LabourDto>>> GetLabourByContractorAsync(int contractorId)
    {
        try
        {
            var labours = await _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .Where(l => l.ContractorId == contractorId && l.IsActive)
                .OrderByDescending(l => l.RegisteredAt)
                .ToListAsync();

            var dtos = labours.Select(MapToDto).ToList();

            return new AuthApiResponse<List<LabourDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} labour(s) for contractor",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour by contractor");
            return new AuthApiResponse<List<LabourDto>>
            {
                Success = false,
                Message = "An error occurred",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    private LabourDto MapToDto(Labour labour)
    {
        return new LabourDto
        {
            Id = labour.Id,
            Name = labour.Name,
            PhoneNumber = labour.PhoneNumber,
            AadharNumber = !string.IsNullOrEmpty(labour.AadharNumberEncrypted)
                ? _encryption.Decrypt(labour.AadharNumberEncrypted)
                : null,
            PhotoUrl = string.IsNullOrEmpty(labour.PhotoUrl) ? string.Empty : (labour.PhotoUrl.StartsWith("/api/entryexit/photos/") ? labour.PhotoUrl : $"/api/entryexit/photos/{labour.PhotoUrl}"),
            ProjectId = labour.ProjectId,
            ProjectName = labour.Project.Name,
            ContractorId = labour.ContractorId,
            ContractorName = labour.Contractor.Name,
            Barcode = labour.Barcode,
            IsActive = labour.IsActive,
            RegisteredBy = labour.RegisteredBy,
            RegisteredAt = labour.RegisteredAt,
            CreatedAt = labour.CreatedAt,
            UpdatedAt = labour.UpdatedAt
        };
    }
}
