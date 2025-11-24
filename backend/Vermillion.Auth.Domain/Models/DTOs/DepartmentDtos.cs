namespace Vermillion.Auth.Domain.Models.DTOs;

public record DepartmentDto(
    string Id,
    string? Name,
    string? Description,
    List<string>? WeeklyOffDays,
    bool IsActive
);
