using ACadSharp.IO;
using Blueprint.Api.Contracts;

namespace Blueprint.Api.Services;

/// <summary>Converts DWG documents using ACadSharp's MIT-licensed reader and the same contract builder as DXF.</summary>
public sealed class DwgDrawingSourceParser : IDrawingSourceParser
{
    public string SourceFormat => "dwg";

    public Task<DrawingContent> ParseAsync(Stream source, DrawingPreviewOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new DwgReader(source);
            var document = reader.Read();
            var builder = new DxfDrawingSourceParser.CadDrawingBuilder(options, SourceFormat);
            foreach (var entity in document.Entities)
            {
                cancellationToken.ThrowIfCancellationRequested();
                builder.Add(entity);
            }
            return Task.FromResult(builder.Build());
        }
        catch (DrawingPreviewException) { throw; }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new DrawingPreviewException("drawing-invalid", "The DWG file could not be parsed.", StatusCodes.Status422UnprocessableEntity);
        }
    }
}
