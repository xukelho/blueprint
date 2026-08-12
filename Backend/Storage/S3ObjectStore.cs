using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using Amazon.Runtime;

namespace Blueprint.Api.Storage;

public sealed class S3ObjectStore(IAmazonS3 client, IOptions<ObjectStorageOptions> options, TimeProvider timeProvider) : IObjectStore
{
    private readonly ObjectStorageOptions _options = options.Value;

    public async Task<PresignedUploadGrant> CreateUploadGrantAsync(string key, string contentType, TimeSpan lifetime, CancellationToken cancellationToken = default)
    {
        var expiresAt = timeProvider.GetUtcNow().Add(lifetime);
        try
        {
            var url = await client.GetPreSignedURLAsync(new GetPreSignedUrlRequest
            {
                BucketName = _options.Bucket,
                Key = key,
                Verb = HttpVerb.PUT,
                Protocol = PresignProtocol(),
                Expires = expiresAt.UtcDateTime,
                ContentType = contentType
            });
            return new PresignedUploadGrant(new Uri(url), expiresAt, new Dictionary<string, string> { ["Content-Type"] = contentType });
        }
        catch (AmazonS3Exception exception)
        {
            throw Translate("Could not create an upload grant.", exception);
        }
    }

    public async Task<ObjectMetadata?> GetMetadataAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await client.GetObjectMetadataAsync(_options.Bucket, key, cancellationToken);
            return new ObjectMetadata(response.ContentLength, response.Headers.ContentType, NormalizeEtag(response.ETag), response.LastModified);
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        catch (AmazonS3Exception exception)
        {
            throw Translate("Could not read object metadata.", exception);
        }
    }

    public async Task<PresignedDownloadGrant> CreateDownloadGrantAsync(string key, string downloadFileName, TimeSpan lifetime, CancellationToken cancellationToken = default)
    {
        var expiresAt = timeProvider.GetUtcNow().Add(lifetime);
        try
        {
            var url = await client.GetPreSignedURLAsync(new GetPreSignedUrlRequest
            {
                BucketName = _options.Bucket,
                Key = key,
                Verb = HttpVerb.GET,
                Protocol = PresignProtocol(),
                Expires = expiresAt.UtcDateTime,
                ResponseHeaderOverrides = new ResponseHeaderOverrides
                {
                    ContentDisposition = $"attachment; filename*=UTF-8''{Uri.EscapeDataString(downloadFileName)}"
                }
            });
            return new PresignedDownloadGrant(new Uri(url), expiresAt);
        }
        catch (AmazonS3Exception exception)
        {
            throw Translate("Could not create a download grant.", exception);
        }
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            await client.DeleteObjectAsync(_options.Bucket, key, cancellationToken);
        }
        catch (AmazonS3Exception exception)
        {
            throw Translate("Could not delete the object.", exception);
        }
    }

    private static string? NormalizeEtag(string? value) => value?.Trim('"');
    private Protocol PresignProtocol() => new Uri(_options.Endpoint).Scheme == Uri.UriSchemeHttps ? Protocol.HTTPS : Protocol.HTTP;
    private static ObjectStoreException Translate(string message, AmazonS3Exception exception) =>
        new(message, exception.StatusCode is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests or >= HttpStatusCode.InternalServerError, exception);
}

public static class S3ObjectStoreRegistration
{
    public static IServiceCollection AddObjectStorage(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<ObjectStorageOptions>()
            .Bind(configuration.GetSection(ObjectStorageOptions.SectionName))
            .ValidateDataAnnotations()
            .Validate(options => options.UploadGrantLifetime > TimeSpan.Zero && options.DownloadGrantLifetime > TimeSpan.Zero && options.PendingUploadLifetime > TimeSpan.Zero,
                "Object storage URL lifetimes must be positive.")
            .ValidateOnStart();
        services.AddSingleton<IAmazonS3>(provider =>
        {
            var options = provider.GetRequiredService<IOptions<ObjectStorageOptions>>().Value;
            return new AmazonS3Client(new BasicAWSCredentials(options.AccessKey, options.SecretKey), new AmazonS3Config
            {
                ServiceURL = options.Endpoint,
                AuthenticationRegion = options.Region,
                ForcePathStyle = options.ForcePathStyle
            });
        });
        services.AddSingleton<IObjectStore, S3ObjectStore>();
        return services;
    }
}
