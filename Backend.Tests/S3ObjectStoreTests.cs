using Amazon.Runtime;
using Amazon.S3;
using Blueprint.Api.Storage;
using Microsoft.Extensions.Options;

namespace Blueprint.Api.IntegrationTests;

public sealed class S3ObjectStoreTests
{
    [Fact]
    public async Task GrantsAreSignedForThePublicEndpoint()
    {
        var options = new ObjectStorageOptions
        {
            Endpoint = "http://minio:9000",
            PublicEndpoint = "http://localhost:9000",
            Region = "us-east-1",
            Bucket = "blueprint-private",
            AccessKey = "access-key",
            SecretKey = "secret-key",
            ForcePathStyle = true
        };
        using var internalClient = CreateClient(options, options.Endpoint);
        using var grantClient = CreateClient(options, options.PublicEndpoint);
        var store = new S3ObjectStore(internalClient, grantClient, Options.Create(options), TimeProvider.System);

        var upload = await store.CreateUploadGrantAsync("projects/1/objects/test", "image/png", TimeSpan.FromMinutes(2));
        var download = await store.CreateDownloadGrantAsync("projects/1/objects/test", "test.png", TimeSpan.FromMinutes(2));

        Assert.Equal("localhost", upload.Url.Host);
        Assert.Equal(9000, upload.Url.Port);
        Assert.Equal("localhost", download.Url.Host);
        Assert.Contains("host", upload.Url.Query, StringComparison.OrdinalIgnoreCase);
    }

    private static AmazonS3Client CreateClient(ObjectStorageOptions options, string endpoint) =>
        new(new BasicAWSCredentials(options.AccessKey, options.SecretKey), new AmazonS3Config
        {
            ServiceURL = endpoint,
            AuthenticationRegion = options.Region,
            ForcePathStyle = options.ForcePathStyle
        });
}
