using Vermillion.EntryExit.Domain.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Vermillion.EntryExit.Domain.Data;

public class EntryExitDbContext : DbContext
{
    public EntryExitDbContext(DbContextOptions<EntryExitDbContext> options) : base(options)
    {
    }

    public DbSet<Project> Projects { get; set; }
    public DbSet<Contractor> Contractors { get; set; }
    public DbSet<GuardProjectAssignment> GuardProjectAssignments { get; set; }
    public DbSet<Labour> Labours { get; set; }
    public DbSet<Visitor> Visitors { get; set; }
    public DbSet<EntryExitRecord> EntryExitRecords { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Set default schema for EntryExit domain
        modelBuilder.HasDefaultSchema("entryexit");

        // Project configuration
        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("Projects", "entryexit");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // Contractor configuration
        modelBuilder.Entity<Contractor>(entity =>
        {
            entity.ToTable("Contractors", "entryexit");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            entity.HasIndex(e => e.Name);
        });

        modelBuilder.Entity<Project>()
            .HasMany(p => p.Contractors)
            .WithMany(c => c.Projects)
            .UsingEntity<Dictionary<string, object>>(
                "ProjectContractors",
                j => j.HasOne<Contractor>()
                    .WithMany()
                    .HasForeignKey("ContractorId")
                    .OnDelete(DeleteBehavior.Cascade),
                j => j.HasOne<Project>()
                    .WithMany()
                    .HasForeignKey("ProjectId")
                    .OnDelete(DeleteBehavior.Cascade),
                j =>
                {
                    j.ToTable("ProjectContractors", "entryexit");
                    j.HasKey("ProjectId", "ContractorId");
                    j.Property<DateTime>("CreatedAt").HasDefaultValueSql("GETUTCDATE()");
                });

        // Labour configuration
        modelBuilder.Entity<Labour>(entity =>
        {
            entity.ToTable("Labours", "entryexit");
            entity.HasKey(e => e.Id);

            // Unique barcode per project
            entity.HasIndex(e => new { e.ProjectId, e.Barcode }).IsUnique();
            entity.HasIndex(e => e.PhoneNumber);
            entity.Property(e => e.RegisteredAt).HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Contractor)
                .WithMany()
                .HasForeignKey(e => e.ContractorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Visitor configuration
        modelBuilder.Entity<Visitor>(entity =>
        {
            entity.ToTable("Visitors", "entryexit");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.PhoneNumber);
            entity.HasIndex(e => e.ProjectId);
            entity.Property(e => e.RegisteredAt).HasDefaultValueSql("GETUTCDATE()");
            
            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // EntryExitRecord configuration
        modelBuilder.Entity<EntryExitRecord>(entity =>
        {
            entity.ToTable("EntryExitRecords", "entryexit",
                t => t.HasCheckConstraint("CK_EntryExitRecord_PersonType",
                    "(PersonType = 1 AND LabourId IS NOT NULL AND VisitorId IS NULL) OR " +
                    "(PersonType = 2 AND VisitorId IS NOT NULL AND LabourId IS NULL)"));

            entity.HasKey(e => e.Id);

            // Index for searching open sessions
            entity.HasIndex(e => new { e.LabourId, e.Action, e.Timestamp });
            entity.HasIndex(e => new { e.VisitorId, e.Action, e.Timestamp });
            entity.HasIndex(e => e.ClientId).IsUnique();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Labour)
                .WithMany(l => l.EntryExitRecords)
                .HasForeignKey(e => e.LabourId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Visitor)
                .WithMany(v => v.EntryExitRecords)
                .HasForeignKey(e => e.VisitorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // GuardProjectAssignment configuration
        modelBuilder.Entity<GuardProjectAssignment>(entity =>
        {
            entity.ToTable("GuardProjectAssignments", "entryexit");
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
