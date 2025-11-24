using Vermillion.Shared.Domain.Data;
using Vermillion.Shared.Domain.Models.Entities;
using Microsoft.Extensions.Logging;

namespace Vermillion.Shared.Domain.Services;

public class SharedSeeder
{
    private readonly SharedDbContext _context;
    private readonly ILogger<SharedSeeder> _logger;

    public SharedSeeder(SharedDbContext context, ILogger<SharedSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        // Seed Sample Audit Logs (for demonstration)
        if (!_context.AuditLogs.Any())
        {
            var sampleAuditLogs = new List<AuditLog>
            {
                new AuditLog
                {
                    UserId = 1, // SystemAdmin
                    Action = "LOGIN",
                    EntityType = "User",
                    EntityId = "1",
                    OldValue = null,
                    NewValue = "{\"LoginTime\":\"" + DateTime.UtcNow.ToString("o") + "\",\"IpAddress\":\"127.0.0.1\"}",
                    Timestamp = DateTime.UtcNow.AddDays(-1),
                    IpAddress = "127.0.0.1"
                },
                new AuditLog
                {
                    UserId = 1, // SystemAdmin
                    Action = "CREATE",
                    EntityType = "Role",
                    EntityId = "5",
                    OldValue = null,
                    NewValue = "{\"Name\":\"Admin\",\"Description\":\"Human Resources with user management access\"}",
                    Timestamp = DateTime.UtcNow.AddDays(-1),
                    IpAddress = "127.0.0.1"
                },

                new AuditLog
                {
                    UserId = 3, // Manager Attendance
                    Action = "APPROVE",
                    EntityType = "LeaveRequest",
                    EntityId = Guid.NewGuid().ToString(),
                    OldValue = "{\"Status\":\"Pending\"}",
                    NewValue = "{\"Status\":\"Approved\",\"ApprovedBy\":3}",
                    Timestamp = DateTime.UtcNow.AddHours(-3),
                    IpAddress = "192.168.1.101"
                }
            };

            _context.AuditLogs.AddRange(sampleAuditLogs);
            await _context.SaveChangesAsync();
            Console.WriteLine($"✅ Seeded {sampleAuditLogs.Count} sample audit logs");
        }

        Console.WriteLine("\n✅ Shared infrastructure seeding completed!");
        Console.WriteLine("📊 Note: Audit logs will be created automatically for user actions");
    }
}
