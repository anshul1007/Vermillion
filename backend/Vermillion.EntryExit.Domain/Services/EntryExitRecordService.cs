using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.DTOs;
using Vermillion.EntryExit.Domain.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.EntryExit.Domain.Services;

public interface IEntryExitRecordService
{
    Task<ApiResponse<EntryExitRecordDto>> CreateRecordAsync(CreateEntryExitRecordDto dto, string recordedBy);
    Task<ApiResponse<List<OpenSessionDto>>> GetOpenSessionsAsync(int? labourId, int? visitorId, int? projectId);
    Task<Dictionary<int, bool>> HasOpenSessionsForLaboursAsync(IReadOnlyCollection<int> labourIds);
    Task<Dictionary<int, bool>> HasOpenSessionsForVisitorsAsync(IReadOnlyCollection<int> visitorIds);
    Task<ApiResponse<SearchResultDto>> SearchAsync(SearchRequestDto request);
    Task<ApiResponse<List<EntryExitRecordDto>>> GetRecordsAsync(int? labourId, int? visitorId, int? projectId, DateTime? fromDate, DateTime? toDate);
}

public class EntryExitRecordService : IEntryExitRecordService
{
    private readonly EntryExitDbContext _context;
    private readonly ILogger<EntryExitRecordService> _logger;
    private readonly IEncryptionService _encryption;

    public EntryExitRecordService(
        EntryExitDbContext context,
        ILogger<EntryExitRecordService> logger,
        IEncryptionService encryption)
    {
        _context = context;
        _logger = logger;
        _encryption = encryption;
    }

