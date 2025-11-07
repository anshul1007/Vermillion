using EntryExitAPI.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EntryExitAPI.Data;

public class EntryExitDbContext : DbContext
{
    public EntryExitDbContext(DbContextOptions<EntryExitDbContext> options) : base(options)
    {
    }

    public DbSet<Project> Projects { get; set; }
    public DbSet<Contractor> Contractors { get; set; }
    public DbSet<GuardProjectAssignment> GuardProjectAssignments { get; set; }
    public DbSet<Labour> Labours { get; set; }
    public DbSet<LabourRegistration> LabourRegistrations { get; set; }
    public DbSet<Visitor> Visitors { get; set; }
    public DbSet<EntryExitRecord> EntryExitRecords { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Project configuration
        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // Contractor configuration
        modelBuilder.Entity<Contractor>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.ProjectId, e.Name });
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Project)
                .WithMany(p => p.Contractors)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Labour configuration
        modelBuilder.Entity<Labour>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.PhoneNumber);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // LabourRegistration configuration
        modelBuilder.Entity<LabourRegistration>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Unique barcode per project
            entity.HasIndex(e => new { e.ProjectId, e.Barcode }).IsUnique();
            entity.HasIndex(e => e.LabourId);
            entity.Property(e => e.RegisteredAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Labour)
                .WithMany(l => l.Registrations)
                .HasForeignKey(e => e.LabourId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Project)
                .WithMany(p => p.LabourRegistrations)
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Contractor)
                .WithMany(c => c.LabourRegistrations)
                .HasForeignKey(e => e.ContractorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Visitor configuration
        modelBuilder.Entity<Visitor>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.PhoneNumber);
            entity.Property(e => e.RegisteredAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // EntryExitRecord configuration
        modelBuilder.Entity<EntryExitRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            
            // Index for searching open sessions
            entity.HasIndex(e => new { e.LabourRegistrationId, e.Action, e.Timestamp });
            entity.HasIndex(e => new { e.VisitorId, e.Action, e.Timestamp });
            entity.HasIndex(e => e.ClientId).IsUnique();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.LabourRegistration)
                .WithMany(lr => lr.EntryExitRecords)
                .HasForeignKey(e => e.LabourRegistrationId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Visitor)
                .WithMany(v => v.EntryExitRecords)
                .HasForeignKey(e => e.VisitorId)
                .OnDelete(DeleteBehavior.Restrict);

            // Check constraint: must have either LabourRegistrationId or VisitorId
            entity.ToTable(t => t.HasCheckConstraint("CK_EntryExitRecord_PersonType",
                "(PersonType = 1 AND LabourRegistrationId IS NOT NULL AND VisitorId IS NULL) OR " +
                "(PersonType = 2 AND VisitorId IS NOT NULL AND LabourRegistrationId IS NULL)"));
        });

        // GuardProjectAssignment configuration
        modelBuilder.Entity<GuardProjectAssignment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.AuthUserId, e.ProjectId }).IsUnique();
            entity.Property(e => e.AssignedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
