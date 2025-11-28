using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Vermillion.Shared.Domain.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Vermillion.EntryExit.Domain.Services;

public interface ILabourService
{
    Task<ApiResponse<LabourDto>> RegisterLabourAsync(CreateLabourDto dto, string registeredBy);
    Task<ApiResponse<List<LabourDto>>> SearchLabourAsync(string? barcode, string? name, string? phone, int? projectId);
    Task<ApiResponse<List<LabourDto>>> SearchLabourByQueryAsync(string query, int? projectId);
    Task<ApiResponse<List<LabourDto>>> SearchLabourByContractorNameAsync(string contractorName);
    Task<ApiResponse<LabourDto>> GetLabourAsync(int id);
    Task<ApiResponse<List<LabourDto>>> GetLabourByProjectAsync(int projectId);
    Task<ApiResponse<List<LabourDto>>> GetLabourByContractorAsync(int contractorId);
    Task<ApiResponse<List<LabourDto>>> GetLabourByProjectAndContractorAsync(int projectId, int contractorId);
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

    public async Task<ApiResponse<LabourDto>> RegisterLabourAsync(CreateLabourDto dto, string registeredBy)
    {
        try
        {
            _logger.LogInformation("Registering labour - Name: {Name}, Phone: {Phone}, Barcode: {Barcode}",
                dto.Name, dto.PhoneNumber, dto.Barcode);

            // Validate project and contractor exist
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null || !project.IsActive)
                return ApiResponse<LabourDto>.ErrorResponse("Invalid or inactive project");

            var contractor = await _context.Contractors.FindAsync(dto.ContractorId);
            if (contractor == null || !contractor.IsActive || contractor.ProjectId != dto.ProjectId)
                return ApiResponse<LabourDto>.ErrorResponse("Invalid contractor for this project");

            // Check if barcode already exists for this project
            var existingBarcode = await _context.Labours
                .AnyAsync(l => l.ProjectId == dto.ProjectId && l.Barcode == dto.Barcode);

            if (existingBarcode)
                return ApiResponse<LabourDto>.ErrorResponse("Barcode already registered for this project", new List<string> { "DUPLICATE_BARCODE" });

            // Validate and process photo (required)
            if (string.IsNullOrWhiteSpace(dto.PhotoBase64))
            {
                return ApiResponse<LabourDto>.ErrorResponse("Photo is required for labour registration", new List<string> { "PHOTO_REQUIRED" });
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

            return ApiResponse<LabourDto>.SuccessResponse(result, "Labour registered successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering labour");
            return ApiResponse<LabourDto>.ErrorResponse("An error occurred while registering labour", ex.Message);
        }
    }

    public async Task<ApiResponse<List<LabourDto>>> SearchLabourAsync(string? barcode, string? name, string? phone, int? projectId)
    {
        try
        {
            var query = _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .Where(l => l.IsActive);

            if (!string.IsNullOrWhiteSpace(barcode))
            {
                query = query.Where(l => l.Barcode == barcode);
            }

            if (!string.IsNullOrWhiteSpace(name))
            {
                query = query.Where(l => EF.Functions.Like(l.Name, $"%{name}%"));
            }

            if (!string.IsNullOrWhiteSpace(phone))
            {
                query = query.Where(l => EF.Functions.Like(l.PhoneNumber, $"%{phone}%"));
            }

            if (projectId.HasValue)
            {
                query = query.Where(l => l.ProjectId == projectId.Value);
            }

            var results = await query.Take(50).ToListAsync();
            var dtos = results.Select(MapToDto).ToList();

            return ApiResponse<List<LabourDto>>.SuccessResponse(dtos, $"Found {dtos.Count} labour(s)");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching labour");
            return ApiResponse<List<LabourDto>>.ErrorResponse("An error occurred while searching", ex.Message);
        }
    }

