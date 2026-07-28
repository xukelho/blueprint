using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
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

        MapUserEndpoints(administration);
        MapProfileEndpoints<Client>(
            administration,
            "clients",
            "Client",
            UserRoleIds.Client,
            static () => new Client
            {
                DisplayName = string.Empty,
                FullName = string.Empty,
                Nif = string.Empty,
                Email = string.Empty,
                PhoneNumber = string.Empty,
                Address = string.Empty
            });
        MapProfileEndpoints<Architect>(
            administration,
            "architects",
            "Architect",
            UserRoleIds.Architect,
            static () => new Architect
            {
                DisplayName = string.Empty,
                FullName = string.Empty,
                Nif = string.Empty,
                Email = string.Empty,
                PhoneNumber = string.Empty,
                Address = string.Empty
            });
        MapProfileEndpoints<Company>(
            administration,
            "companies",
            "Company",
            UserRoleIds.Company,
            static () => new Company
            {
                DisplayName = string.Empty,
                FullName = string.Empty,
                Nif = string.Empty,
                Email = string.Empty,
                PhoneNumber = string.Empty,
                Address = string.Empty
            });

        return endpoints;
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

    private static void MapProfileEndpoints<TProfile>(
        RouteGroupBuilder administration,
        string route,
        string resourceName,
        long requiredRoleId,
        Func<TProfile> profileFactory)
        where TProfile : class, IUserProfile
    {
        var profiles = administration.MapGroup($"/{route}");

        profiles.MapGet(
                "/",
                (BlueprintDbContext dbContext, CancellationToken cancellationToken) =>
                    GetProfiles<TProfile>(dbContext, cancellationToken))
            .WithName($"GetAdministration{resourceName}s")
            .Produces<IReadOnlyList<ProfileResponse>>();

        profiles.MapGet(
                "/{id:long}",
                (long id, BlueprintDbContext dbContext, CancellationToken cancellationToken) =>
                    GetProfile<TProfile>(id, dbContext, cancellationToken))
            .WithName($"GetAdministration{resourceName}")
            .Produces<ProfileResponse>()
            .Produces(StatusCodes.Status404NotFound);

        profiles.MapPost(
                "/",
                (CreateProfileRequest? request,
                    BlueprintDbContext dbContext,
                    CancellationToken cancellationToken) =>
                    CreateProfile<TProfile>(
                        request,
                        route,
                        requiredRoleId,
                        profileFactory,
                        dbContext,
                        cancellationToken))
            .WithName($"CreateAdministration{resourceName}")
            .Accepts<CreateProfileRequest>("application/json")
            .Produces<ProfileResponse>(StatusCodes.Status201Created)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status404NotFound)
            .Produces<AdministrationErrorResponse>(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();

        profiles.MapPut(
                "/{id:long}",
                (long id,
                    UpdateProfileRequest? request,
                    BlueprintDbContext dbContext,
                    CancellationToken cancellationToken) =>
                    UpdateProfile<TProfile>(
                        id,
                        request,
                        dbContext,
                        cancellationToken))
            .WithName($"UpdateAdministration{resourceName}")
            .Accepts<UpdateProfileRequest>("application/json")
            .Produces<ProfileResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .ProducesValidationProblem();

        profiles.MapDelete(
                "/{id:long}",
                (long id, BlueprintDbContext dbContext, CancellationToken cancellationToken) =>
                    DeleteProfile<TProfile>(id, dbContext, cancellationToken))
            .WithName($"DeleteAdministration{resourceName}")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> GetUsers(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var users = await dbContext.Users
            .AsNoTracking()
            .OrderBy(candidate => candidate.Id)
            .Select(candidate => new UserResponse(
                candidate.Id,
                candidate.RoleId,
                candidate.Role!.Role,
                candidate.Username,
                candidate.CreatedAt,
                candidate.CreatedBy,
                candidate.UpdatedAt,
                candidate.UpdatedBy))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(users);
    }

    private static async Task<IResult> GetUser(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var user = await FindUserResponse(id, dbContext, cancellationToken);
        return user is null ? TypedResults.NotFound() : TypedResults.Ok(user);
    }

    private static async Task<IResult> CreateUser(
        CreateUserRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateUser(request?.RoleId, request?.Username, request?.Password, true);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var validRequest = request!;
        if (!await dbContext.UserRoles.AnyAsync(
                candidate => candidate.Id == validRequest.RoleId,
                cancellationToken))
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["roleId"] = ["The selected role does not exist."]
                });
        }

        var normalizedUsername = validRequest.Username.Trim();
        if (await dbContext.Users.AnyAsync(
                candidate => candidate.Username == normalizedUsername,
                cancellationToken))
        {
            return Conflict("A user with this username already exists.");
        }

        var now = DateTimeOffset.UtcNow;
        var user = new User
        {
            RoleId = validRequest.RoleId,
            Username = normalizedUsername,
            Password = string.Empty,
            CreatedAt = now,
            CreatedBy = AuditActors.System,
            UpdatedAt = now,
            UpdatedBy = AuditActors.System
        };
        user.Password = new PasswordHasher<User>().HashPassword(user, validRequest.Password);

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        await dbContext.Entry(user).Reference(candidate => candidate.Role).LoadAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/admin/users/{user.Id}",
            ToResponse(user));
    }

    private static async Task<IResult> UpdateUser(
        long id,
        UpdateUserRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var errors = ValidateUser(request?.RoleId, request?.Username, request?.Password, false);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var validRequest = request!;
        var user = await dbContext.Users
            .Include(candidate => candidate.Role)
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        if (!await dbContext.UserRoles.AnyAsync(
                candidate => candidate.Id == validRequest.RoleId,
                cancellationToken))
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["roleId"] = ["The selected role does not exist."]
                });
        }

        var requiredProfileRole = await GetProfileRole(id, dbContext, cancellationToken);
        if (requiredProfileRole.HasMultipleProfiles)
        {
            return Conflict(
                "This user has more than one profile type. Remove the extra profiles before changing the user.");
        }

        if (requiredProfileRole.RoleId is not null &&
            requiredProfileRole.RoleId != validRequest.RoleId)
        {
            return Conflict(
                "The selected role does not match the user's existing profile.");
        }

        var normalizedUsername = validRequest.Username.Trim();
        if (await dbContext.Users.AnyAsync(
                candidate => candidate.Id != id &&
                    candidate.Username == normalizedUsername,
                cancellationToken))
        {
            return Conflict("A user with this username already exists.");
        }

        user.RoleId = validRequest.RoleId;
        user.Username = normalizedUsername;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.UpdatedBy = AuditActors.System;
        if (!string.IsNullOrEmpty(validRequest.Password))
        {
            user.Password = new PasswordHasher<User>()
                .HashPassword(user, validRequest.Password);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var response = await FindUserResponse(id, dbContext, cancellationToken);
        return TypedResults.Ok(response!);
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

    private static async Task<IResult> GetProfiles<TProfile>(
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
        where TProfile : class, IUserProfile
    {
        var profiles = await dbContext.Set<TProfile>()
            .AsNoTracking()
            .OrderBy(candidate => candidate.Id)
            .Select(candidate => ToResponse(candidate))
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(profiles);
    }

    private static async Task<IResult> GetProfile<TProfile>(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
        where TProfile : class, IUserProfile
    {
        var profile = await dbContext.Set<TProfile>()
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        return profile is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(ToResponse(profile));
    }

    private static async Task<IResult> CreateProfile<TProfile>(
        CreateProfileRequest? request,
        string route,
        long requiredRoleId,
        Func<TProfile> profileFactory,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
        where TProfile : class, IUserProfile
    {
        var errors = ValidateProfile(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var validRequest = request!;
        var user = await dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == validRequest.UserId, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound(
                new AdministrationErrorResponse("The selected user does not exist."));
        }

        if (user.RoleId != requiredRoleId)
        {
            return Conflict("The selected user's role does not match this profile type.");
        }

        if (await UserHasAnyProfile(validRequest.UserId, dbContext, cancellationToken))
        {
            return Conflict("The selected user already has a profile.");
        }

        var profile = profileFactory();
        profile.UserId = validRequest.UserId;
        Apply(profile, validRequest);

        dbContext.Set<TProfile>().Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/admin/{route}/{profile.Id}",
            ToResponse(profile));
    }

    private static async Task<IResult> UpdateProfile<TProfile>(
        long id,
        UpdateProfileRequest? request,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
        where TProfile : class, IUserProfile
    {
        var errors = ValidateProfile(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var profile = await dbContext.Set<TProfile>()
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (profile is null)
        {
            return TypedResults.NotFound();
        }

        Apply(profile, request!);
        await dbContext.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(ToResponse(profile));
    }

    private static async Task<IResult> DeleteProfile<TProfile>(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
        where TProfile : class, IUserProfile
    {
        var profile = await dbContext.Set<TProfile>().FindAsync([id], cancellationToken);
        if (profile is null)
        {
            return TypedResults.NotFound();
        }

        dbContext.Set<TProfile>().Remove(profile);
        await dbContext.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<UserResponse?> FindUserResponse(
        long id,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken) =>
        await dbContext.Users
            .AsNoTracking()
            .Where(candidate => candidate.Id == id)
            .Select(candidate => new UserResponse(
                candidate.Id,
                candidate.RoleId,
                candidate.Role!.Role,
                candidate.Username,
                candidate.CreatedAt,
                candidate.CreatedBy,
                candidate.UpdatedAt,
                candidate.UpdatedBy))
            .SingleOrDefaultAsync(cancellationToken);

    private static async Task<(long? RoleId, bool HasMultipleProfiles)> GetProfileRole(
        long userId,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var roles = new List<long>(3);
        if (await dbContext.Clients.AnyAsync(
                candidate => candidate.UserId == userId,
                cancellationToken))
        {
            roles.Add(UserRoleIds.Client);
        }

        if (await dbContext.Companies.AnyAsync(
                candidate => candidate.UserId == userId,
                cancellationToken))
        {
            roles.Add(UserRoleIds.Company);
        }

        if (await dbContext.Architects.AnyAsync(
                candidate => candidate.UserId == userId,
                cancellationToken))
        {
            roles.Add(UserRoleIds.Architect);
        }

        return (roles.Count == 1 ? roles[0] : null, roles.Count > 1);
    }

    private static async Task<bool> UserHasAnyProfile(
        long userId,
        BlueprintDbContext dbContext,
        CancellationToken cancellationToken) =>
        await dbContext.Clients.AnyAsync(
            candidate => candidate.UserId == userId,
            cancellationToken) ||
        await dbContext.Companies.AnyAsync(
            candidate => candidate.UserId == userId,
            cancellationToken) ||
        await dbContext.Architects.AnyAsync(
            candidate => candidate.UserId == userId,
            cancellationToken);

    private static Dictionary<string, string[]> ValidateUser(
        long? roleId,
        string? username,
        string? password,
        bool passwordRequired)
    {
        var errors = new Dictionary<string, string[]>();
        if (roleId is null || roleId <= 0)
        {
            errors["roleId"] = ["Role is required."];
        }

        ValidateRequiredText(errors, "username", username, 256, "Username");

        if (passwordRequired && string.IsNullOrWhiteSpace(password))
        {
            errors["password"] = ["Password is required."];
        }
        else if (!passwordRequired &&
            password is not null &&
            password.Length > 0 &&
            string.IsNullOrWhiteSpace(password))
        {
            errors["password"] = ["Password must not contain only whitespace."];
        }
        else if (password is not null && password.Length > MaximumPasswordLength)
        {
            errors["password"] = [$"Password must not exceed {MaximumPasswordLength} characters."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateProfile(CreateProfileRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request is null)
        {
            errors["request"] = ["A JSON request body is required."];
            return errors;
        }

        if (request.UserId <= 0)
        {
            errors["userId"] = ["User is required."];
        }

        ValidateProfileText(
            errors,
            request.DisplayName,
            request.FullName,
            request.Nif,
            request.Email,
            request.PhoneNumber,
            request.Address);
        return errors;
    }

    private static Dictionary<string, string[]> ValidateProfile(UpdateProfileRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request is null)
        {
            errors["request"] = ["A JSON request body is required."];
            return errors;
        }

        ValidateProfileText(
            errors,
            request.DisplayName,
            request.FullName,
            request.Nif,
            request.Email,
            request.PhoneNumber,
            request.Address);
        return errors;
    }

    private static void ValidateProfileText(
        Dictionary<string, string[]> errors,
        string? displayName,
        string? fullName,
        string? nif,
        string? email,
        string? phoneNumber,
        string? address)
    {
        ValidateRequiredText(errors, "displayName", displayName, 256, "Display name");
        ValidateRequiredText(errors, "fullName", fullName, 512, "Full name");
        ValidateRequiredText(errors, "nif", nif, 32, "NIF");
        ValidateRequiredText(errors, "email", email, 320, "Email");
        ValidateRequiredText(errors, "phoneNumber", phoneNumber, 64, "Phone number");
        ValidateRequiredText(errors, "address", address, 1024, "Address");
    }

    private static void ValidateRequiredText(
        Dictionary<string, string[]> errors,
        string key,
        string? value,
        int maximumLength,
        string displayName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[key] = [$"{displayName} is required."];
        }
        else if (value.Length > maximumLength)
        {
            errors[key] = [$"{displayName} must not exceed {maximumLength} characters."];
        }
    }

    private static void Apply(IUserProfile profile, CreateProfileRequest request)
    {
        profile.DisplayName = request.DisplayName.Trim();
        profile.FullName = request.FullName.Trim();
        profile.Nif = request.Nif.Trim();
        profile.Email = request.Email.Trim();
        profile.PhoneNumber = request.PhoneNumber.Trim();
        profile.Address = request.Address.Trim();
    }

    private static void Apply(IUserProfile profile, UpdateProfileRequest request)
    {
        profile.DisplayName = request.DisplayName.Trim();
        profile.FullName = request.FullName.Trim();
        profile.Nif = request.Nif.Trim();
        profile.Email = request.Email.Trim();
        profile.PhoneNumber = request.PhoneNumber.Trim();
        profile.Address = request.Address.Trim();
    }

    private static UserResponse ToResponse(User user) =>
        new(
            user.Id,
            user.RoleId,
            user.Role!.Role,
            user.Username,
            user.CreatedAt,
            user.CreatedBy,
            user.UpdatedAt,
            user.UpdatedBy);

    private static ProfileResponse ToResponse(IUserProfile profile) =>
        new(
            profile.Id,
            profile.UserId,
            profile.DisplayName,
            profile.FullName,
            profile.Nif,
            profile.Email,
            profile.PhoneNumber,
            profile.Address);

    private static IResult Conflict(string error) =>
        TypedResults.Conflict(new AdministrationErrorResponse(error));
}
