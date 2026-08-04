using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Validation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class AdministrationEndpoints
{
    private const int MaximumPasswordLength = 1024;

    public static IEndpointRouteBuilder MapAdministrationEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var administration = endpoints.MapGroup("/api/admin")
            .WithTags("Administration");

        MapRoleEndpoints(administration);
        MapUserEndpoints(administration);
        MapEmployeeEndpoints(administration);
        MapClientEndpoints(administration);
        MapCompanyEndpoints(administration);

        return endpoints;
    }

    private static void MapRoleEndpoints(RouteGroupBuilder administration)
    {
        administration.MapGet("/roles", GetRoles)
            .WithName("GetAdministrationRoles")
            .Produces<IReadOnlyList<RoleResponse>>();
    }

    private static void MapUserEndpoints(RouteGroupBuilder administration)
    {
        var users = administration.MapGroup("/users");

        users.MapGet("/", GetUsers)
            .WithName("GetAdministrationUsers")
            .Produces<IReadOnlyList<UserResponse>>();
        users.MapGet("/{id:long}", GetUser)
            .WithName("GetAdministrationUser")
            .Produces<UserResponse>()
            .Produces(StatusCodes.Status404NotFound);
        users.MapPost("/", CreateUser)
            .WithName("CreateAdministrationUser")
            .Accepts<CreateUserRequest>("application/json")
            .Produces<UserResponse>(StatusCodes.Status201Created)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        users.MapPut("/{id:long}", UpdateUser)
            .WithName("UpdateAdministrationUser")
            .Accepts<UpdateUserRequest>("application/json")
            .Produces<UserResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        users.MapDelete("/{id:long}", DeleteUser)
            .WithName("DeleteAdministrationUser")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static void MapEmployeeEndpoints(RouteGroupBuilder administration)
    {
        var employees = administration.MapGroup("/employees");

        employees.MapGet("/", GetEmployees)
            .WithName("GetAdministrationEmployees")
            .Produces<IReadOnlyList<EmployeeResponse>>();
        employees.MapGet("/{id:long}", GetEmployee)
            .WithName("GetAdministrationEmployee")
            .Produces<EmployeeResponse>()
            .Produces(StatusCodes.Status404NotFound);
        employees.MapPost("/", CreateEmployee)
            .WithName("CreateAdministrationEmployee")
            .Accepts<CreateEmployeeRequest>("application/json")
            .Produces<EmployeeResponse>(StatusCodes.Status201Created)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        employees.MapPut("/{id:long}", UpdateEmployee)
            .WithName("UpdateAdministrationEmployee")
            .Accepts<UpdateEmployeeRequest>("application/json")
            .Produces<EmployeeResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        employees.MapDelete("/{id:long}", DeleteEmployee)
            .WithName("DeleteAdministrationEmployee")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static void MapClientEndpoints(RouteGroupBuilder administration)
    {
        var clients = administration.MapGroup("/clients");

        clients.MapGet("/", GetClients)
            .WithName("GetAdministrationClients")
            .Produces<IReadOnlyList<ClientResponse>>();
        clients.MapGet("/{id:long}", GetClient)
            .WithName("GetAdministrationClient")
            .Produces<ClientResponse>()
            .Produces(StatusCodes.Status404NotFound);
        clients.MapPost("/", CreateClient)
            .WithName("CreateAdministrationClient")
            .Accepts<CreateClientRequest>("application/json")
            .Produces<ClientResponse>(StatusCodes.Status201Created)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        clients.MapPut("/{id:long}", UpdateClient)
            .WithName("UpdateAdministrationClient")
            .Accepts<UpdateClientRequest>("application/json")
            .Produces<ClientResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        clients.MapDelete("/{id:long}", DeleteClient)
            .WithName("DeleteAdministrationClient")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static void MapCompanyEndpoints(RouteGroupBuilder administration)
    {
        var companies = administration.MapGroup("/companies");

        companies.MapGet("/", GetCompanies)
            .WithName("GetAdministrationCompanies")
            .Produces<IReadOnlyList<CompanyResponse>>();
        companies.MapGet("/{id:long}", GetCompany)
            .WithName("GetAdministrationCompany")
            .Produces<CompanyResponse>()
            .Produces(StatusCodes.Status404NotFound);
        companies.MapPost("/", CreateCompany)
            .WithName("CreateAdministrationCompany")
            .Accepts<CreateCompanyRequest>("application/json")
            .Produces<CompanyResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem();
        companies.MapPut("/{id:long}", UpdateCompany)
            .WithName("UpdateAdministrationCompany")
            .Accepts<UpdateCompanyRequest>("application/json")
            .Produces<CompanyResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        companies.MapDelete("/{id:long}", DeleteCompany)
            .WithName("DeleteAdministrationCompany")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> GetRoles(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var roles = await dbContext.Roles
            .AsNoTracking()
            .OrderBy(candidate => candidate.Id)
            .Select(candidate => new RoleResponse(candidate.Id, candidate.Name))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(roles);
    }

    private static async Task<IResult> GetUsers(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var users = await UserQuery(dbContext)
            .OrderBy(candidate => candidate.Id)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(users.Select(ToResponse).ToArray());
    }

    private static async Task<IResult> GetUser(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var user = await UserQuery(dbContext)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        return user is null ? TypedResults.NotFound() : TypedResults.Ok(ToResponse(user));
    }

    private static async Task<IResult> CreateUser(
        CreateUserRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCredentials(request?.Username, request?.Password, true);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var validRequest = request!;
        var normalizedUsername = validRequest.Username.Trim();
        if (await UsernameExists(normalizedUsername, null, dbContext, cancellationToken))
        {
            return Conflict("A user with this username already exists.");
        }

        var user = NewUser(normalizedUsername, validRequest.Password);
        user.UserRoles.Add(new UserRole { RoleId = RoleIds.PlatformAdmin });
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        await LoadUserRoles(user, dbContext, cancellationToken);

        return TypedResults.Created($"/api/admin/users/{user.Id}", ToResponse(user));
    }

    private static async Task<IResult> UpdateUser(
        long id,
        UpdateUserRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCredentials(request?.Username, request?.Password, false);
        ValidateRoleIds(request?.RoleIds, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var user = await dbContext.Users
            .Include(candidate => candidate.UserRoles)
            .Include(candidate => candidate.Employee)
            .Include(candidate => candidate.Client)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        var roleIds = request!.RoleIds.Distinct().Order().ToArray();
        if (!RolesMatchProfile(user, roleIds))
        {
            return Conflict("The selected roles do not match the user's account category.");
        }

        var normalizedUsername = request.Username.Trim();
        if (await UsernameExists(normalizedUsername, id, dbContext, cancellationToken))
        {
            return Conflict("A user with this username already exists.");
        }

        var removedRoles = user.UserRoles
            .Where(candidate => !roleIds.Contains(candidate.RoleId))
            .ToArray();
        foreach (var removedRole in removedRoles)
        {
            user.UserRoles.Remove(removedRole);
            dbContext.UserRoles.Remove(removedRole);
        }
        foreach (var roleId in roleIds.Where(
                     roleId => user.UserRoles.All(
                         candidate => candidate.RoleId != roleId)))
        {
            user.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                RoleId = roleId
            });
        }
        user.Username = normalizedUsername;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = AuditActors.System;
        if (!string.IsNullOrEmpty(request.Password))
        {
            user.Password = new PasswordHasher<User>().HashPassword(user, request.Password);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await LoadUserRoles(user, dbContext, cancellationToken);
        return TypedResults.Ok(ToResponse(user));
    }

    private static async Task<IResult> DeleteUser(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FindAsync([id], cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> GetEmployees(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var employees = await dbContext.Employees.AsNoTracking()
            .OrderBy(candidate => candidate.Id)
            .Select(candidate => ToResponse(candidate))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(employees);
    }

    private static async Task<IResult> GetEmployee(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        return employee is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ToResponse(employee));
    }

    private static async Task<IResult> CreateEmployee(
        CreateEmployeeRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCredentials(request?.Username, request?.Password, true);
        ValidateProfile(request, errors);
        ValidateEmployeeRoles(request?.RoleIds, errors);
        if (request is not null && request.CompanyId <= 0)
        {
            errors["companyId"] = ["Company is required."];
        }
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var validRequest = request!;
        var companyResult = await RequireActiveCompany(
            validRequest.CompanyId, dbContext, cancellationToken);
        if (companyResult is not null)
        {
            return companyResult;
        }

        var normalizedUsername = validRequest.Username.Trim();
        if (await UsernameExists(normalizedUsername, null, dbContext, cancellationToken))
        {
            return Conflict("A user with this username already exists.");
        }

        var user = NewUser(normalizedUsername, validRequest.Password);
        user.UserRoles.Add(new UserRole { RoleId = RoleIds.Employee });
        if (validRequest.RoleIds.Contains(RoleIds.Architect))
        {
            user.UserRoles.Add(new UserRole { RoleId = RoleIds.Architect });
        }

        var employee = new Employee
        {
            User = user,
            DisplayName = validRequest.DisplayName.Trim(),
            FullName = validRequest.FullName.Trim(),
            Nif = validRequest.Nif.Trim(),
            Email = validRequest.Email.Trim(),
            PhoneNumber = validRequest.PhoneNumber.Trim(),
            Address = validRequest.Address.Trim()
        };
        dbContext.Employees.Add(employee);
        dbContext.CompanyEmployees.Add(new CompanyEmployee
        {
            CompanyId = validRequest.CompanyId,
            Employee = employee,
            CompanyRole = CompanyRoles.Employee,
            IsArchitect = validRequest.RoleIds.Contains(RoleIds.Architect)
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/admin/employees/{employee.Id}",
            ToResponse(employee));
    }

    private static async Task<IResult> UpdateEmployee(
        long id,
        UpdateEmployeeRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateProfile(request, errors);
        if (request is not null && request.CompanyId <= 0)
        {
            errors["companyId"] = ["Company is required."];
        }
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var employee = await dbContext.Employees
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (employee is null)
        {
            return TypedResults.NotFound();
        }

        Apply(employee, request!);
        await dbContext.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(ToResponse(employee));
    }

    private static async Task<IResult> DeleteEmployee(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (employee is null)
        {
            return TypedResults.NotFound();
        }

        var user = await dbContext.Users.FindAsync([employee.UserId], cancellationToken);
        dbContext.Users.Remove(user!);
        await dbContext.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> GetClients(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var clients = await dbContext.Clients.AsNoTracking()
            .Include(candidate => candidate.CompanyClients)
            .OrderBy(candidate => candidate.Id)
            .Select(candidate => ToResponse(candidate))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(clients);
    }

    private static async Task<IResult> GetClient(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients.AsNoTracking()
            .Include(candidate => candidate.CompanyClients)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        return client is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ToResponse(client));
    }

    private static async Task<IResult> CreateClient(
        CreateClientRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCredentials(request?.Username, request?.Password, true);
        ValidateProfile(request, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var validRequest = request!;
        var companyIds = validRequest.CompanyIds?.Distinct().ToArray() ?? [];
        if (validRequest.CompanyIds is null || companyIds.Length != validRequest.CompanyIds.Count || companyIds.Any(id => id <= 0))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["companyIds"] = ["Select valid companies without duplicates."] });
        }
        var selectedCompanies = await dbContext.Companies.AsNoTracking()
            .Where(company => companyIds.Contains(company.Id))
            .Select(company => new { company.Id, company.IsActive })
            .ToArrayAsync(cancellationToken);
        if (selectedCompanies.Length != companyIds.Length)
        {
            return TypedResults.NotFound(new AdministrationErrorResponse("One or more active companies were not found."));
        }
        if (selectedCompanies.Any(company => !company.IsActive))
        {
            return Conflict("Clients cannot be associated with an inactive company.");
        }

        var normalizedUsername = validRequest.Username.Trim();
        if (await UsernameExists(normalizedUsername, null, dbContext, cancellationToken))
        {
            return Conflict("A user with this username already exists.");
        }

        var email = EmailAddress.Normalize(validRequest.Email);
        if (await dbContext.Clients.AnyAsync(candidate => candidate.Email == email, cancellationToken))
        {
            return Conflict("A client with this email already exists.");
        }

        var user = NewUser(normalizedUsername, validRequest.Password);
        user.UserRoles.Add(new UserRole { RoleId = RoleIds.Client });
        var client = new Client
        {
            User = user,
            DisplayName = validRequest.DisplayName.Trim(),
            FullName = validRequest.FullName.Trim(),
            Nif = validRequest.Nif.Trim(),
            Email = email,
            PhoneNumber = validRequest.PhoneNumber.Trim(),
            Address = validRequest.Address.Trim()
        };
        foreach (var companyId in companyIds)
        {
            client.CompanyClients.Add(new CompanyClient { CompanyId = companyId });
        }
        dbContext.Clients.Add(client);
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await RemoveMatchingInvitations(companyIds, email, dbContext, cancellationToken);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Conflict("A client with this email already exists.");
        }

        return TypedResults.Created($"/api/admin/clients/{client.Id}", ToResponse(client));
    }

    private static async Task<IResult> UpdateClient(
        long id,
        UpdateClientRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateProfile(request, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var client = await dbContext.Clients
            .Include(candidate => candidate.CompanyClients)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var companyIds = request!.CompanyIds?.Distinct().ToArray() ?? [];
        if (request.CompanyIds is null || companyIds.Length != request.CompanyIds.Count || companyIds.Any(companyId => companyId <= 0))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["companyIds"] = ["Select valid companies without duplicates."] });
        }

        var currentCompanyIds = client.CompanyClients.Select(membership => membership.CompanyId).ToHashSet();
        var addedCompanyIds = companyIds.Where(companyId => !currentCompanyIds.Contains(companyId)).ToArray();
        var addedCompanies = await dbContext.Companies.AsNoTracking()
            .Where(company => addedCompanyIds.Contains(company.Id))
            .Select(company => new { company.Id, company.IsActive })
            .ToArrayAsync(cancellationToken);
        if (addedCompanies.Length != addedCompanyIds.Length)
        {
            return TypedResults.NotFound(new AdministrationErrorResponse("One or more active companies were not found."));
        }
        if (addedCompanies.Any(company => !company.IsActive))
        {
            return Conflict("Clients cannot be associated with an inactive company.");
        }
        var removedCompanyIds = currentCompanyIds.Where(companyId => !companyIds.Contains(companyId)).ToArray();
        if (await dbContext.ProjectClients.AnyAsync(projectClient => projectClient.ClientId == id && removedCompanyIds.Contains(projectClient.Project!.CompanyId), cancellationToken))
        {
            return TypedResults.Conflict(new AdministrationErrorResponse(
                "Remove this client from the company's projects before removing the company membership."));
        }

        var email = EmailAddress.Normalize(request.Email);
        if (await dbContext.Clients.AnyAsync(candidate => candidate.Id != id && candidate.Email == email, cancellationToken))
        {
            return Conflict("A client with this email already exists.");
        }

        Apply(client, request);
        foreach (var membership in client.CompanyClients.Where(membership => removedCompanyIds.Contains(membership.CompanyId)).ToArray())
        {
            dbContext.CompanyClients.Remove(membership);
        }
        foreach (var companyId in addedCompanyIds)
        {
            client.CompanyClients.Add(new CompanyClient { CompanyId = companyId, ClientId = client.Id });
        }
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await RemoveMatchingInvitations(companyIds, email, dbContext, cancellationToken);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Conflict("A client with this email already exists.");
        }
        return TypedResults.Ok(ToResponse(client));
    }

    private static async Task<IResult> DeleteClient(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var client = await dbContext.Clients
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (client is null)
        {
            return TypedResults.NotFound();
        }

        var user = await dbContext.Users.FindAsync([client.UserId], cancellationToken);
        dbContext.Users.Remove(user!);
        await dbContext.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<IResult> GetCompanies(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken,
        bool includeInactive = false)
    {
        var query = dbContext.Companies.AsNoTracking();
        if (!includeInactive)
        {
            query = query.Where(candidate => candidate.IsActive);
        }

        var companies = await query
            .OrderBy(candidate => candidate.Id)
            .Select(candidate => ToResponse(candidate))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(companies);
    }

    private static async Task<IResult> GetCompany(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        return company is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ToResponse(company));
    }

    private static async Task<IResult> CreateCompany(
        CreateCompanyRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCompany(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var now = DateTimeOffset.UtcNow;
        var company = new Company
        {
            Name = request!.Name.Trim(),
            LegalName = request.LegalName.Trim(),
            Nif = request.Nif.Trim(),
            Email = request.Email.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            Address = request.Address.Trim(),
            Website = NormalizeOptional(request.Website),
            IsActive = true,
            CreatedAt = now,
            CreatedBy = AuditActors.System,
            UpdatedAt = now,
            UpdatedBy = AuditActors.System
        };
        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/admin/companies/{company.Id}",
            ToResponse(company));
    }

    private static async Task<IResult> UpdateCompany(
        long id,
        UpdateCompanyRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateCompany(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var company = await dbContext.Companies
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (company is null)
        {
            return TypedResults.NotFound();
        }
        if (!company.IsActive)
        {
            return Conflict("Inactive companies cannot be updated.");
        }

        company.Name = request!.Name.Trim();
        company.LegalName = request.LegalName.Trim();
        company.Nif = request.Nif.Trim();
        company.Email = request.Email.Trim();
        company.PhoneNumber = request.PhoneNumber.Trim();
        company.Address = request.Address.Trim();
        company.Website = NormalizeOptional(request.Website);
        company.UpdatedAt = DateTimeOffset.UtcNow;
        company.UpdatedBy = AuditActors.System;
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(ToResponse(company));
    }

    private static async Task<IResult> DeleteCompany(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (company is null)
        {
            return TypedResults.NotFound();
        }

        if (company.IsActive)
        {
            company.IsActive = false;
            company.UpdatedAt = DateTimeOffset.UtcNow;
            company.UpdatedBy = AuditActors.System;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return TypedResults.NoContent();
    }

    private static IQueryable<User> UserQuery(BlueprintDbContext dbContext) =>
        dbContext.Users
            .AsNoTracking()
            .Include(candidate => candidate.UserRoles)
                .ThenInclude(candidate => candidate.Role);

    private static async Task LoadUserRoles(
        User user,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        await dbContext.Entry(user)
            .Collection(candidate => candidate.UserRoles)
            .Query()
            .Include(candidate => candidate.Role)
            .LoadAsync(cancellationToken);
    }

    private static User NewUser(string username, string password)
    {
        var now = DateTimeOffset.UtcNow;
        var user = new User
        {
            Username = username,
            Password = string.Empty,
            IsActive = true,
            CreatedAt = now,
            CreatedBy = AuditActors.System,
            UpdatedAt = now,
            UpdatedBy = AuditActors.System
        };
        user.Password = new PasswordHasher<User>().HashPassword(user, password);
        return user;
    }

    private static async Task<bool> UsernameExists(
        string username,
        long? excludedUserId,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken) =>
        await dbContext.Users.AnyAsync(
            candidate => candidate.Username == username &&
                (!excludedUserId.HasValue || candidate.Id != excludedUserId.Value),
            cancellationToken);

    private static bool RolesMatchProfile(User user, IReadOnlyCollection<long> roleIds)
    {
        var roles = roleIds.Order().ToArray();
        if (user.Employee is not null)
        {
            return roles.SequenceEqual([RoleIds.Employee]) ||
                roles.SequenceEqual([RoleIds.Employee, RoleIds.Architect]);
        }
        if (user.Client is not null)
        {
            return roles.SequenceEqual([RoleIds.Client]);
        }

        return roles.SequenceEqual([RoleIds.PlatformAdmin]);
    }

    private static async Task<IResult?> RequireActiveCompany(
        long companyId,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.AsNoTracking()
            .Where(candidate => candidate.Id == companyId)
            .Select(candidate => new { candidate.IsActive })
            .SingleOrDefaultAsync(cancellationToken);
        if (company is null)
        {
            return TypedResults.NotFound(
                new AdministrationErrorResponse("The selected company does not exist."));
        }
        if (!company.IsActive)
        {
            return Conflict("The selected company is inactive.");
        }

        return null;
    }

    private static Dictionary<string, string[]> ValidateCredentials(
        string? username,
        string? password,
        bool passwordRequired)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateRequired(errors, "username", username, "Username", 256);

        if (passwordRequired && string.IsNullOrWhiteSpace(password))
        {
            errors["password"] = ["Password is required."];
        }
        else if (password is not null && password.Length > MaximumPasswordLength)
        {
            errors["password"] = [
                $"Password must not exceed {MaximumPasswordLength} characters."
            ];
        }

        return errors;
    }

    private static void ValidateRoleIds(
        IReadOnlyList<long>? roleIds,
        Dictionary<string, string[]> errors)
    {
        if (roleIds is null || roleIds.Count == 0)
        {
            errors["roleIds"] = ["At least one role is required."];
            return;
        }
        if (roleIds.Any(candidate => candidate <= 0) ||
            roleIds.Count != roleIds.Distinct().Count())
        {
            errors["roleIds"] = ["Role IDs must be positive and unique."];
        }
    }

    private static void ValidateEmployeeRoles(
        IReadOnlyList<long>? roleIds,
        Dictionary<string, string[]> errors)
    {
        ValidateRoleIds(roleIds, errors);
        if (errors.ContainsKey("roleIds"))
        {
            return;
        }

        var roles = roleIds!.Order().ToArray();
        if (!roles.SequenceEqual([RoleIds.Employee]) &&
            !roles.SequenceEqual([RoleIds.Employee, RoleIds.Architect]))
        {
            errors["roleIds"] = [
                "Employees require the employee role and may additionally have the architect role."
            ];
        }
    }

    private static void ValidateProfile(
        object? request,
        Dictionary<string, string[]> errors)
    {
        if (request is null)
        {
            errors["request"] = ["A JSON request body is required."];
            return;
        }

        var values = request switch
        {
            CreateEmployeeRequest value => (
                value.DisplayName, value.FullName, value.Nif, value.Email,
                value.PhoneNumber, value.Address),
            UpdateEmployeeRequest value => (
                value.DisplayName, value.FullName, value.Nif, value.Email,
                value.PhoneNumber, value.Address),
            CreateClientRequest value => (
                value.DisplayName, value.FullName, value.Nif, value.Email,
                value.PhoneNumber, value.Address),
            UpdateClientRequest value => (
                value.DisplayName, value.FullName, value.Nif, value.Email,
                value.PhoneNumber, value.Address),
            _ => throw new InvalidOperationException("Unsupported profile request.")
        };

        AdministrationValidation.ValidateProfile(
            errors,
            values.Item1,
            values.Item2,
            values.Item3,
            values.Item4,
            values.Item5,
            values.Item6);
        if (request is CreateClientRequest or UpdateClientRequest && !EmailAddress.IsValid(values.Item4))
        {
            errors["email"] = ["Enter a valid email address containing at most 320 characters."];
        }
    }

    private static Dictionary<string, string[]> ValidateCompany(object? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request is null)
        {
            errors["request"] = ["A JSON request body is required."];
            return errors;
        }

        var values = request switch
        {
            CreateCompanyRequest value => (
                value.Name, value.LegalName, value.Nif, value.Email,
                value.PhoneNumber, value.Address, value.Website),
            UpdateCompanyRequest value => (
                value.Name, value.LegalName, value.Nif, value.Email,
                value.PhoneNumber, value.Address, value.Website),
            _ => throw new InvalidOperationException("Unsupported company request.")
        };
        AdministrationValidation.ValidateCompany(
            errors,
            values.Item1,
            values.Item2,
            values.Item3,
            values.Item4,
            values.Item5,
            values.Item6,
            values.Item7);
        return errors;
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void ValidateRequired(
        Dictionary<string, string[]> errors,
        string key,
        string? value,
        string label,
        int maximumLength)
    {
        AdministrationValidation.ValidateRequired(
            errors, key, value, label, maximumLength);
    }

    private static void Apply(Employee employee, UpdateEmployeeRequest request)
    {
        employee.DisplayName = request.DisplayName.Trim();
        employee.FullName = request.FullName.Trim();
        employee.Nif = request.Nif.Trim();
        employee.Email = request.Email.Trim();
        employee.PhoneNumber = request.PhoneNumber.Trim();
        employee.Address = request.Address.Trim();
    }

    private static void Apply(Client client, UpdateClientRequest request)
    {
        client.DisplayName = request.DisplayName.Trim();
        client.FullName = request.FullName.Trim();
        client.Nif = request.Nif.Trim();
        client.Email = EmailAddress.Normalize(request.Email);
        client.PhoneNumber = request.PhoneNumber.Trim();
        client.Address = request.Address.Trim();
    }

    private static UserResponse ToResponse(User user) =>
        new(
            user.Id,
            user.Username,
            user.UserRoles
                .OrderBy(candidate => candidate.RoleId)
                .Select(candidate => new RoleResponse(
                    candidate.RoleId,
                    candidate.Role!.Name))
                .ToArray(),
            user.CreatedAt,
            user.CreatedBy,
            user.UpdatedAt,
            user.UpdatedBy);

    private static EmployeeResponse ToResponse(Employee employee) =>
        new(
            employee.Id,
            employee.UserId,
            employee.CompanyEmployee?.CompanyId ?? 0,
            employee.DisplayName,
            employee.FullName,
            employee.Nif ?? string.Empty,
            employee.Email ?? string.Empty,
            employee.PhoneNumber ?? string.Empty,
            employee.Address ?? string.Empty);

    private static ClientResponse ToResponse(Client client) =>
        new(
            client.Id,
            client.UserId,
            client.CompanyClients.OrderBy(membership => membership.CompanyId).Select(membership => membership.CompanyId).ToArray(),
            client.DisplayName,
            client.FullName,
            client.Nif,
            client.Email,
            client.PhoneNumber,
            client.Address);

    private static async Task RemoveMatchingInvitations(
        IReadOnlyCollection<long> companyIds,
        string email,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (companyIds.Count == 0)
        {
            return;
        }

        await dbContext.ClientInvitations
            .Where(invitation => companyIds.Contains(invitation.CompanyId) && invitation.Email == email)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static CompanyResponse ToResponse(Company company) =>
        new(
            company.Id,
            company.Name,
            company.LegalName,
            company.Nif,
            company.Email,
            company.PhoneNumber,
            company.Address,
            company.Website,
            company.IsActive,
            company.CreatedAt,
            company.CreatedBy,
            company.UpdatedAt,
            company.UpdatedBy);

    private static IResult Conflict(string error) =>
        TypedResults.Conflict(new AdministrationErrorResponse(error));
}
