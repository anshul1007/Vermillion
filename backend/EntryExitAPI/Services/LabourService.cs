using EntryExitAPI.Data;
using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EntryExitAPI.Services;

public interface ILabourService
{
    Task<ApiResponse<LabourRegistrationDto>> RegisterLabourAsync(CreateLabourRegistrationDto dto, string registeredBy);
    Task<ApiResponse<List<LabourRegistrationDto>>> SearchLabourAsync(string? barcode, string? name, string? phone, int? projectId);
    Task<ApiResponse<LabourRegistrationDto>> GetLabourRegistrationAsync(int id);
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

    public async Task<ApiResponse<LabourRegistrationDto>> RegisterLabourAsync(CreateLabourRegistrationDto dto, string registeredBy)
    {
        try
        {
            // Validate project and contractor exist
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null || !project.IsActive)
                return new ApiResponse<LabourRegistrationDto> 
                { 
                    Success = false, 
                    Message = "Invalid or inactive project" 
                };

            var contractor = await _context.Contractors.FindAsync(dto.ContractorId);
            if (contractor == null || !contractor.IsActive || contractor.ProjectId != dto.ProjectId)
                return new ApiResponse<LabourRegistrationDto> 
                { 
                    Success = false, 
                    Message = "Invalid contractor for this project" 
                };

            // Check if barcode already exists for this project
            var existingBarcode = await _context.LabourRegistrations
                .AnyAsync(lr => lr.ProjectId == dto.ProjectId && lr.Barcode == dto.Barcode);
            
            if (existingBarcode)
                return new ApiResponse<LabourRegistrationDto> 
                { 
                    Success = false, 
                    Message = "Barcode already registered for this project",
                    Errors = new List<string> { "DUPLICATE_BARCODE" }
                };

            Labour labour;

            if (dto.LabourId.HasValue)
            {
                // Use existing labour
                labour = await _context.Labours.FindAsync(dto.LabourId.Value);
                if (labour == null)
                    return new ApiResponse<LabourRegistrationDto> 
                    { 
                        Success = false, 
                        Message = "Labour not found" 
                    };
            }
            else if (dto.Labour != null)
            {
                // Create new labour
                string? photoUrl = null;
                if (!string.IsNullOrEmpty(dto.PhotoBase64))
                {
                    photoUrl = await _photoStorage.SavePhotoAsync(dto.PhotoBase64, "labour");
                }

                labour = new Labour
                {
                    Name = dto.Labour.Name,
                    PhoneNumber = dto.Labour.PhoneNumber,
                    AadharNumberEncrypted = !string.IsNullOrEmpty(dto.Labour.AadharNumber) 
                        ? _encryption.Encrypt(dto.Labour.AadharNumber) 
                        : null,
                    PhotoUrl = photoUrl,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Labours.Add(labour);
                await _context.SaveChangesAsync();
            }
            else
            {
                return new ApiResponse<LabourRegistrationDto> 
                { 
                    Success = false, 
                    Message = "Either LabourId or Labour details must be provided" 
                };
            }

            // Create registration
            var registration = new LabourRegistration
            {
                LabourId = labour.Id,
                ProjectId = dto.ProjectId,
                ContractorId = dto.ContractorId,
                Barcode = dto.Barcode,
                RegisteredBy = registeredBy,
                RegisteredAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.LabourRegistrations.Add(registration);
            await _context.SaveChangesAsync();

            // Load full registration with navigation properties
            var fullRegistration = await _context.LabourRegistrations
                .Include(lr => lr.Labour)
                .Include(lr => lr.Project)
                .Include(lr => lr.Contractor)
                .FirstAsync(lr => lr.Id == registration.Id);

            var result = MapToDto(fullRegistration);

            return new ApiResponse<LabourRegistrationDto>
            {
                Success = true,
                Message = "Labour registered successfully",
                Data = result
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering labour");
            return new ApiResponse<LabourRegistrationDto>
            {
                Success = false,
                Message = "An error occurred while registering labour",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<List<LabourRegistrationDto>>> SearchLabourAsync(string? barcode, string? name, string? phone, int? projectId)
    {
        try
        {
            var query = _context.LabourRegistrations
                .Include(lr => lr.Labour)
                .Include(lr => lr.Project)
                .Include(lr => lr.Contractor)
                .Where(lr => lr.IsActive);

            if (!string.IsNullOrEmpty(barcode))
            {
                query = query.Where(lr => lr.Barcode == barcode);
            }

            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(lr => lr.Labour.Name.Contains(name));
            }

            if (!string.IsNullOrEmpty(phone))
            {
                query = query.Where(lr => lr.Labour.PhoneNumber.Contains(phone));
            }

            if (projectId.HasValue)
            {
                query = query.Where(lr => lr.ProjectId == projectId.Value);
            }

            var results = await query.Take(50).ToListAsync();
            var dtos = results.Select(MapToDto).ToList();

            return new ApiResponse<List<LabourRegistrationDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} labour registration(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching labour");
            return new ApiResponse<List<LabourRegistrationDto>>
            {
                Success = false,
                Message = "An error occurred while searching",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<LabourRegistrationDto>> GetLabourRegistrationAsync(int id)
    {
        try
        {
            var registration = await _context.LabourRegistrations
                .Include(lr => lr.Labour)
                .Include(lr => lr.Project)
                .Include(lr => lr.Contractor)
                .FirstOrDefaultAsync(lr => lr.Id == id);

            if (registration == null)
                return new ApiResponse<LabourRegistrationDto>
                {
                    Success = false,
                    Message = "Labour registration not found"
                };

            return new ApiResponse<LabourRegistrationDto>
            {
                Success = true,
                Data = MapToDto(registration)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour registration");
            return new ApiResponse<LabourRegistrationDto>
            {
                Success = false,
                Message = "An error occurred",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    private LabourRegistrationDto MapToDto(LabourRegistration registration)
    {
        return new LabourRegistrationDto
        {
            Id = registration.Id,
            Labour = new LabourDto
            {
                Id = registration.Labour.Id,
                Name = registration.Labour.Name,
                PhoneNumber = registration.Labour.PhoneNumber,
                AadharNumber = !string.IsNullOrEmpty(registration.Labour.AadharNumberEncrypted)
                    ? _encryption.Decrypt(registration.Labour.AadharNumberEncrypted)
                    : null,
                PhotoUrl = registration.Labour.PhotoUrl
            },
            Project = new ProjectDto
            {
                Id = registration.Project.Id,
                Name = registration.Project.Name,
                Description = registration.Project.Description,
                IsActive = registration.Project.IsActive
            },
            Contractor = new ContractorDto
            {
                Id = registration.Contractor.Id,
                Name = registration.Contractor.Name,
                ContactPerson = registration.Contractor.ContactPerson,
                PhoneNumber = registration.Contractor.PhoneNumber,
                ProjectId = registration.Contractor.ProjectId,
                IsActive = registration.Contractor.IsActive
            },
            Barcode = registration.Barcode,
            IsActive = registration.IsActive,
            RegisteredBy = registration.RegisteredBy,
            RegisteredAt = registration.RegisteredAt
        };
    }
}
