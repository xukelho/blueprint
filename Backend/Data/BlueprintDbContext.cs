using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Data;

public sealed class BlueprintDbContext(DbContextOptions<BlueprintDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Architect> Architects => Set<Architect>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureUserRoles(modelBuilder);
        ConfigureUsers(modelBuilder);
        ConfigureClients(modelBuilder);
        ConfigureCompanies(modelBuilder);
        ConfigureArchitects(modelBuilder);
    }

    private static void ConfigureUserRoles(ModelBuilder modelBuilder)
    {
        var role = modelBuilder.Entity<UserRole>();

        role.ToTable("user_roles");
        role.HasKey(candidate => candidate.Id);
        role.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        role.Property(candidate => candidate.Role)
            .HasColumnName("role")
            .HasMaxLength(64)
            .IsRequired();
        role.HasIndex(candidate => candidate.Role)
            .IsUnique();
        role.HasData(
            new UserRole { Id = UserRoleIds.PlatformAdmin, Role = "platform admin" },
            new UserRole { Id = UserRoleIds.Client, Role = "client" },
            new UserRole { Id = UserRoleIds.Company, Role = "company" },
            new UserRole { Id = UserRoleIds.Architect, Role = "architect" });
    }

    private static void ConfigureUsers(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();

        user.ToTable("users");
        user.HasKey(candidate => candidate.Id);
        user.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        user.Property(candidate => candidate.RoleId)
            .HasColumnName("role_id")
            .IsRequired();
        user.HasOne(candidate => candidate.Role)
            .WithMany(candidate => candidate.Users)
            .HasForeignKey(candidate => candidate.RoleId)
            .OnDelete(DeleteBehavior.Restrict);
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

    private static void ConfigureClients(ModelBuilder modelBuilder)
    {
        var client = modelBuilder.Entity<Client>();

        client.ToTable("clients");
        client.HasKey(candidate => candidate.Id);
        client.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        client.Property(candidate => candidate.UserId)
            .HasColumnName("user_id")
            .IsRequired();
        client.HasIndex(candidate => candidate.UserId)
            .IsUnique();
        client.HasOne(candidate => candidate.User)
            .WithOne(candidate => candidate.Client)
            .HasForeignKey<Client>(candidate => candidate.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        ConfigureClientProperties(client);
    }

    private static void ConfigureCompanies(ModelBuilder modelBuilder)
    {
        var company = modelBuilder.Entity<Company>();

        company.ToTable("companies");
        company.HasKey(candidate => candidate.Id);
        company.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        company.Property(candidate => candidate.UserId)
            .HasColumnName("user_id")
            .IsRequired();
        company.HasIndex(candidate => candidate.UserId)
            .IsUnique();
        company.HasOne(candidate => candidate.User)
            .WithOne(candidate => candidate.Company)
            .HasForeignKey<Company>(candidate => candidate.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        ConfigureCompanyProperties(company);
    }

    private static void ConfigureArchitects(ModelBuilder modelBuilder)
    {
        var architect = modelBuilder.Entity<Architect>();

        architect.ToTable("architects");
        architect.HasKey(candidate => candidate.Id);
        architect.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        architect.Property(candidate => candidate.UserId)
            .HasColumnName("user_id")
            .IsRequired();
        architect.HasIndex(candidate => candidate.UserId)
            .IsUnique();
        architect.HasOne(candidate => candidate.User)
            .WithOne(candidate => candidate.Architect)
            .HasForeignKey<Architect>(candidate => candidate.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        ConfigureArchitectProperties(architect);
    }

    private static void ConfigureClientProperties(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<Client> profile)
    {
        profile.Property(candidate => candidate.DisplayName)
            .HasColumnName("display_name").HasMaxLength(256).IsRequired();
        profile.Property(candidate => candidate.FullName)
            .HasColumnName("full_name").HasMaxLength(512).IsRequired();
        profile.Property(candidate => candidate.Nif)
            .HasColumnName("nif").HasMaxLength(32).IsRequired();
        profile.Property(candidate => candidate.Email)
            .HasColumnName("email").HasMaxLength(320).IsRequired();
        profile.Property(candidate => candidate.PhoneNumber)
            .HasColumnName("phone_number").HasMaxLength(64).IsRequired();
        profile.Property(candidate => candidate.Address)
            .HasColumnName("address").HasMaxLength(1024).IsRequired();
    }

    private static void ConfigureCompanyProperties(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<Company> profile)
    {
        profile.Property(candidate => candidate.DisplayName)
            .HasColumnName("display_name").HasMaxLength(256).IsRequired();
        profile.Property(candidate => candidate.FullName)
            .HasColumnName("full_name").HasMaxLength(512).IsRequired();
        profile.Property(candidate => candidate.Nif)
            .HasColumnName("nif").HasMaxLength(32).IsRequired();
        profile.Property(candidate => candidate.Email)
            .HasColumnName("email").HasMaxLength(320).IsRequired();
        profile.Property(candidate => candidate.PhoneNumber)
            .HasColumnName("phone_number").HasMaxLength(64).IsRequired();
        profile.Property(candidate => candidate.Address)
            .HasColumnName("address").HasMaxLength(1024).IsRequired();
    }

    private static void ConfigureArchitectProperties(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<Architect> profile)
    {
        profile.Property(candidate => candidate.DisplayName)
            .HasColumnName("display_name").HasMaxLength(256).IsRequired();
        profile.Property(candidate => candidate.FullName)
            .HasColumnName("full_name").HasMaxLength(512).IsRequired();
        profile.Property(candidate => candidate.Nif)
            .HasColumnName("nif").HasMaxLength(32).IsRequired();
        profile.Property(candidate => candidate.Email)
            .HasColumnName("email").HasMaxLength(320).IsRequired();
        profile.Property(candidate => candidate.PhoneNumber)
            .HasColumnName("phone_number").HasMaxLength(64).IsRequired();
        profile.Property(candidate => candidate.Address)
            .HasColumnName("address").HasMaxLength(1024).IsRequired();
    }
}
