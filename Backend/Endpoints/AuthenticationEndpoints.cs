using Blueprint.Api.Authentication;
using Blueprint.Api.Contracts;

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

        return endpoints;
    }

    private static async Task<IResult> Login(
        LoginRequest? request,
        ICredentialValidator credentialValidator,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        return await credentialValidator.ValidateAsync(
            request!.Username,
            request.Password,
            cancellationToken)
            ? TypedResults.Ok(new LoginResponse("success"))
            : TypedResults.Json(
                new LoginResponse("fail"),
                statusCode: StatusCodes.Status401Unauthorized);
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
