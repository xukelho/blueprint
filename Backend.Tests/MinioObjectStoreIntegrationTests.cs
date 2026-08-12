using System.Net;
using System.Net.Http.Headers;
using Amazon.Runtime;
using Amazon.S3;
using Blueprint.Api.Storage;
using Microsoft.Extensions.Options;

namespace Blueprint.Api.IntegrationTests;

public sealed class MinioObjectStoreIntegrationTests
{
    [Fact]
    public async Task PresignedUploadMetadataDownloadAndDeleteWorkAgainstMinio()
    {
        var endpoint = Environment.GetEnvironmentVariable("BLUEPRINT_TEST_S3_ENDPOINT");
        if (string.IsNullOrWhiteSpace(endpoint)) return;

        var options = new ObjectStorageOptions
        {
            Endpoint = endpoint, Region = "us-east-1", Bucket = "blueprint-private",
            AccessKey = "blueprint_dev", SecretKey = "blueprint_dev_password", ForcePathStyle = true
        };
        using var client = new AmazonS3Client(new BasicAWSCredentials(options.AccessKey, options.SecretKey), new AmazonS3Config
        {
            ServiceURL = options.Endpoint, AuthenticationRegion = options.Region, ForcePathStyle = options.ForcePathStyle
        });
        var store = new S3ObjectStore(client, Options.Create(options), TimeProvider.System);
        var key = $"integration/{Guid.NewGuid():N}";
        var bytes = "blueprint-minio-integration"u8.ToArray();
        using var http = new HttpClient();

        var upload = await store.CreateUploadGrantAsync(key, "text/plain", TimeSpan.FromMinutes(2));
        using var uploadContent = new ByteArrayContent(bytes);
        uploadContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        using var uploaded = await http.PutAsync(upload.Url, uploadContent);
        Assert.Equal(HttpStatusCode.OK, uploaded.StatusCode);

        var metadata = await store.GetMetadataAsync(key);
        Assert.NotNull(metadata);
        Assert.Equal(bytes.Length, metadata.Length);
        Assert.Equal("text/plain", metadata.ContentType);
        Assert.False(string.IsNullOrWhiteSpace(metadata.ETag));

        var download = await store.CreateDownloadGrantAsync(key, "verification.txt", TimeSpan.FromMinutes(2));
        Assert.Equal(bytes, await http.GetByteArrayAsync(download.Url));

        await store.DeleteAsync(key);
        Assert.Null(await store.GetMetadataAsync(key));
    }
}
