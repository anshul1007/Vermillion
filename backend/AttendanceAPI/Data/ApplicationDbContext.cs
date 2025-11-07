using Microsoft.EntityFrameworkCore;
using AttendanceAPI.Models.Entities;

namespace AttendanceAPI.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Attendance> Attendance { get; set; }
        public DbSet<LeaveRequest> LeaveRequests { get; set; }
        public DbSet<LeaveEntitlement> LeaveEntitlements { get; set; }
        public DbSet<PublicHoliday> PublicHolidays { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<FeatureToggle> FeatureToggles { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Attendance configuration
            modelBuilder.Entity<Attendance>(entity =>
            {
                entity.HasIndex(e => new { e.UserId, e.Date });
                entity.HasIndex(e => e.Date);
                entity.HasIndex(e => e.Status);
            });

            // LeaveRequest configuration
            modelBuilder.Entity<LeaveRequest>(entity =>
            {
                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => new { e.StartDate, e.EndDate });
            });

            // LeaveEntitlement configuration
            modelBuilder.Entity<LeaveEntitlement>(entity =>
            {
                entity.HasIndex(e => e.UserId);
            });

            // PublicHoliday configuration
            modelBuilder.Entity<PublicHoliday>(entity =>
            {
                entity.HasIndex(e => e.Date).IsUnique();
                entity.HasIndex(e => e.Year);
            });

            // AuditLog configuration
            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.Timestamp);
                entity.HasIndex(e => new { e.EntityType, e.EntityId });
            });

            // FeatureToggle configuration
            modelBuilder.Entity<FeatureToggle>(entity =>
            {
                entity.HasIndex(e => e.FeatureKey).IsUnique();
                entity.HasIndex(e => e.IsEnabled);
            });
        }
    }
}
