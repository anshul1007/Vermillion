using Microsoft.EntityFrameworkCore;

namespace Vermillion.Attendance.Domain.Data;

public class AttendanceDbContext : DbContext
{
    public AttendanceDbContext(DbContextOptions<AttendanceDbContext> options)
        : base(options)
    {
    }

    public DbSet<Models.Entities.Attendance> Attendances { get; set; }
    public DbSet<Models.Entities.LeaveRequest> LeaveRequests { get; set; }
    public DbSet<Models.Entities.LeaveEntitlement> LeaveEntitlements { get; set; }
    public DbSet<Models.Entities.PublicHoliday> PublicHolidays { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Set default schema for Attendance domain
        modelBuilder.HasDefaultSchema("attendance");

        // Attendance configuration
        modelBuilder.Entity<Models.Entities.Attendance>(entity =>
        {
            entity.ToTable("Attendance", "attendance");
            entity.HasIndex(e => new { e.UserId, e.Date });
            entity.HasIndex(e => e.Date);
            entity.HasIndex(e => e.Status);
        });

        // LeaveRequest configuration
        modelBuilder.Entity<Models.Entities.LeaveRequest>(entity =>
        {
            entity.ToTable("LeaveRequests", "attendance");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => new { e.StartDate, e.EndDate });
        });

        // LeaveEntitlement configuration
        modelBuilder.Entity<Models.Entities.LeaveEntitlement>(entity =>
        {
            entity.ToTable("LeaveEntitlements", "attendance");
            entity.HasIndex(e => e.UserId);
        });

        // PublicHoliday configuration
        modelBuilder.Entity<Models.Entities.PublicHoliday>(entity =>
        {
            entity.ToTable("PublicHolidays", "attendance");
            entity.HasIndex(e => e.Date).IsUnique();
            entity.HasIndex(e => e.Year);
        });
    }
}
