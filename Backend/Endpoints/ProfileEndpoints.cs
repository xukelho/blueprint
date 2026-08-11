using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Validation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Blueprint.Api.Endpoints;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var profile = endpoints.MapGroup("/api/profile")
            .WithTags("Profile")
            .RequireAuthorization();

        profile.MapGet("/", GetProfile)
            .WithName("GetCurrentProfile")
            .Produces<CurrentProfileResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound);
        profile.MapPut("/", UpdateProfile)
            .WithName("UpdateCurrentProfile")
            .Accepts<UpdateCurrentProfileRequest>("application/json")
            .Produces<CurrentProfileResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
        profile.MapPut("/password", ChangePassword)
            .Accepts<ChangePasswordRequest>("application/json")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesValidationProblem();

        return endpoints;
    }

    private static async Task<IResult> GetProfile(
        ClaimsPrincipal principal,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(principal, out var userId))
        {
            return TypedResults.Unauthorized();
        }

        var user = await ProfileQuery(dbContext)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null || user.Client is null && user.Employee is null)
        {
            return TypedResults.NotFound();
        }

        var companies = user.Client is null
            ? await LoadCompanyOptions(dbContext, cancellationToken)
            : user.Client.CompanyClients
                .Where(membership => membership.Company?.IsActive == true)
                .OrderBy(membership => membership.Company!.Name)
                .Select(membership => new ProfileCompanyOption(membership.CompanyId, membership.Company!.Name))
                .ToArray();
        return TypedResults.Ok(ToResponse(user, companies));
    }

    private static async Task<IResult> UpdateProfile(
        UpdateCurrentProfileRequest? request,
        HttpContext httpContext,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(httpContext.User, out var userId))
        {
            return TypedResults.Unauthorized();
        }

        var errors = Validate(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var user = await dbContext.Users
            .Include(candidate => candidate.UserRoles)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }
        var employee = await dbContext.Employees
            .Include(candidate => candidate.CompanyEmployee)
                .ThenInclude(candidate => candidate!.Company)
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId,
                cancellationToken);
        var client = employee is null
            ? await dbContext.Clients
                .Include(candidate => candidate.CompanyClients)
                    .ThenInclude(candidate => candidate.Company)
                .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId,
                cancellationToken)
            : null;
        if (employee is null && client is null)
        {
            return TypedResults.NotFound();
        }

        var validRequest = request!;
        var companies = employee is not null
            ? await LoadCompanyOptions(dbContext, cancellationToken)
            : client!.CompanyClients
                .Where(membership => membership.Company?.IsActive == true)
                .OrderBy(membership => membership.Company!.Name)
                .Select(membership => new ProfileCompanyOption(membership.CompanyId, membership.Company!.Name))
                .ToArray();
        if (client is not null)
        {
            if (validRequest.IsArchitect)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["isArchitect"] = ["Only employee profiles can enable the architect role."]
                });
            }
            var email = EmailAddress.Normalize(validRequest.Email);
            if (await dbContext.Clients.AnyAsync(
                    candidate => candidate.Id != client.Id && candidate.Email == email,
                    cancellationToken))
            {
                return TypedResults.Conflict(new AdministrationErrorResponse(
                    "A client with this email already exists."));
            }
        }
        else
        {
            if (validRequest.CompanyId is not long companyId)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["companyId"] = ["Company is required."]
                });
            }
            var company = await dbContext.Companies.AsNoTracking()
                .SingleOrDefaultAsync(candidate => candidate.Id == companyId, cancellationToken);
            if (company is null || !company.IsActive)
            {
                return TypedResults.Conflict(new AdministrationErrorResponse(
                    "Employees must belong to an active company."));
            }
        }
        var username = validRequest.Username.Trim();
        if (await dbContext.Users.AnyAsync(
                candidate => candidate.Id != userId && candidate.Username == username,
                cancellationToken))
        {
            return TypedResults.Conflict(
                new AdministrationErrorResponse(
                    "A user with this username already exists."));
        }

        user.Username = username;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = user.Id;
        if (employee is not null)
        {
            Apply(employee, validRequest);
            var membership = employee.CompanyEmployee!;
            if (membership.CompanyId != validRequest.CompanyId)
            {
                dbContext.CompanyEmployees.Remove(membership);
                membership = new CompanyEmployee
                {
                    CompanyId = validRequest.CompanyId!.Value,
                    EmployeeId = employee.Id,
                    CompanyRole = membership.CompanyRole,
                    IsArchitect = validRequest.IsArchitect
                };
                dbContext.CompanyEmployees.Add(membership);
                employee.CompanyEmployee = membership;
            }
            else
            {
                membership.IsArchitect = validRequest.IsArchitect;
            }
            var architectRole = user.UserRoles.SingleOrDefault(role => role.RoleId == RoleIds.Architect);
            if (validRequest.IsArchitect && architectRole is null)
            {
                user.UserRoles.Add(new UserRole { RoleId = RoleIds.Architect });
            }
            else if (!validRequest.IsArchitect && architectRole is not null)
            {
                dbContext.UserRoles.Remove(architectRole);
            }
        }
        else
        {
            Apply(client!, validRequest);
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException) when (client is not null)
        {
            return TypedResults.Conflict(new AdministrationErrorResponse(
                "A client with this email already exists."));
        }
        user.Employee = employee;
        user.Client = client;
        string[] roles = employee is not null
            ? validRequest.IsArchitect ? ["employee", "architect"] : ["employee"]
            : ["client"];
        await RefreshSessionAsync(httpContext, user, roles);
        return TypedResults.Ok(ToResponse(
            user,
            companies,
            companies.FirstOrDefault(company => company.Id ==
                employee?.CompanyEmployee?.CompanyId)?.Name,
            roles));
    }

    private static async Task<IResult> ChangePassword(
        ChangePasswordRequest? request,
        ClaimsPrincipal principal,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(principal, out var userId)) return TypedResults.Unauthorized();
        var errors = new Dictionary<string, string[]>();
        AdministrationValidation.ValidateRequired(errors, "currentPassword", request?.CurrentPassword, "Current password", 1024);
        AdministrationValidation.ValidateRequired(errors, "newPassword", request?.NewPassword, "New password", 1024);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Id == userId && x.IsActive, cancellationToken);
        if (user is null) return TypedResults.Unauthorized();
        var hasher = new PasswordHasher<User>();
        if (hasher.VerifyHashedPassword(user, user.Password, request!.CurrentPassword) == PasswordVerificationResult.Failed)
            return TypedResults.Unauthorized();
        user.Password = hasher.HashPassword(user, request.NewPassword);
        user.UpdatedAt = DateTimeOffset.UtcNow; user.UpdatedBy = userId;
        await dbContext.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static Dictionary<string, string[]> Validate(
        UpdateCurrentProfileRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request is null)
        {
            errors["request"] = ["A JSON request body is required."];
            return errors;
        }

        AdministrationValidation.ValidateRequired(
            errors, "username", request.Username, "Username", 256);
        AdministrationValidation.ValidateRequired(errors, "displayName", request.DisplayName, "Display name", 256);
        AdministrationValidation.ValidateRequired(errors, "fullName", request.FullName, "Full name", 512);
        if (!EmailAddress.IsValid(request.Email))
        {
            errors["email"] = ["Enter a valid email address containing at most 320 characters."];
        }
        return errors;
    }

    private static IQueryable<User> ProfileQuery(BlueprintDbContext dbContext) =>
        dbContext.Users
            .Include(candidate => candidate.UserRoles)
                .ThenInclude(candidate => candidate.Role)
            .Include(candidate => candidate.Client)
                .ThenInclude(candidate => candidate!.CompanyClients)
                    .ThenInclude(candidate => candidate.Company)
            .Include(candidate => candidate.Employee)
                .ThenInclude(candidate => candidate!.CompanyEmployee)
                    .ThenInclude(candidate => candidate!.Company);

    private static Task<ProfileCompanyOption[]> LoadCompanyOptions(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken) =>
        dbContext.Companies.AsNoTracking()
            .Where(candidate => candidate.IsActive)
            .OrderBy(candidate => candidate.Name)
            .Select(candidate => new ProfileCompanyOption(candidate.Id, candidate.Name))
            .ToArrayAsync(cancellationToken);

    private static CurrentProfileResponse ToResponse(
        User user,
        IReadOnlyList<ProfileCompanyOption> companies,
        string? companyName = null,
        IReadOnlyList<string>? roleOverride = null)
    {
        var roles = roleOverride ?? user.UserRoles
            .OrderBy(candidate => candidate.RoleId)
            .Select(candidate => candidate.RoleId switch
            {
                RoleIds.PlatformAdmin => "platform admin",
                RoleIds.Client => "client",
                RoleIds.Employee => "employee",
                RoleIds.Architect => "architect",
                _ => candidate.Role?.Name ?? "unknown"
            })
            .ToArray();

        if (user.Employee is not null)
        {
            var employee = user.Employee;
            return new CurrentProfileResponse(
                "employee",
                user.Id,
                user.Username,
                employee.DisplayName,
                employee.FullName,
                employee.Nif ?? string.Empty,
                employee.Email ?? string.Empty,
                employee.PhoneNumber ?? string.Empty,
                employee.Address ?? string.Empty,
                employee.CompanyEmployee?.CompanyId,
                companyName ?? employee.CompanyEmployee?.Company?.Name,
                roles,
                companies,
                employee.CompanyEmployee?.CompanyRole,
                employee.CompanyEmployee?.IsArchitect ?? false);
        }

        var client = user.Client!;
        return new CurrentProfileResponse(
            "client",
            user.Id,
            user.Username,
            client.DisplayName,
            client.FullName,
            client.Nif,
            client.Email,
            client.PhoneNumber,
            client.Address,
            null,
            null,
            roles,
            companies);
    }

    private static void Apply(
        Employee employee,
        UpdateCurrentProfileRequest request)
    {
        employee.DisplayName = request.DisplayName.Trim();
        employee.FullName = request.FullName.Trim();
        employee.Nif = string.IsNullOrWhiteSpace(request.Nif) ? null : request.Nif.Trim();
        employee.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        employee.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        employee.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
    }

    private static void Apply(
        Client client,
        UpdateCurrentProfileRequest request)
    {
        client.DisplayName = request.DisplayName.Trim();
        client.FullName = request.FullName.Trim();
        client.Nif = request.Nif.Trim();
        client.Email = EmailAddress.Normalize(request.Email);
        client.PhoneNumber = request.PhoneNumber.Trim();
        client.Address = request.Address.Trim();
    }

    private static bool TryGetUserId(ClaimsPrincipal principal, out long userId) =>
        long.TryParse(
            principal.FindFirstValue(ClaimTypes.NameIdentifier),
            out userId);

    private static Task RefreshSessionAsync(
        HttpContext httpContext,
        User user,
        IReadOnlyList<string> roles)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username)
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        var identity = new ClaimsIdentity(
            claims,
            CookieAuthenticationDefaults.AuthenticationScheme);
        return httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));
    }
}
