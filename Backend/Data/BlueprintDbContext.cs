using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Data;

public sealed class BlueprintDbContext(DbContextOptions<BlueprintDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();

        user.ToTable("users");
        user.HasKey(candidate => candidate.Id);
        user.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        user.Property(candidate => candidate.Username)
            .HasColumnName("username")
            .HasMaxLength(256)
            .IsRequired();
        user.HasIndex(candidate => candidate.Username)
            .IsUnique();
        user.Property(candidate => candidate.Password)
            .HasColumnName("password")
            .HasMaxLength(512)
            .IsRequired();
        user.Property(candidate => candidate.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();
        user.Property(candidate => candidate.CreatedBy)
            .HasColumnName("created_by")
            .IsRequired();
        user.Property(candidate => candidate.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();
        user.Property(candidate => candidate.UpdatedBy)
            .HasColumnName("updated_by")
            .IsRequired();
    }
}
