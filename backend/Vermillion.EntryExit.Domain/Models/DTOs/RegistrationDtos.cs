using System.ComponentModel.DataAnnotations;

namespace Vermillion.EntryExit.Domain.Models.DTOs;

public class LabourDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string AadharNumber { get; set; } = string.Empty; // Decrypted for display (admin only)
    public string? PanNumber { get; set; }
    public string Address { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;
    public int ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public int ContractorId { get; set; }
    public string ContractorName { get; set; } = string.Empty;
    public int ClassificationId { get; set; }
    public string ClassificationName { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? RegisteredBy { get; set; }
    public DateTime RegisteredAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateLabourDto
{
    [Required(ErrorMessage = "Name is required")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 100 characters")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required")]
    [Phone(ErrorMessage = "Invalid phone number format")]
    [StringLength(10, MinimumLength = 10, ErrorMessage = "Phone number must be exactly 10 characters")]
    [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must contain only digits")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Aadhar number is required")]
    [StringLength(12, MinimumLength = 12, ErrorMessage = "Aadhar number must be exactly 12 digits")]
    [RegularExpression(@"^\d{12}$", ErrorMessage = "Aadhar number must contain only digits")]
    public string AadharNumber { get; set; } = string.Empty; // Will be encrypted before saving

    // Photo can be provided either as base64 (PhotoBase64) or as an already-uploaded server path (PhotoPath).
    public string? PhotoBase64 { get; set; }
    public string? PhotoPath { get; set; }

    [Required(ErrorMessage = "Project ID is required")]
    [Range(1, int.MaxValue, ErrorMessage = "Invalid project ID")]
    public int ProjectId { get; set; }

    [Required(ErrorMessage = "Contractor ID is required")]
    [Range(1, int.MaxValue, ErrorMessage = "Invalid contractor ID")]
    public int ContractorId { get; set; }

    [Required(ErrorMessage = "ClassificationId is required")]
    [Range(1, int.MaxValue, ErrorMessage = "Invalid classification ID")]
    public int ClassificationId { get; set; }

    public string Barcode { get; set; } = string.Empty;

    [StringLength(10, MinimumLength = 10, ErrorMessage = "PAN number must be exactly 10 characters")]
    [RegularExpression(@"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", ErrorMessage = "Invalid PAN number format")]
    public string? PanNumber { get; set; }

    [Required(ErrorMessage = "Address is required")]
    public string Address { get; set; } = string.Empty;
}


// Visitor DTOs
public class VisitorDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? Purpose { get; set; }
    public string PhotoUrl { get; set; } = string.Empty;
    public string? RegisteredBy { get; set; }
    public DateTime RegisteredAt { get; set; }
    public int ProjectId { get; set; }
    public string? ProjectName { get; set; }
}

public class CreateVisitorDto
{
    public string Name { get; set; } = string.Empty;
    [Required(ErrorMessage = "Phone number is required")]
    [Phone(ErrorMessage = "Invalid phone number format")]
    [StringLength(10, MinimumLength = 10, ErrorMessage = "Phone number must be exactly 10 characters")]
    [RegularExpression(@"^\d{10}$", ErrorMessage = "Phone number must contain only digits")]
    public string PhoneNumber { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? Purpose { get; set; }
    public string PhotoBase64 { get; set; } = string.Empty;  // Accepted in requests, converted to PhotoUrl
    public string? PhotoPath { get; set; }
    public int ProjectId { get; set; }
}

// Project & Contractor DTOs
public class ProjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateProjectDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateProjectDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
}

public class ContractorDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? PhoneNumber { get; set; }
    public List<int> ProjectIds { get; set; } = new();
    public List<ProjectSummaryDto> Projects { get; set; } = new();
    public bool IsActive { get; set; }
}

public class CreateContractorDto
{
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? PhoneNumber { get; set; }
    public List<int> ProjectIds { get; set; } = new();
}

public class UpdateContractorDto
{
    public string? Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? PhoneNumber { get; set; }
    public List<int>? ProjectIds { get; set; }
    public bool? IsActive { get; set; }
}

public class ProjectSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

// Guard Project Assignment DTOs
public class GuardDto
{
    public int AuthUserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; }
    public List<GuardProjectInfo>? AssignedProjects { get; set; }
}

public class GuardProjectInfo
{
    public int ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime AssignedAt { get; set; }
}

public class AssignGuardToProjectDto
{
    public int AuthUserId { get; set; }
    public int ProjectId { get; set; }
}

public class UnassignGuardFromProjectDto
{
    public int AuthUserId { get; set; }
    public int ProjectId { get; set; }
}
