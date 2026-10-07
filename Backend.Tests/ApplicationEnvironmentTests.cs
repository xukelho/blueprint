using Blueprint.Api.Configuration;

namespace Blueprint.Api.IntegrationTests;

public sealed class ApplicationEnvironmentTests
{
    [Theory]
    [InlineData("Development", ApplicationEnvironment.Development)]
    [InlineData("dev", ApplicationEnvironment.Development)]
    [InlineData("testing", ApplicationEnvironment.Testing)]
    [InlineData("test", ApplicationEnvironment.Testing)]
    [InlineData("PRODUCTION", ApplicationEnvironment.Production)]
    [InlineData("prod", ApplicationEnvironment.Production)]
    [InlineData(null, ApplicationEnvironment.Production)]
    [InlineData("staging", ApplicationEnvironment.Production)]
    public void FromHostingEnvironmentName_UsesOnlySupportedValues(
        string? environmentName,
        string expected)
    {
        Assert.Equal(expected,
            ApplicationEnvironment.FromHostingEnvironmentName(environmentName));
    }
}
