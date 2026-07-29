using System.Security.Claims;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Validation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
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

        var companies = await LoadCompanyOptions(dbContext, cancellationToken);
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

        var companies = await LoadCompanyOptions(dbContext, cancellationToken);

        var user = await dbContext.Users
            .Include(candidate => candidate.UserRoles)
            .SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }
        var employee = await dbContext.Employees
            .SingleOrDefaultAsync(
                candidate => candidate.UserId == userId,
                cancellationToken);
        var client = employee is null
            ? await dbContext.Clients.SingleOrDefaultAsync(
                candidate => candidate.UserId == userId,
                cancellationToken)
            : null;
        if (employee is null && client is null)
        {
            return TypedResults.NotFound();
        }

        var validRequest = request!;
        var username = validRequest.Username.Trim();
        if (await dbContext.Users.AnyAsync(
                candidate => candidate.Id != userId && candidate.Username == username,
                cancellationToken))
        {
            return TypedResults.Conflict(
                new AdministrationErrorResponse(
                    "A user with this username already exists."));
        }

        ProfileCompanyOption? company = null;
        if (validRequest.CompanyId is long companyId)
        {
            company = companies.SingleOrDefault(
                candidate => candidate.Id == companyId);
            if (company is null)
            {
                return TypedResults.Conflict(
                    new AdministrationErrorResponse(
                        "The selected company does not exist or is inactive."));
            }
        }

        if (employee is not null && company is null)
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["companyId"] = ["Company is required for employees."]
                });
        }
        if (client is not null && validRequest.IsArchitect)
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["isArchitect"] = ["Only employees can have the architect role."]
                });
        }

        user.Username = username;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = user.Id;
        var hadArchitectRole = user.UserRoles.Any(
            candidate => candidate.RoleId == RoleIds.Architect);

        if (employee is not null)
        {
            Apply(employee, validRequest);
        }
        else
        {
            Apply(client!, validRequest);
        }

        if (employee is not null)
        {
            if (hadArchitectRole && !validRequest.IsArchitect)
            {
                var architectRole = user.UserRoles.Single(
                    candidate => candidate.RoleId == RoleIds.Architect);
                dbContext.UserRoles.Remove(architectRole);
            }
            else if (!hadArchitectRole && validRequest.IsArchitect)
            {
                dbContext.UserRoles.Add(new UserRole
                {
                    UserId = userId,
                    RoleId = RoleIds.Architect
                });
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        user.Employee = employee;
        user.Client = client;
        var roles = employee is not null
            ? validRequest.IsArchitect
                ? new[] { "employee", "architect" }
                : ["employee"]
            : ["client"];
        await RefreshSessionAsync(httpContext, user, roles);
        return TypedResults.Ok(ToResponse(
            user,
            companies,
            company?.Name,
            roles));
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
        AdministrationValidation.ValidateProfile(
            errors,
            request.DisplayName,
            request.FullName,
            request.Nif,
            request.Email,
            request.PhoneNumber,
            request.Address);
        if (request.CompanyId is <= 0)
        {
            errors["companyId"] = ["Company ID must be positive."];
        }
        return errors;
    }

    private static IQueryable<User> ProfileQuery(BlueprintDbContext dbContext) =>
        dbContext.Users
            .Include(candidate => candidate.UserRoles)
                .ThenInclude(candidate => candidate.Role)
            .Include(candidate => candidate.Client)
                .ThenInclude(candidate => candidate!.Company)
            .Include(candidate => candidate.Employee)
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
                employee.Nif,
                employee.Email,
                employee.PhoneNumber,
                employee.Address,
                employee.CompanyId,
                companyName ?? employee.Company?.Name,
                roles,
                companies);
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
            client.CompanyId,
            companyName ?? client.Company?.Name,
            roles,
            companies);
    }

    private static void Apply(
        Employee employee,
        UpdateCurrentProfileRequest request)
    {
        employee.CompanyId = request.CompanyId!.Value;
        employee.DisplayName = request.DisplayName.Trim();
        employee.FullName = request.FullName.Trim();
        employee.Nif = request.Nif.Trim();
        employee.Email = request.Email.Trim();
        employee.PhoneNumber = request.PhoneNumber.Trim();
        employee.Address = request.Address.Trim();
    }

    private static void Apply(
        Client client,
        UpdateCurrentProfileRequest request)
    {
        client.CompanyId = request.CompanyId;
        client.DisplayName = request.DisplayName.Trim();
        client.FullName = request.FullName.Trim();
        client.Nif = request.Nif.Trim();
        client.Email = request.Email.Trim();
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
