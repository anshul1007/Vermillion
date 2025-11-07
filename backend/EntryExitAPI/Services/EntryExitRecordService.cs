using EntryExitAPI.Data;
using EntryExitAPI.Models.DTOs;
using EntryExitAPI.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EntryExitAPI.Services;

public interface IEntryExitRecordService
{
    Task<ApiResponse<EntryExitRecordDto>> CreateRecordAsync(CreateEntryExitRecordDto dto, string recordedBy);
    Task<ApiResponse<List<OpenSessionDto>>> GetOpenSessionsAsync(int? labourRegistrationId, int? visitorId, int? projectId);
    Task<ApiResponse<SearchResultDto>> SearchAsync(SearchRequestDto request);
    Task<ApiResponse<List<EntryExitRecordDto>>> GetRecordsAsync(int? labourRegistrationId, int? visitorId, DateTime? fromDate, DateTime? toDate);
}

public class EntryExitRecordService : IEntryExitRecordService
{
    private readonly EntryExitDbContext _context;
    private readonly ILogger<EntryExitRecordService> _logger;

    public EntryExitRecordService(
        EntryExitDbContext context,
        ILogger<EntryExitRecordService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ApiResponse<EntryExitRecordDto>> CreateRecordAsync(CreateEntryExitRecordDto dto, string recordedBy)
    {
        try
        {
            // Validate person type and IDs match
            if (dto.PersonType == PersonType.Labour && !dto.LabourRegistrationId.HasValue)
                return new ApiResponse<EntryExitRecordDto>
                {
                    Success = false,
                    Message = "LabourRegistrationId is required for Labour entry/exit"
                };

            if (dto.PersonType == PersonType.Visitor && !dto.VisitorId.HasValue)
                return new ApiResponse<EntryExitRecordDto>
                {
                    Success = false,
                    Message = "VisitorId is required for Visitor entry/exit"
                };

            // Check for duplicate ClientId (offline sync de-duplication)
            if (dto.ClientId.HasValue)
            {
                var existingRecord = await _context.EntryExitRecords
                    .FirstOrDefaultAsync(r => r.ClientId == dto.ClientId.Value);

                if (existingRecord != null)
                {
                    // Already synced, return existing record
                    return new ApiResponse<EntryExitRecordDto>
                    {
                        Success = true,
                        Message = "Record already exists (duplicate ClientId)",
                        Data = await MapToDtoAsync(existingRecord)
                    };
                }
            }

            // Double-entry prevention: check for open sessions when creating Entry
            if (dto.Action == RecordAction.Entry)
            {
                bool hasOpenSession = false;

                if (dto.PersonType == PersonType.Labour && dto.LabourRegistrationId.HasValue)
                {
                    hasOpenSession = await HasOpenSessionAsync(dto.LabourRegistrationId.Value, null);
                }
                else if (dto.PersonType == PersonType.Visitor && dto.VisitorId.HasValue)
                {
                    hasOpenSession = await HasOpenSessionAsync(null, dto.VisitorId.Value);
                }

                if (hasOpenSession)
                {
                    return new ApiResponse<EntryExitRecordDto>
                    {
                        Success = false,
                        Message = "Person already has an open entry session. Please record exit first.",
                        Errors = new List<string> { "OPEN_SESSION_EXISTS" }
                    };
                }
            }

            // Create record
            var record = new EntryExitRecord
            {
                PersonType = dto.PersonType,
                LabourRegistrationId = dto.LabourRegistrationId,
                VisitorId = dto.VisitorId,
                Action = dto.Action,
                Timestamp = dto.Timestamp ?? DateTimeOffset.UtcNow,
                Gate = dto.Gate,
                Notes = dto.Notes,
                RecordedBy = recordedBy,
                ClientId = dto.ClientId,
                CreatedAt = DateTime.UtcNow
            };

            _context.EntryExitRecords.Add(record);
            await _context.SaveChangesAsync();

            var recordDto = await MapToDtoAsync(record);

            return new ApiResponse<EntryExitRecordDto>
            {
                Success = true,
                Message = $"{dto.Action} recorded successfully",
                Data = recordDto
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating entry/exit record");
            return new ApiResponse<EntryExitRecordDto>
            {
                Success = false,
                Message = "An error occurred while creating record",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<List<OpenSessionDto>>> GetOpenSessionsAsync(int? labourRegistrationId, int? visitorId, int? projectId)
    {
        try
        {
            var query = _context.EntryExitRecords
                .Where(r => r.Action == RecordAction.Entry);

            if (labourRegistrationId.HasValue)
            {
                query = query.Where(r => r.LabourRegistrationId == labourRegistrationId.Value);
            }

            if (visitorId.HasValue)
            {
                query = query.Where(r => r.VisitorId == visitorId.Value);
            }

            if (projectId.HasValue)
            {
                query = query.Where(r => r.LabourRegistration!.ProjectId == projectId.Value);
            }

            var entryRecords = await query
                .Include(r => r.LabourRegistration)
                    .ThenInclude(lr => lr!.Labour)
                .Include(r => r.Visitor)
                .ToListAsync();

            var openSessions = new List<OpenSessionDto>();

            foreach (var entry in entryRecords)
            {
                // Check if there's a corresponding exit
                bool hasExit = await _context.EntryExitRecords.AnyAsync(r =>
                    r.Action == RecordAction.Exit &&
                    r.PersonType == entry.PersonType &&
                    r.LabourRegistrationId == entry.LabourRegistrationId &&
                    r.VisitorId == entry.VisitorId &&
                    r.Timestamp > entry.Timestamp);

                if (!hasExit)
                {
                    openSessions.Add(new OpenSessionDto
                    {
                        EntryRecordId = entry.Id,
                        PersonType = entry.PersonType,
                        PersonName = entry.PersonType == PersonType.Labour
                            ? entry.LabourRegistration?.Labour?.Name ?? "Unknown"
                            : entry.Visitor?.Name ?? "Unknown",
                        PhotoUrl = entry.PersonType == PersonType.Labour
                            ? entry.LabourRegistration?.Labour?.PhotoUrl
                            : entry.Visitor?.PhotoUrl,
                        EntryTime = entry.Timestamp,
                        Gate = entry.Gate,
                        LabourRegistrationId = entry.LabourRegistrationId,
                        VisitorId = entry.VisitorId,
                        GuardName = entry.RecordedBy  // Guard who recorded the entry
                    });
                }
            }

            return new ApiResponse<List<OpenSessionDto>>
            {
                Success = true,
                Message = $"Found {openSessions.Count} open session(s)",
                Data = openSessions
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting open sessions");
            return new ApiResponse<List<OpenSessionDto>>
            {
                Success = false,
                Message = "An error occurred",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<SearchResultDto>> SearchAsync(SearchRequestDto request)
    {
        try
        {
            // First try barcode search (labour only)
            if (!string.IsNullOrEmpty(request.Barcode))
            {
                var labourReg = await _context.LabourRegistrations
                    .Include(lr => lr.Labour)
                    .Include(lr => lr.Project)
                    .Include(lr => lr.Contractor)
                    .FirstOrDefaultAsync(lr => lr.Barcode == request.Barcode && lr.IsActive);

                if (labourReg != null)
                {
                    var hasOpen = await HasOpenSessionAsync(labourReg.Id, null);
                    var lastEntry = await GetLastEntryAsync(labourReg.Id, null);

                    return new ApiResponse<SearchResultDto>
                    {
                        Success = true,
                        Data = new SearchResultDto
                        {
                            ResultType = "Labour",
                            LabourRegistration = MapLabourRegistrationToDto(labourReg),
                            HasOpenEntry = hasOpen,
                            LastEntry = lastEntry
                        }
                    };
                }
            }

            // Search by name/phone
            if (!string.IsNullOrEmpty(request.Name) || !string.IsNullOrEmpty(request.Phone))
            {
                // Search labour first
                var labourQuery = _context.LabourRegistrations
                    .Include(lr => lr.Labour)
                    .Include(lr => lr.Project)
                    .Include(lr => lr.Contractor)
                    .Where(lr => lr.IsActive);

                if (!string.IsNullOrEmpty(request.Name))
                    labourQuery = labourQuery.Where(lr => lr.Labour.Name.Contains(request.Name));
                
                if (!string.IsNullOrEmpty(request.Phone))
                    labourQuery = labourQuery.Where(lr => lr.Labour.PhoneNumber.Contains(request.Phone));
                
                if (request.ProjectId.HasValue)
                    labourQuery = labourQuery.Where(lr => lr.ProjectId == request.ProjectId.Value);

                var labour = await labourQuery.FirstOrDefaultAsync();

                if (labour != null)
                {
                    var hasOpen = await HasOpenSessionAsync(labour.Id, null);
                    var lastEntry = await GetLastEntryAsync(labour.Id, null);

                    return new ApiResponse<SearchResultDto>
                    {
                        Success = true,
                        Data = new SearchResultDto
                        {
                            ResultType = "Labour",
                            LabourRegistration = MapLabourRegistrationToDto(labour),
                            HasOpenEntry = hasOpen,
                            LastEntry = lastEntry
                        }
                    };
                }

                // Search visitors
                var visitorQuery = _context.Visitors.AsQueryable();

                if (!string.IsNullOrEmpty(request.Name))
                    visitorQuery = visitorQuery.Where(v => v.Name.Contains(request.Name));
                
                if (!string.IsNullOrEmpty(request.Phone))
                    visitorQuery = visitorQuery.Where(v => v.PhoneNumber.Contains(request.Phone));

                var visitor = await visitorQuery
                    .OrderByDescending(v => v.RegisteredAt)
                    .FirstOrDefaultAsync();

                if (visitor != null)
                {
                    var hasOpen = await HasOpenSessionAsync(null, visitor.Id);
                    var lastEntry = await GetLastEntryAsync(null, visitor.Id);

                    return new ApiResponse<SearchResultDto>
                    {
                        Success = true,
                        Data = new SearchResultDto
                        {
                            ResultType = "Visitor",
                            Visitor = MapVisitorToDto(visitor),
                            HasOpenEntry = hasOpen,
                            LastEntry = lastEntry
                        }
                    };
                }
            }

            return new ApiResponse<SearchResultDto>
            {
                Success = false,
                Message = "No results found"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching");
            return new ApiResponse<SearchResultDto>
            {
                Success = false,
                Message = "An error occurred while searching",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    public async Task<ApiResponse<List<EntryExitRecordDto>>> GetRecordsAsync(int? labourRegistrationId, int? visitorId, DateTime? fromDate, DateTime? toDate)
    {
        try
        {
            var query = _context.EntryExitRecords
                .Include(r => r.LabourRegistration)
                    .ThenInclude(lr => lr!.Labour)
                .Include(r => r.LabourRegistration)
                    .ThenInclude(lr => lr!.Project)
                .Include(r => r.LabourRegistration)
                    .ThenInclude(lr => lr!.Contractor)
                .Include(r => r.Visitor)
                .AsQueryable();

            if (labourRegistrationId.HasValue)
                query = query.Where(r => r.LabourRegistrationId == labourRegistrationId.Value);

            if (visitorId.HasValue)
                query = query.Where(r => r.VisitorId == visitorId.Value);

            if (fromDate.HasValue)
                query = query.Where(r => r.Timestamp >= new DateTimeOffset(fromDate.Value, TimeSpan.Zero));

            if (toDate.HasValue)
                query = query.Where(r => r.Timestamp <= new DateTimeOffset(toDate.Value.AddDays(1), TimeSpan.Zero));

            var records = await query
                .OrderByDescending(r => r.Timestamp)
                .Take(100)
                .ToListAsync();

            var dtos = new List<EntryExitRecordDto>();
            foreach (var record in records)
            {
                dtos.Add(await MapToDtoAsync(record));
            }

            return new ApiResponse<List<EntryExitRecordDto>>
            {
                Success = true,
                Message = $"Found {dtos.Count} record(s)",
                Data = dtos
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting records");
            return new ApiResponse<List<EntryExitRecordDto>>
            {
                Success = false,
                Message = "An error occurred",
                Errors = new List<string> { ex.Message }
            };
        }
    }

    private async Task<bool> HasOpenSessionAsync(int? labourRegistrationId, int? visitorId)
    {
        var lastRecord = await _context.EntryExitRecords
            .Where(r => r.LabourRegistrationId == labourRegistrationId && r.VisitorId == visitorId)
            .OrderByDescending(r => r.Timestamp)
            .FirstOrDefaultAsync();

        return lastRecord != null && lastRecord.Action == RecordAction.Entry;
    }

    private async Task<EntryExitRecordDto?> GetLastEntryAsync(int? labourRegistrationId, int? visitorId)
    {
        var lastRecord = await _context.EntryExitRecords
            .Include(r => r.LabourRegistration)
                .ThenInclude(lr => lr!.Labour)
            .Include(r => r.LabourRegistration)
                .ThenInclude(lr => lr!.Project)
            .Include(r => r.LabourRegistration)
                .ThenInclude(lr => lr!.Contractor)
            .Include(r => r.Visitor)
            .Where(r => r.LabourRegistrationId == labourRegistrationId && r.VisitorId == visitorId)
            .OrderByDescending(r => r.Timestamp)
            .FirstOrDefaultAsync();

        return lastRecord != null ? await MapToDtoAsync(lastRecord) : null;
    }

    private async Task<EntryExitRecordDto> MapToDtoAsync(EntryExitRecord record)
    {
        // Load navigation properties if not loaded
        if (record.PersonType == PersonType.Labour && record.LabourRegistrationId.HasValue && record.LabourRegistration == null)
        {
            record.LabourRegistration = await _context.LabourRegistrations
                .Include(lr => lr.Labour)
                .Include(lr => lr.Project)
                .Include(lr => lr.Contractor)
                .FirstOrDefaultAsync(lr => lr.Id == record.LabourRegistrationId.Value);
        }

        if (record.PersonType == PersonType.Visitor && record.VisitorId.HasValue && record.Visitor == null)
        {
            record.Visitor = await _context.Visitors.FindAsync(record.VisitorId.Value);
        }

        return new EntryExitRecordDto
        {
            Id = record.Id,
            PersonType = record.PersonType,
            LabourRegistrationId = record.LabourRegistrationId,
            VisitorId = record.VisitorId,
            Action = record.Action,
            Timestamp = record.Timestamp,
            Gate = record.Gate,
            Notes = record.Notes,
            RecordedBy = record.RecordedBy,
            GuardName = record.RecordedBy,  // Guard who recorded the entry/exit
            PersonName = record.PersonType == PersonType.Labour
                ? record.LabourRegistration?.Labour?.Name
                : record.Visitor?.Name,
            PhotoUrl = record.PersonType == PersonType.Labour
                ? record.LabourRegistration?.Labour?.PhotoUrl
                : record.Visitor?.PhotoUrl,
            ContractorName = record.PersonType == PersonType.Labour
                ? record.LabourRegistration?.Contractor?.Name
                : null,
            ProjectName = record.PersonType == PersonType.Labour
                ? record.LabourRegistration?.Project?.Name
                : null
        };
    }

    private LabourRegistrationDto MapLabourRegistrationToDto(LabourRegistration lr)
    {
        return new LabourRegistrationDto
        {
            Id = lr.Id,
            Labour = new LabourDto
            {
                Id = lr.Labour.Id,
                Name = lr.Labour.Name,
                PhoneNumber = lr.Labour.PhoneNumber,
                PhotoUrl = lr.Labour.PhotoUrl
            },
            Project = new ProjectDto
            {
                Id = lr.Project.Id,
                Name = lr.Project.Name,
                IsActive = lr.Project.IsActive
            },
            Contractor = new ContractorDto
            {
                Id = lr.Contractor.Id,
                Name = lr.Contractor.Name,
                ProjectId = lr.Contractor.ProjectId,
                IsActive = lr.Contractor.IsActive
            },
            Barcode = lr.Barcode,
            IsActive = lr.IsActive,
            RegisteredBy = lr.RegisteredBy,
            RegisteredAt = lr.RegisteredAt
        };
    }

    private VisitorDto MapVisitorToDto(Visitor visitor)
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