    public async Task<ApiResponse<EntryExitRecordDto>> CreateRecordAsync(CreateEntryExitRecordDto dto, string recordedBy)
    {
        try
        {
            // Validate person type and IDs match
            if (dto.PersonType == PersonType.Labour && !dto.LabourId.HasValue)
                return new ApiResponse<EntryExitRecordDto>
                {
                    Success = false,
                    Message = "LabourId is required for Labour entry/exit"
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

                if (dto.PersonType == PersonType.Labour && dto.LabourId.HasValue)
                {
                    hasOpenSession = await HasOpenSessionAsync(dto.LabourId.Value, null);
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
                LabourId = dto.LabourId,
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

    public async Task<ApiResponse<List<OpenSessionDto>>> GetOpenSessionsAsync(int? labourId, int? visitorId, int? projectId)
    {
        try
        {
            var query = _context.EntryExitRecords
                .Where(r => r.Action == RecordAction.Entry);

            if (labourId.HasValue)
            {
                query = query.Where(r => r.LabourId == labourId.Value);
            }

            if (visitorId.HasValue)
            {
                query = query.Where(r => r.VisitorId == visitorId.Value);
            }

            if (projectId.HasValue)
            {
                query = query.Where(r => r.Labour!.ProjectId == projectId.Value);
            }

            var entryRecords = await query
                .Include(r => r.Labour)
                    .ThenInclude(l => l!.Project)
                .Include(r => r.Labour)
                    .ThenInclude(l => l!.Contractor)
                .Include(r => r.Visitor)
                .ToListAsync();

            var openSessions = new List<OpenSessionDto>();

            foreach (var entry in entryRecords)
            {
                // Check if there's a corresponding exit
                bool hasExit = await _context.EntryExitRecords.AnyAsync(r =>
                    r.Action == RecordAction.Exit &&
                    r.PersonType == entry.PersonType &&
                    r.LabourId == entry.LabourId &&
                    r.VisitorId == entry.VisitorId &&
                    r.Timestamp > entry.Timestamp);

                if (!hasExit)
                {
                    openSessions.Add(new OpenSessionDto
                    {
                        EntryRecordId = entry.Id,
                        PersonType = entry.PersonType,
                        PersonName = entry.PersonType == PersonType.Labour
                            ? entry.Labour?.Name ?? "Unknown"
                            : entry.Visitor?.Name ?? "Unknown",
                        PhotoBase64 = entry.PersonType == PersonType.Labour
                            ? entry.Labour?.PhotoUrl
                            : entry.Visitor?.PhotoUrl,
                        EntryTime = entry.Timestamp,
                        Gate = entry.Gate,
                        LabourId = entry.LabourId,
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

    public async Task<Dictionary<int, bool>> HasOpenSessionsForLaboursAsync(IReadOnlyCollection<int> labourIds)
    {
        var ids = labourIds?.Where(id => id > 0).Distinct().ToArray();
        if (ids == null || ids.Length == 0)
        {
            return new Dictionary<int, bool>();
        }

        try
        {
            var result = ids.ToDictionary(id => id, _ => false);
            var processed = new HashSet<int>();

            var latestRecords = await _context.EntryExitRecords
                .AsNoTracking()
                .Where(r => r.PersonType == PersonType.Labour && r.LabourId.HasValue && ids.Contains(r.LabourId.Value))
                .OrderByDescending(r => r.Timestamp)
                .Select(r => new { r.LabourId, r.Action })
                .ToListAsync();

            foreach (var record in latestRecords)
            {
                if (!record.LabourId.HasValue)
                {
                    continue;
                }

                var labourId = record.LabourId.Value;
                if (!processed.Add(labourId))
                {
                    continue;
                }

                result[labourId] = record.Action == RecordAction.Entry;
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error determining open sessions for labour IDs {Ids}", ids);
            return ids.ToDictionary(id => id, _ => false);
        }
    }

    public async Task<Dictionary<int, bool>> HasOpenSessionsForVisitorsAsync(IReadOnlyCollection<int> visitorIds)
    {
        var ids = visitorIds?.Where(id => id > 0).Distinct().ToArray();
        if (ids == null || ids.Length == 0)
        {
            return new Dictionary<int, bool>();
        }

        try
        {
            var result = ids.ToDictionary(id => id, _ => false);
            var processed = new HashSet<int>();

            var latestRecords = await _context.EntryExitRecords
                .AsNoTracking()
                .Where(r => r.PersonType == PersonType.Visitor && r.VisitorId.HasValue && ids.Contains(r.VisitorId.Value))
                .OrderByDescending(r => r.Timestamp)
                .Select(r => new { r.VisitorId, r.Action })
                .ToListAsync();

            foreach (var record in latestRecords)
            {
                if (!record.VisitorId.HasValue)
                {
                    continue;
                }

                var visitorId = record.VisitorId.Value;
                if (!processed.Add(visitorId))
                {
                    continue;
                }

                result[visitorId] = record.Action == RecordAction.Entry;
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error determining open sessions for visitor IDs {Ids}", ids);
            return ids.ToDictionary(id => id, _ => false);
        }
    }

    public async Task<ApiResponse<SearchResultDto>> SearchAsync(SearchRequestDto request)
    {
        try
        {
            // First try barcode search (labour only)
            if (!string.IsNullOrWhiteSpace(request.Barcode))
            {
                var labourReg = await _context.Labours
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
                            Labour = MapLabourToDto(labourReg),
                            HasOpenEntry = hasOpen,
                            LastEntry = lastEntry
                        }
                    };
                }
            }

            // Search by name/phone
            if (!string.IsNullOrWhiteSpace(request.Name) || !string.IsNullOrWhiteSpace(request.Phone))
            {
                // Search labour first
                var labourQuery = _context.Labours
                    .Include(lr => lr.Project)
                    .Include(lr => lr.Contractor)
                    .Where(lr => lr.IsActive);

                if (!string.IsNullOrWhiteSpace(request.Name))
                    labourQuery = labourQuery.Where(lr => lr.Name.Contains(request.Name));

                if (!string.IsNullOrWhiteSpace(request.Phone))
                    labourQuery = labourQuery.Where(lr => lr.PhoneNumber.Contains(request.Phone));

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
                            Labour = MapLabourToDto(labour),
                            HasOpenEntry = hasOpen,
                            LastEntry = lastEntry
                        }
                    };
                }

                // Search visitors
                var visitorQuery = _context.Visitors.AsQueryable();

                if (!string.IsNullOrWhiteSpace(request.Name))
                    visitorQuery = visitorQuery.Where(v => v.Name.Contains(request.Name));

                if (!string.IsNullOrWhiteSpace(request.Phone))
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

    public async Task<ApiResponse<List<EntryExitRecordDto>>> GetRecordsAsync(int? labourId, int? visitorId, int? projectId, DateTime? fromDate, DateTime? toDate)
    {
        try
        {
            var query = _context.EntryExitRecords
                .Include(r => r.Labour)
                    .ThenInclude(l => l!.Project)
                .Include(r => r.Labour)
                    .ThenInclude(l => l!.Contractor)
                .Include(r => r.Labour)
                    .ThenInclude(lr => lr!.Project)
                .Include(r => r.Labour)
                    .ThenInclude(lr => lr!.Contractor)
                .Include(r => r.Visitor)
                .AsQueryable();

            if (labourId.HasValue)
                query = query.Where(r => r.LabourId == labourId.Value);

            if (visitorId.HasValue)
                query = query.Where(r => r.VisitorId == visitorId.Value);

            if (projectId.HasValue)
            {
                var projectFilter = projectId.Value;
                query = query.Where(r =>
                    (r.LabourId.HasValue && r.Labour != null && r.Labour.ProjectId == projectFilter) ||
                    (r.VisitorId.HasValue && r.Visitor != null && r.Visitor.ProjectId == projectFilter));
            }

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

    private async Task<bool> HasOpenSessionAsync(int? labourId, int? visitorId)
    {
        var lastRecord = await _context.EntryExitRecords
            .Where(r => r.LabourId == labourId && r.VisitorId == visitorId)
            .OrderByDescending(r => r.Timestamp)
            .FirstOrDefaultAsync();

        return lastRecord != null && lastRecord.Action == RecordAction.Entry;
    }

    private async Task<EntryExitRecordDto?> GetLastEntryAsync(int? labourId, int? visitorId)
    {
        var lastRecord = await _context.EntryExitRecords
            .Include(r => r.Labour)
                .ThenInclude(l => l!.Project)
                .Include(r => r.Labour)
                    .ThenInclude(l => l!.Contractor)
            .Include(r => r.Labour)
                .ThenInclude(lr => lr!.Project)
            .Include(r => r.Labour)
                .ThenInclude(lr => lr!.Contractor)
            .Include(r => r.Visitor)
            .Where(r => r.LabourId == labourId && r.VisitorId == visitorId)
            .OrderByDescending(r => r.Timestamp)
            .FirstOrDefaultAsync();

        return lastRecord != null ? await MapToDtoAsync(lastRecord) : null;
    }

    private async Task<EntryExitRecordDto> MapToDtoAsync(EntryExitRecord record)
    {
        // Load navigation properties if not loaded
        if (record.PersonType == PersonType.Labour && record.LabourId.HasValue && record.Labour == null)
        {
            record.Labour = await _context.Labours
                .Include(lr => lr.Project)
                .Include(lr => lr.Contractor)
                .FirstOrDefaultAsync(lr => lr.Id == record.LabourId.Value);
        }

        if (record.PersonType == PersonType.Visitor && record.VisitorId.HasValue && record.Visitor == null)
        {
            record.Visitor = await _context.Visitors.FindAsync(record.VisitorId.Value);
        }

        return new EntryExitRecordDto
        {
            Id = record.Id,
            PersonType = record.PersonType,
            LabourId = record.LabourId,
            VisitorId = record.VisitorId,
            Action = record.Action,
            Timestamp = record.Timestamp,
            Gate = record.Gate,
            Notes = record.Notes,
            RecordedBy = record.RecordedBy,
            ProjectId = record.PersonType == PersonType.Labour
                ? record.Labour?.ProjectId
                : record.Visitor?.ProjectId,
            GuardName = record.RecordedBy,  // Guard who recorded the entry/exit
            PersonName = record.PersonType == PersonType.Labour
                ? record.Labour?.Name
                : record.Visitor?.Name,
            PhotoBase64 = record.PersonType == PersonType.Labour
                ? (string.IsNullOrEmpty(record.Labour?.PhotoUrl) ? null : (record.Labour!.PhotoUrl.StartsWith("/api/entryexit/photos/") ? record.Labour.PhotoUrl : $"/api/entryexit/photos/{record.Labour.PhotoUrl}"))
                : (string.IsNullOrEmpty(record.Visitor?.PhotoUrl) ? null : (record.Visitor!.PhotoUrl.StartsWith("/api/entryexit/photos/") ? record.Visitor.PhotoUrl : $"/api/entryexit/photos/{record.Visitor.PhotoUrl}")),
            ContractorName = record.PersonType == PersonType.Labour
                ? record.Labour?.Contractor?.Name
                : null,
            ProjectName = record.PersonType == PersonType.Labour
                ? record.Labour?.Project?.Name
                : record.Visitor?.Project?.Name,
            CompanyName = record.PersonType == PersonType.Visitor
                ? record.Visitor?.CompanyName
                : null,
            Purpose = record.PersonType == PersonType.Visitor
                ? record.Visitor?.Purpose
                : null
        };
    }

    private LabourDto MapLabourToDto(Labour labour)
    {
        var photoUrl = string.IsNullOrEmpty(labour.PhotoUrl)
            ? null
            : ((labour.PhotoUrl?.StartsWith("/api/entryexit/photos/") ?? false) ? labour.PhotoUrl : $"/api/entryexit/photos/{labour.PhotoUrl}");

        return new LabourDto
        {
            Id = labour.Id,
            Name = labour.Name,
            PhoneNumber = labour.PhoneNumber,
            AadharNumber = !string.IsNullOrEmpty(labour.AadharNumberEncrypted)
                ? _encryption.Decrypt(labour.AadharNumberEncrypted)
                : null,
            PhotoUrl = photoUrl ?? string.Empty,
            ProjectId = labour.ProjectId,
            ProjectName = labour.Project?.Name ?? string.Empty,
            ContractorId = labour.ContractorId,
            ContractorName = labour.Contractor?.Name ?? string.Empty,
            Barcode = labour.Barcode,
            IsActive = labour.IsActive,
            RegisteredBy = labour.RegisteredBy,
            RegisteredAt = labour.RegisteredAt,
            CreatedAt = labour.CreatedAt,
            UpdatedAt = labour.UpdatedAt
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
            PhotoUrl = string.IsNullOrEmpty(visitor.PhotoUrl) ? string.Empty : (visitor.PhotoUrl.StartsWith("/api/entryexit/photos/") ? visitor.PhotoUrl : $"/api/entryexit/photos/{visitor.PhotoUrl}"),
            RegisteredBy = visitor.RegisteredBy,
            RegisteredAt = visitor.RegisteredAt
        };
    }
}
