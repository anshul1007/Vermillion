namespace EntryExitAPI.Models.DTOs;

// Labour DTOs
public class LabourDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? AadharNumber { get; set; }
    public string? PhotoUrl { get; set; }
}

public class CreateLabourDto
{
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? AadharNumber { get; set; }
    public string? PhotoBase64 { get; set; }
}

// LabourRegistration DTOs
public class LabourRegistrationDto
{
    public int Id { get; set; }
    public LabourDto Labour { get; set; } = null!;
    public ProjectDto Project { get; set; } = null!;
    public ContractorDto Contractor { get; set; } = null!;
    public string Barcode { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string? RegisteredBy { get; set; }
    public DateTime RegisteredAt { get; set; }
}

public class CreateLabourRegistrationDto
{
    public int? LabourId { get; set; } // If existing labour
    public CreateLabourDto? Labour { get; set; } // If new labour
    public int ProjectId { get; set; }
    public int ContractorId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public string? PhotoBase64 { get; set; }
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
}

public class CreateVisitorDto
{
    public string Name { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? Purpose { get; set; }
    public string PhotoBase64 { get; set; } = string.Empty;
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
    public int ProjectId { get; set; }
    public bool IsActive { get; set; }
}

public class CreateContractorDto
{
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? PhoneNumber { get; set; }
    public int ProjectId { get; set; }
}

public class UpdateContractorDto
{
    public string? Name { get; set; }
    public string? ContactPerson { get; set; }
    public string? PhoneNumber { get; set; }
    public int? ProjectId { get; set; }
    public bool? IsActive { get; set; }
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
