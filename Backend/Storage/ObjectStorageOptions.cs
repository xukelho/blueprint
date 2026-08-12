using System.ComponentModel.DataAnnotations;

namespace Blueprint.Api.Storage;

public sealed class ObjectStorageOptions
{
    public const string SectionName = "ObjectStorage";

    [Required, Url] public required string Endpoint { get; init; }
    [Url] public string? PublicEndpoint { get; init; }
    [Required] public required string Region { get; init; }
    [Required] public required string Bucket { get; init; }
    [Required] public required string AccessKey { get; init; }
    [Required] public required string SecretKey { get; init; }
    public bool ForcePathStyle { get; init; } = true;
    public TimeSpan UploadGrantLifetime { get; init; } = TimeSpan.FromMinutes(15);
    public TimeSpan DownloadGrantLifetime { get; init; } = TimeSpan.FromMinutes(5);
    public TimeSpan PendingUploadLifetime { get; init; } = TimeSpan.FromHours(1);
}
