using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.Entities;
using Microsoft.Extensions.Logging;

namespace Vermillion.EntryExit.Domain.Services;

public class EntryExitSeeder
{
    private readonly EntryExitDbContext _context;
    private readonly ILogger<EntryExitSeeder> _logger;

    public EntryExitSeeder(EntryExitDbContext context, ILogger<EntryExitSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        // Seed Projects
        if (!_context.Projects.Any())
        {
            var projects = new List<Project>
            {
                new Project 
                { 
                    Name = "Construction Site A",
                    Description = "Main construction site at location A",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Project 
                { 
                    Name = "Construction Site B",
                    Description = "Secondary construction site at location B",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Project 
                { 
                    Name = "Warehouse Project",
                    Description = "Warehouse construction and management",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                }
            };

            _context.Projects.AddRange(projects);
            await _context.SaveChangesAsync();
            Console.WriteLine($"✅ Seeded {projects.Count} projects");
        }

        // Seed Contractors
        if (!_context.Contractors.Any())
        {
            var siteA = _context.Projects.First(p => p.Name == "Construction Site A");
            var siteB = _context.Projects.First(p => p.Name == "Construction Site B");
            var warehouse = _context.Projects.First(p => p.Name == "Warehouse Project");

            var contractors = new List<Contractor>
            {
                new Contractor
                {
                    Name = "ABC Construction Co.",
                    ContactPerson = "Rajesh Kumar",
                    PhoneNumber = "9876543210",
                    Projects = new List<Project> { siteA, warehouse },
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Contractor
                {
                    Name = "XYZ Builders",
                    ContactPerson = "Amit Shah",
                    PhoneNumber = "9876543211",
                    Projects = new List<Project> { siteA },
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Contractor
                {
                    Name = "DEF Infrastructure",
                    ContactPerson = "Suresh Patel",
                    PhoneNumber = "9876543212",
                    Projects = new List<Project> { siteB },
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Contractor
                {
                    Name = "PQR Logistics",
                    ContactPerson = "Ramesh Gupta",
                    PhoneNumber = "9876543213",
                    Projects = new List<Project> { warehouse },
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                }
            };

            _context.Contractors.AddRange(contractors);
            await _context.SaveChangesAsync();
            Console.WriteLine($"✅ Seeded {contractors.Count} contractors");
        }

        Console.WriteLine("\n✅ Entry/Exit system seeding completed!");
        Console.WriteLine("\n📋 Entry/Exit Data:");
        Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        Console.WriteLine("Projects:");
        Console.WriteLine("  - Construction Site A");
        Console.WriteLine("  - Construction Site B");
        Console.WriteLine("  - Warehouse Project");
        Console.WriteLine("\nContractors:");
        Console.WriteLine("  - ABC Construction Co. (Site A)");
        Console.WriteLine("  - XYZ Builders (Site A)");
        Console.WriteLine("  - DEF Infrastructure (Site B)");
        Console.WriteLine("  - PQR Logistics (Warehouse)");
        Console.WriteLine("\nNote: Assign security guards to projects via UI");
        Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}
