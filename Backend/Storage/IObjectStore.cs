namespace Blueprint.Api.Storage;

public interface IObjectStore
{
    Task<PresignedUploadGrant> CreateUploadGrantAsync(string key, string contentType, TimeSpan lifetime, CancellationToken cancellationToken = default);
    Task<ObjectMetadata?> GetMetadataAsync(string key, CancellationToken cancellationToken = default);
    Task<PresignedDownloadGrant> CreateDownloadGrantAsync(string key, string downloadFileName, TimeSpan lifetime, CancellationToken cancellationToken = default);
    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
}

public sealed record PresignedUploadGrant(Uri Url, DateTimeOffset ExpiresAt, IReadOnlyDictionary<string, string> RequiredHeaders);
public sealed record PresignedDownloadGrant(Uri Url, DateTimeOffset ExpiresAt);
public sealed record ObjectMetadata(long Length, string? ContentType, string? ETag, DateTimeOffset? LastModified);

public sealed class ObjectStoreException(string message, bool isTransient, Exception? innerException = null)
    : Exception(message, innerException)
{
    public bool IsTransient { get; } = isTransient;
}
