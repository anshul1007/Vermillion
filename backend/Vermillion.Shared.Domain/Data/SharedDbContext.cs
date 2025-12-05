using Microsoft.EntityFrameworkCore;
using Vermillion.Shared.Domain.Models.Entities;

namespace Vermillion.Shared.Domain.Data;

public class SharedDbContext : DbContext
{
    public SharedDbContext(DbContextOptions<SharedDbContext> options) : base(options)
    {
    }

    public DbSet<AuditLog> AuditLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Set default schema for Shared infrastructure
        modelBuilder.HasDefaultSchema("shared");

        // AuditLog configuration
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs", "shared");
            entity.HasKey(e => e.Id)
                .HasName("PK_AuditLogs");
            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_AuditLogs_UserId");
            entity.HasIndex(e => e.Timestamp)
                .HasDatabaseName("IX_AuditLogs_Timestamp");
            entity.HasIndex(e => new { e.EntityType, e.EntityId })
                .HasDatabaseName("IX_AuditLogs_EntityType_EntityId");
        });
    }
}
