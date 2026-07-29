using Blueprint.Api.Authentication;
using Blueprint.Api.Contracts;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;

namespace Blueprint.Api.Endpoints;

public static class AuthenticationEndpoints
{
    public static IEndpointRouteBuilder MapAuthenticationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/login", Login)
            .WithName("Login")
            .WithTags("Authentication")
            .Accepts<LoginRequest>("application/json")
            .Produces<LoginResponse>()
            .Produces<LoginResponse>(StatusCodes.Status401Unauthorized)
            .ProducesValidationProblem();

        endpoints.MapPost("/api/auth/logout", Logout)
            .WithName("Logout")
            .WithTags("Authentication")
            .Produces<LoginResponse>();

        return endpoints;
    }

    private static async Task<IResult> Logout(
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await httpContext.SignOutAsync(
            CookieAuthenticationDefaults.AuthenticationScheme);
        return TypedResults.Ok(new LoginResponse("success"));
    }

    private static async Task<IResult> Login(
        LoginRequest? request,
        ICredentialValidator credentialValidator,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var user = await credentialValidator.GetUserForValidCredentialsAsync(
            request!.Username,
            request.Password,
            cancellationToken);

        if (user is null)
        {
            return TypedResults.Json(
                new LoginResponse("fail"),
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username)
        };
        claims.AddRange(user.Roles.Select(role => new Claim(ClaimTypes.Role, role)));
        var identity = new ClaimsIdentity(
            claims,
            CookieAuthenticationDefaults.AuthenticationScheme);
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));

        return TypedResults.Ok(new LoginResponse("success", user.Roles));
    }

    private static Dictionary<string, string[]> Validate(LoginRequest? request)
    {
        var errors = new Dictionary<string, string[]>();

        if (request is null)
        {
            errors["request"] = ["A JSON request body is required."];
            return errors;
        }

        if (string.IsNullOrWhiteSpace(request.Username))
        {
            errors["username"] = ["Username is required."];
        }
        else if (request.Username.Length > 256)
        {
            errors["username"] = ["Username must not exceed 256 characters."];
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            errors["password"] = ["Password is required."];
        }
        else if (request.Password.Length > 1024)
        {
            errors["password"] = ["Password must not exceed 1024 characters."];
        }

        return errors;
    }
}
