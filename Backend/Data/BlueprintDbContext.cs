using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Blueprint.Api.Data;

public sealed class BlueprintDbContext(DbContextOptions<BlueprintDbContext> options)
    : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<CompanyEmployee> CompanyEmployees => Set<CompanyEmployee>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureRoles(modelBuilder);
        ConfigureUsers(modelBuilder);
        ConfigureUserRoles(modelBuilder);
        ConfigureCompanies(modelBuilder);
        ConfigureEmployees(modelBuilder);
        ConfigureCompanyEmployees(modelBuilder);
        ConfigureClients(modelBuilder);
    }

    private static void ConfigureRoles(ModelBuilder modelBuilder)
    {
        var role = modelBuilder.Entity<Role>();

        role.ToTable("roles");
        role.HasKey(candidate => candidate.Id);
        role.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        role.Property(candidate => candidate.Name)
            .HasColumnName("name")
            .HasMaxLength(64)
            .IsRequired();
        role.HasIndex(candidate => candidate.Name)
            .IsUnique();
        role.HasData(
            new Role { Id = RoleIds.PlatformAdmin, Name = "platform admin" },
            new Role { Id = RoleIds.Client, Name = "client" },
            new Role { Id = RoleIds.Employee, Name = "employee" },
            new Role { Id = RoleIds.Architect, Name = "architect" },
            new Role { Id = RoleIds.CompanyOwner, Name = "company owner" });
    }

    private static void ConfigureUsers(ModelBuilder modelBuilder)
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
        user.Property(candidate => candidate.IsActive).HasColumnName("is_active").HasDefaultValue(true).IsRequired();
        user.Property(candidate => candidate.DeactivatedAt).HasColumnName("deactivated_at").HasColumnType("timestamp with time zone");
        user.Property(candidate => candidate.DeactivatedBy).HasColumnName("deactivated_by");
    }

    private static void ConfigureUserRoles(ModelBuilder modelBuilder)
    {
        var userRole = modelBuilder.Entity<UserRole>();

        userRole.ToTable("user_roles");
        userRole.HasKey(candidate => new { candidate.UserId, candidate.RoleId });
        userRole.Property(candidate => candidate.UserId)
            .HasColumnName("user_id");
        userRole.Property(candidate => candidate.RoleId)
            .HasColumnName("role_id");
        userRole.HasOne(candidate => candidate.User)
            .WithMany(candidate => candidate.UserRoles)
            .HasForeignKey(candidate => candidate.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        userRole.HasOne(candidate => candidate.Role)
            .WithMany(candidate => candidate.UserRoles)
            .HasForeignKey(candidate => candidate.RoleId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureCompanies(ModelBuilder modelBuilder)
    {
        var company = modelBuilder.Entity<Company>();

        company.ToTable("companies");
        company.HasKey(candidate => candidate.Id);
        company.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        company.Property(candidate => candidate.Name)
            .HasColumnName("name")
            .HasMaxLength(256)
            .IsRequired();
        company.Property(candidate => candidate.LegalName)
            .HasColumnName("legal_name")
            .HasMaxLength(512)
            .IsRequired();
        ConfigureContactProperties(company);
        company.Property(candidate => candidate.Website)
            .HasColumnName("website")
            .HasMaxLength(2048);
        company.Property(candidate => candidate.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true)
            .IsRequired();
        company.Property(candidate => candidate.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();
        company.Property(candidate => candidate.CreatedBy)
            .HasColumnName("created_by")
            .IsRequired();
        company.Property(candidate => candidate.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();
        company.Property(candidate => candidate.UpdatedBy)
            .HasColumnName("updated_by")
            .IsRequired();
    }

    private static void ConfigureEmployees(ModelBuilder modelBuilder)
    {
        var employee = modelBuilder.Entity<Employee>();

        employee.ToTable("employees");
        employee.HasKey(candidate => candidate.Id);
        employee.Property(candidate => candidate.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        employee.Property(candidate => candidate.UserId)
            .HasColumnName("user_id")
            .IsRequired();
        employee.HasIndex(candidate => candidate.UserId)
            .IsUnique();
        employee.HasOne(candidate => candidate.User)
            .WithOne(candidate => candidate.Employee)
            .HasForeignKey<Employee>(candidate => candidate.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        ConfigureEmployeeProfileProperties(employee);
    }

    private static void ConfigureCompanyEmployees(ModelBuilder modelBuilder)
    {
        var membership = modelBuilder.Entity<CompanyEmployee>();
        membership.ToTable("company_employees");
        membership.HasKey(candidate => new { candidate.CompanyId, candidate.EmployeeId });
        membership.Property(candidate => candidate.CompanyId).HasColumnName("company_id");
        membership.Property(candidate => candidate.EmployeeId).HasColumnName("employee_id");
        membership.HasIndex(candidate => candidate.EmployeeId).IsUnique();
        membership.Property(candidate => candidate.CompanyRole).HasColumnName("company_role").HasMaxLength(16).IsRequired();
        membership.Property(candidate => candidate.IsArchitect).HasColumnName("is_architect").HasDefaultValue(false).IsRequired();
        membership.HasOne(candidate => candidate.Company).WithMany(candidate => candidate.CompanyEmployees)
            .HasForeignKey(candidate => candidate.CompanyId).OnDelete(DeleteBehavior.Restrict);
        membership.HasOne(candidate => candidate.Employee).WithOne(candidate => candidate.CompanyEmployee)
            .HasForeignKey<CompanyEmployee>(candidate => candidate.EmployeeId).OnDelete(DeleteBehavior.Cascade);
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
        client.Property(candidate => candidate.CompanyId)
            .HasColumnName("company_id");
        client.HasOne(candidate => candidate.Company)
            .WithMany(candidate => candidate.Clients)
            .HasForeignKey(candidate => candidate.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);
        ConfigureProfileProperties(client);
    }

    private static void ConfigureProfileProperties<TProfile>(
        EntityTypeBuilder<TProfile> profile)
        where TProfile : class
    {
        profile.Property<string>(nameof(Client.DisplayName))
            .HasColumnName("display_name").HasMaxLength(256).IsRequired();
        profile.Property<string>(nameof(Client.FullName))
            .HasColumnName("full_name").HasMaxLength(512).IsRequired();
        ConfigureContactProperties(profile);
    }

    private static void ConfigureEmployeeProfileProperties(EntityTypeBuilder<Employee> profile)
    {
        profile.Property(candidate => candidate.DisplayName).HasColumnName("display_name").HasMaxLength(256).IsRequired();
        profile.Property(candidate => candidate.FullName).HasColumnName("full_name").HasMaxLength(512).IsRequired();
        profile.Property(candidate => candidate.Nif).HasColumnName("nif").HasMaxLength(32);
        profile.Property(candidate => candidate.Email).HasColumnName("email").HasMaxLength(320);
        profile.Property(candidate => candidate.PhoneNumber).HasColumnName("phone_number").HasMaxLength(64);
        profile.Property(candidate => candidate.Address).HasColumnName("address").HasMaxLength(1024);
    }

    private static void ConfigureContactProperties<TEntity>(
        EntityTypeBuilder<TEntity> entity)
        where TEntity : class
    {
        entity.Property<string>(nameof(Client.Nif))
            .HasColumnName("nif").HasMaxLength(32).IsRequired();
        entity.Property<string>(nameof(Client.Email))
            .HasColumnName("email").HasMaxLength(320).IsRequired();
        entity.Property<string>(nameof(Client.PhoneNumber))
            .HasColumnName("phone_number").HasMaxLength(64).IsRequired();
        entity.Property<string>(nameof(Client.Address))
            .HasColumnName("address").HasMaxLength(1024).IsRequired();
    }
}
