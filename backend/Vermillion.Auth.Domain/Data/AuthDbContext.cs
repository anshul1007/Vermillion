using Microsoft.EntityFrameworkCore;
using Vermillion.Auth.Domain.Models.Entities;

namespace Vermillion.Auth.Domain.Data;

public class AuthDbContext : DbContext
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options) { }

    public DbSet<Tenant> Tenants { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<UserRole> UserRoles { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }

    // Organizational data
    public DbSet<Employee> Employees { get; set; }
    public DbSet<Department> Departments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Set default schema for Auth domain
        modelBuilder.HasDefaultSchema("auth");

        // Tenant configuration
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.ToTable("Tenants", "auth");
            entity.HasKey(t => t.Id)
                .HasName("PK_Tenants");
            entity.HasIndex(t => t.Domain).IsUnique()
                .HasDatabaseName("IX_Tenants_Domain");
            entity.Property(t => t.Name).IsRequired().HasMaxLength(100);
            entity.Property(t => t.Domain).IsRequired().HasMaxLength(50);
        });

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users", "auth");
            entity.HasKey(u => u.Id)
                .HasName("PK_Users");
            entity.HasIndex(u => u.Username).IsUnique() // Username is globally unique
                .HasDatabaseName("IX_Users_Username");
            entity.HasIndex(u => u.Email).IsUnique() // Email is globally unique
                .HasDatabaseName("IX_Users_Email");
            entity.Property(u => u.Username).IsRequired().HasMaxLength(100);
            entity.Property(u => u.Email).IsRequired().HasMaxLength(255);
        });

        // Role configuration
        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles", "auth");
            entity.HasKey(r => r.Id)
                .HasName("PK_Roles");
            entity.HasIndex(r => r.Name).IsUnique()
                .HasDatabaseName("IX_Roles_Name");
            entity.Property(r => r.Name).IsRequired().HasMaxLength(50);
            entity.Property(r => r.Description).HasMaxLength(200);
        });

        // Permission configuration
        modelBuilder.Entity<Permission>(entity =>
        {
            entity.ToTable("Permissions", "auth");
            entity.HasKey(p => p.Id)
                .HasName("PK_Permissions");
            entity.HasIndex(p => p.Name).IsUnique()
                .HasDatabaseName("IX_Permissions_Name");
            entity.Property(p => p.Name).IsRequired().HasMaxLength(100);
            entity.Property(p => p.Resource).IsRequired().HasMaxLength(50);
            entity.Property(p => p.Action).IsRequired().HasMaxLength(50);
            entity.Property(p => p.Description).HasMaxLength(200);
        });

        // UserRole (Junction table) configuration
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("UserRoles", "auth");
            entity.HasKey(ur => ur.Id)
                .HasName("PK_UserRoles");
            entity.HasIndex(ur => new { ur.UserId, ur.RoleId, ur.TenantId }).IsUnique()
                .HasDatabaseName("IX_UserRoles_UserId_RoleId_TenantId"); 
            // User can have a role in a tenant only once
            
            entity.HasOne(ur => ur.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(ur => ur.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_UserRoles_Users_UserId");
            
            entity.HasOne(ur => ur.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(ur => ur.RoleId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_UserRoles_Roles_RoleId");
            
            entity.HasOne(ur => ur.Tenant)
                .WithMany(t => t.UserRoles)
                .HasForeignKey(ur => ur.TenantId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_UserRoles_Tenants_TenantId");
        });

        // RolePermission (Junction table) configuration
        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.ToTable("RolePermissions", "auth");
            entity.HasKey(rp => rp.Id)
                .HasName("PK_RolePermissions");
            entity.HasIndex(rp => new { rp.RoleId, rp.PermissionId }).IsUnique()
                .HasDatabaseName("IX_RolePermissions_RoleId_PermissionId");
            // Role can have a permission only once
            
            entity.HasOne(rp => rp.Role)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(rp => rp.RoleId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RolePermissions_Roles_RoleId");
            
            entity.HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RolePermissions_Permissions_PermissionId");
        });

        // RefreshToken configuration
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshTokens", "auth");
            entity.HasKey(rt => rt.Id)
                .HasName("PK_RefreshTokens");
            entity.HasIndex(rt => rt.Token).IsUnique()
                .HasDatabaseName("IX_RefreshTokens_Token");
            entity.Property(rt => rt.Token).IsRequired();
            
            entity.HasOne(rt => rt.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(rt => rt.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_RefreshTokens_Users_UserId");
        });

        // Department configuration
        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("Departments", "auth");
            entity.HasKey(d => d.Id)
                .HasName("PK_Departments");
            entity.HasIndex(d => d.Name)
                .HasDatabaseName("IX_Departments_Name");
            entity.HasIndex(d => d.IsActive)
                .HasDatabaseName("IX_Departments_IsActive");
            entity.Property(d => d.Name).IsRequired().HasMaxLength(100);
            entity.Property(d => d.Description).HasMaxLength(500);
        });

        // Employee configuration
        modelBuilder.Entity<Employee>(entity =>
        {
            entity.ToTable("Employees", "auth");
            entity.HasKey(e => e.Id)
                .HasName("PK_Employees");
            entity.HasIndex(e => e.UserId).IsUnique() // One employee record per user
                .HasDatabaseName("IX_Employees_UserId");
            entity.HasIndex(e => e.EmployeeId).IsUnique()
                .HasDatabaseName("IX_Employees_EmployeeId");
            entity.Property(e => e.EmployeeId).IsRequired().HasMaxLength(50);

            // Relationship to User
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_Users_UserId");

            // Relationship to Department
            entity.HasOne(e => e.Department)
                .WithMany(d => d.Employees)
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_Departments_DepartmentId");

            // Self-referencing relationship for Manager
            entity.HasOne(e => e.Manager)
                .WithMany(m => m.Subordinates)
                .HasForeignKey(e => e.ManagerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_Employees_Employees_ManagerId");
        });
    }
}
