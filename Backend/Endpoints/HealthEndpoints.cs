using Blueprint.Api.Contracts;

namespace Blueprint.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/health", () => TypedResults.Ok(new HealthResponse("healthy")))
            .WithName("GetHealth")
            .WithTags("Health")
            .Produces<HealthResponse>();

        return endpoints;
    }
}