    public async Task<ApiResponse<List<LabourDto>>> SearchLabourByQueryAsync(string query, int? projectId)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return ApiResponse<List<LabourDto>>.SuccessResponse(new List<LabourDto>(), "No query provided");
        }

        try
        {
            var trimmedQuery = query.Trim();

            var labourQuery = _context.Labours
                .AsNoTracking()
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .Where(l => l.IsActive);

            if (projectId.HasValue)
            {
                labourQuery = labourQuery.Where(l => l.ProjectId == projectId.Value);
            }

            labourQuery = labourQuery.Where(l =>
                l.Barcode == trimmedQuery ||
                (!string.IsNullOrEmpty(l.Name) && EF.Functions.Like(l.Name, $"%{trimmedQuery}%")) ||
                (!string.IsNullOrEmpty(l.PhoneNumber) && EF.Functions.Like(l.PhoneNumber, $"%{trimmedQuery}%")));

            var results = await labourQuery
                .OrderBy(l => l.Barcode == trimmedQuery ? 0 : 1)
                .ThenByDescending(l => l.RegisteredAt)
                .Take(50)
                .ToListAsync();

            var dtos = results.Select(MapToDto).ToList();

            return ApiResponse<List<LabourDto>>.SuccessResponse(dtos, $"Found {dtos.Count} labour(s)");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching labour by query");
            return ApiResponse<List<LabourDto>>.ErrorResponse("An error occurred while searching", ex.Message);
        }
    }

    public async Task<ApiResponse<List<LabourDto>>> SearchLabourByContractorNameAsync(string contractorName)
    {
        if (string.IsNullOrWhiteSpace(contractorName))
        {
            return ApiResponse<List<LabourDto>>.SuccessResponse(new List<LabourDto>(), "Contractor name is required");
        }

        try
        {
            var trimmedContractor = contractorName.Trim();

            var labourQuery = _context.Labours
                .AsNoTracking()
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .Where(l => l.IsActive && l.Contractor != null && l.Contractor.Name != null)
                .Where(l => EF.Functions.Like(l.Contractor!.Name!, $"%{trimmedContractor}%"));

            var results = await labourQuery
                .OrderByDescending(l => l.RegisteredAt)
                .Take(100)
                .ToListAsync();

            var dtos = results.Select(MapToDto).ToList();

            return ApiResponse<List<LabourDto>>.SuccessResponse(dtos, $"Found {dtos.Count} labour(s)");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching labour by contractor name");
            return ApiResponse<List<LabourDto>>.ErrorResponse("An error occurred while searching", ex.Message);
        }
    }

    public async Task<ApiResponse<LabourDto>> GetLabourAsync(int id)
    {
        try
        {
            var labour = await _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (labour == null)
                return ApiResponse<LabourDto>.ErrorResponse("Labour not found");

            return ApiResponse<LabourDto>.SuccessResponse(MapToDto(labour));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour");
            return ApiResponse<LabourDto>.ErrorResponse("An error occurred", ex.Message);
        }
    }

    public async Task<ApiResponse<List<LabourDto>>> GetLabourByProjectAsync(int projectId)
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

            return ApiResponse<List<LabourDto>>.SuccessResponse(dtos, $"Found {dtos.Count} labour(s) for project");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour by project");
            return ApiResponse<List<LabourDto>>.ErrorResponse("An error occurred", ex.Message);
        }
    }

    public async Task<ApiResponse<List<LabourDto>>> GetLabourByContractorAsync(int contractorId)
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

            return ApiResponse<List<LabourDto>>.SuccessResponse(dtos, $"Found {dtos.Count} labour(s) for contractor");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour by contractor");
            return ApiResponse<List<LabourDto>>.ErrorResponse("An error occurred", ex.Message);
        }
    }

    public async Task<ApiResponse<List<LabourDto>>> GetLabourByProjectAndContractorAsync(int projectId, int contractorId)
    {
        try
        {
            var labours = await _context.Labours
                .Include(l => l.Project)
                .Include(l => l.Contractor)
                .Where(l => l.ProjectId == projectId && l.ContractorId == contractorId && l.IsActive)
                .OrderByDescending(l => l.RegisteredAt)
                .ToListAsync();

            var dtos = labours.Select(MapToDto).ToList();

            return ApiResponse<List<LabourDto>>.SuccessResponse(dtos, $"Found {dtos.Count} labour(s) for project and contractor");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting labour by project {ProjectId} and contractor {ContractorId}", projectId, contractorId);
            return ApiResponse<List<LabourDto>>.ErrorResponse("An error occurred", ex.Message);
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
