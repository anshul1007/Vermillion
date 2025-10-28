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

        public DbSet<User> Users { get; set; }
        public DbSet<Attendance> Attendance { get; set; }
        public DbSet<LeaveRequest> LeaveRequests { get; set; }
        public DbSet<LeaveEntitlement> LeaveEntitlements { get; set; }
        public DbSet<PublicHoliday> PublicHolidays { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<Department> Departments { get; set; }
        public DbSet<FeatureToggle> FeatureToggles { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(e => e.Email).IsUnique();
                entity.HasIndex(e => e.EmployeeId).IsUnique();
                entity.HasIndex(e => e.ManagerId);
                entity.HasIndex(e => e.DepartmentId);

                entity.HasOne(e => e.Manager)
                    .WithMany(e => e.Subordinates)
                    .HasForeignKey(e => e.ManagerId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // Attendance configuration
            modelBuilder.Entity<Attendance>(entity =>
            {
                entity.HasIndex(e => new { e.UserId, e.Date });
                entity.HasIndex(e => e.Date);
                entity.HasIndex(e => e.Status);

                entity.HasOne(e => e.User)
                    .WithMany(e => e.Attendances)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Approver)
                    .WithMany()
                    .HasForeignKey(e => e.ApprovedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // LeaveRequest configuration
            modelBuilder.Entity<LeaveRequest>(entity =>
            {
                entity.HasIndex(e => e.UserId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => new { e.StartDate, e.EndDate });

                entity.HasOne(e => e.User)
                    .WithMany(e => e.LeaveRequests)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.Approver)
                    .WithMany()
                    .HasForeignKey(e => e.ApprovedBy)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // LeaveEntitlement configuration
            modelBuilder.Entity<LeaveEntitlement>(entity =>
            {
                entity.HasIndex(e => new { e.UserId, e.Year }).IsUnique();

                entity.HasOne(e => e.User)
                    .WithMany(e => e.LeaveEntitlements)
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
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

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.SetNull);
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
