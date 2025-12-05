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
    public DbSet<LabourClassification> LabourClassifications { get; set; }
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
            entity.HasKey(e => e.Id)
                .HasName("PK_Projects");
            entity.HasIndex(e => e.Name).IsUnique()
                .HasDatabaseName("IX_Projects_Name");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // Contractor configuration
        modelBuilder.Entity<Contractor>(entity =>
        {
            entity.ToTable("Contractors", "entryexit");
            entity.HasKey(e => e.Id)
                .HasName("PK_Contractors");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            entity.HasIndex(e => e.Name)
                .HasDatabaseName("IX_Contractors_Name");
        });

        modelBuilder.Entity<Project>()
            .HasMany(p => p.Contractors)
            .WithMany(c => c.Projects)
            .UsingEntity<Dictionary<string, object>>(
                "ProjectContractors",
                j => j.HasOne<Contractor>()
                    .WithMany()
                    .HasForeignKey("ContractorId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_ProjectContractors_Contractors_ContractorId"),
                j => j.HasOne<Project>()
                    .WithMany()
                    .HasForeignKey("ProjectId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_ProjectContractors_Projects_ProjectId"),
                j =>
                {
                    j.ToTable("ProjectContractors", "entryexit");
                    j.HasKey("ProjectId", "ContractorId")
                     .HasName("PK_ProjectContractors");
                    j.Property<DateTime>("CreatedAt").HasDefaultValueSql("GETUTCDATE()");
                });

        // Labour configuration
        modelBuilder.Entity<Labour>(entity =>
        {
            entity.ToTable("Labours", "entryexit");
            entity.HasKey(e => e.Id)
                .HasName("PK_Labours");

            // Unique barcode per project
            entity.HasIndex(e => new { e.ProjectId, e.Barcode }).IsUnique()
                .HasDatabaseName("IX_Labours_ProjectId_Barcode");
            entity.HasIndex(e => e.PhoneNumber)
                .HasDatabaseName("IX_Labours_PhoneNumber");
            entity.Property(e => e.RegisteredAt).HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Labours_Projects_ProjectId");

            entity.HasOne(e => e.Contractor)
                .WithMany()
                .HasForeignKey(e => e.ContractorId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Labours_Contractors_ContractorId");

            entity.HasOne(e => e.Classification)
                .WithMany(c => c.Labours!)
                .HasForeignKey(e => e.ClassificationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Labours_LabourClassifications_ClassificationId");
        });

        // Visitor configuration
        modelBuilder.Entity<Visitor>(entity =>
        {
            entity.ToTable("Visitors", "entryexit");
            entity.HasKey(e => e.Id)
                .HasName("PK_Visitors");
            entity.HasIndex(e => e.PhoneNumber)
                .HasDatabaseName("IX_Visitors_PhoneNumber");
            entity.HasIndex(e => e.ProjectId)
                .HasDatabaseName("IX_Visitors_ProjectId");
            entity.Property(e => e.RegisteredAt).HasDefaultValueSql("GETUTCDATE()");
            
            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Visitors_Projects_ProjectId");
        });

        // Labour classification lookup
        modelBuilder.Entity<LabourClassification>(entity =>
        {
            entity.ToTable("LabourClassifications", "entryexit");
            entity.HasKey(e => e.Id)
                .HasName("PK_LabourClassifications");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            entity.HasIndex(e => e.Name).IsUnique()
                .HasDatabaseName("IX_LabourClassifications_Name");
        });

        // EntryExitRecord configuration
        modelBuilder.Entity<EntryExitRecord>(entity =>
        {
            entity.ToTable("EntryExitRecords", "entryexit",
                t => t.HasCheckConstraint("CK_EntryExitRecord_PersonType",
                    "(PersonType = 1 AND LabourId IS NOT NULL AND VisitorId IS NULL) OR " +
                    "(PersonType = 2 AND VisitorId IS NOT NULL AND LabourId IS NULL)"));

            entity.HasKey(e => e.Id)
                .HasName("PK_EntryExitRecords");

            // Index for searching open sessions
            entity.HasIndex(e => new { e.LabourId, e.Action, e.Timestamp })
                .HasDatabaseName("IX_EntryExitRecords_LabourId_Action_Timestamp");
            entity.HasIndex(e => new { e.VisitorId, e.Action, e.Timestamp })
                .HasDatabaseName("IX_EntryExitRecords_VisitorId_Action_Timestamp");
            entity.HasIndex(e => e.ClientId).IsUnique()
                .HasDatabaseName("IX_EntryExitRecords_ClientId");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Labour)
                .WithMany(l => l.EntryExitRecords)
                .HasForeignKey(e => e.LabourId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_EntryExitRecords_Labours_LabourId");

            entity.HasOne(e => e.Visitor)
                .WithMany(v => v.EntryExitRecords)
                .HasForeignKey(e => e.VisitorId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_EntryExitRecords_Visitors_VisitorId");
        });

        // GuardProjectAssignment configuration
        modelBuilder.Entity<GuardProjectAssignment>(entity =>
        {
            entity.ToTable("GuardProjectAssignments", "entryexit");
            entity.HasKey(e => e.Id)
                .HasName("PK_GuardProjectAssignments");
            entity.HasIndex(e => new { e.AuthUserId, e.ProjectId }).IsUnique()
                .HasDatabaseName("IX_GuardProjectAssignments_AuthUserId_ProjectId");
            entity.Property(e => e.AssignedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(e => e.Project)
                .WithMany()
                .HasForeignKey(e => e.ProjectId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_GuardProjectAssignments_Projects_ProjectId");
        });
    }
}
