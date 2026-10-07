namespace Blueprint.Api.Configuration;

public static class ApplicationEnvironment
{
    public const string Development = "development";
    public const string Testing = "testing";
    public const string Production = "production";

    public static string FromHostingEnvironmentName(string? environmentName) =>
        environmentName?.Trim().ToLowerInvariant() switch
        {
            Development or "dev" => Development,
            Testing or "test" => Testing,
            Production or "prod" => Production,
            _ => Development 
        };
}
