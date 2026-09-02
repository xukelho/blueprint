using System.Collections.Concurrent;
using System.Text.Json;
using Blueprint.Api.Contracts;
using Blueprint.Api.Data;
using Blueprint.Api.Storage;

namespace Blueprint.Api.Services;

public sealed class DrawingPreviewOptions
{
    public const string SectionName = "DrawingPreview";
    public long MaxSourceBytes { get; init; } = 50 * 1024 * 1024;
    public int MaxSegments { get; init; } = 500_000;
    public int MaxBlockDepth { get; init; } = 32;
}

public interface IDrawingSourceParser
{
    string SourceFormat { get; }
    Task<DrawingContent> ParseAsync(Stream source, DrawingPreviewOptions options, CancellationToken cancellationToken = default);
}

public sealed record DrawingContent(string? Units, DrawingBoundsResponse Bounds, IReadOnlyList<DrawingLayerResponse> Layers,
    IReadOnlyList<DrawingPathResponse> Paths, IReadOnlyList<DrawingTextResponse> Text, IReadOnlyList<DrawingWarningResponse> Warnings);

public sealed class DrawingPreviewException(string code, string message, int statusCode) : InvalidOperationException(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}

public sealed class DrawingPreviewService(IEnumerable<IDrawingSourceParser> parsers, IObjectStore objectStore, IConfiguration configuration)
{
    public const int SchemaVersion = 1;
    public const string ConverterVersion = "drawing-v1-acadsharp-3.7.1";
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> Locks = [];
    private readonly DrawingPreviewOptions _options = configuration.GetSection(DrawingPreviewOptions.SectionName).Get<DrawingPreviewOptions>() ?? new DrawingPreviewOptions();
    private readonly IReadOnlyDictionary<string, IDrawingSourceParser> _parsers = parsers.ToDictionary(parser => parser.SourceFormat, StringComparer.OrdinalIgnoreCase);

    public async Task<DrawingDocumentResponse> GetAsync(ProjectDocument document, CancellationToken cancellationToken = default)
    {
        var source = document.StoredObject ?? throw new DrawingPreviewException("drawing-unavailable", "The document source is unavailable.", StatusCodes.Status409Conflict);
        if (source.Status != StoredObjectStatus.Available)
            throw new DrawingPreviewException("drawing-unavailable", "The document upload is not available.", StatusCodes.Status409Conflict);
        if ((source.VerifiedLength ?? source.ExpectedLength) > _options.MaxSourceBytes)
            throw new DrawingPreviewException("drawing-too-large", "The drawing exceeds the preview size limit.", StatusCodes.Status413PayloadTooLarge);

        var format = Path.GetExtension(source.FileName).TrimStart('.').ToLowerInvariant();
        if (!_parsers.TryGetValue(format, out var parser))
            throw new DrawingPreviewException("unsupported-format", "This document format cannot be previewed.", StatusCodes.Status415UnsupportedMediaType);

        var gate = Locks.GetOrAdd(source.Id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            var artifactKey = ArtifactKey(source);
            await using var cached = await objectStore.OpenReadAsync(artifactKey, cancellationToken);
            if (cached is not null)
            {
                var cachedDrawing = await JsonSerializer.DeserializeAsync<DrawingDocumentResponse>(cached, cancellationToken: cancellationToken);
                if (cachedDrawing is { SchemaVersion: SchemaVersion, ConverterVersion: ConverterVersion } && cachedDrawing.DocumentId == document.Id)
                    return cachedDrawing;
            }

            await using var input = await objectStore.OpenReadAsync(source.ObjectKey, cancellationToken)
                ?? throw new DrawingPreviewException("drawing-unavailable", "The document source could not be found.", StatusCodes.Status409Conflict);
            var content = await parser.ParseAsync(input, _options, cancellationToken);
            var drawing = new DrawingDocumentResponse(SchemaVersion, ConverterVersion, document.Id, parser.SourceFormat,
                content.Units, content.Bounds, content.Layers, content.Paths, content.Text, content.Warnings);
            await using var output = new MemoryStream();
            await JsonSerializer.SerializeAsync(output, drawing, cancellationToken: cancellationToken);
            output.Position = 0;
            await objectStore.PutAsync(artifactKey, output, "application/json", cancellationToken);
            return drawing;
        }
        finally
        {
            gate.Release();
        }
    }

    public static string ArtifactKey(StoredObject source) => $"projects/{source.ProjectId}/derived/{source.Id:N}/drawing-v1.json";
}
