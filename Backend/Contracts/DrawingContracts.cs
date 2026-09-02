namespace Blueprint.Api.Contracts;

public sealed record DocumentPreviewResponse(string Kind, string SourceFormat);

public sealed record DrawingDocumentResponse(
    int SchemaVersion,
    string ConverterVersion,
    Guid DocumentId,
    string SourceFormat,
    string? Units,
    DrawingBoundsResponse Bounds,
    IReadOnlyList<DrawingLayerResponse> Layers,
    IReadOnlyList<DrawingPathResponse> Paths,
    IReadOnlyList<DrawingTextResponse> Text,
    IReadOnlyList<DrawingWarningResponse> Warnings);

public sealed record DrawingBoundsResponse(double MinX, double MinY, double MaxX, double MaxY);
public sealed record DrawingPointResponse(double X, double Y);
public sealed record DrawingLayerResponse(string Id, string Name, bool Visible, string Color);
public sealed record DrawingStyleResponse(string Stroke, double LineWeight, IReadOnlyList<double>? Dash = null, string? Fill = null);
public sealed record DrawingPathResponse(string LayerId, DrawingStyleResponse Style, bool Closed, IReadOnlyList<DrawingSegmentResponse> Segments);
public sealed record DrawingSegmentResponse(string Kind, DrawingPointResponse? Start = null, DrawingPointResponse? End = null,
    DrawingPointResponse? Center = null, double? Radius = null, double? RadiusY = null, double? Rotation = null,
    double? StartAngle = null, double? EndAngle = null, DrawingPointResponse? Control1 = null, DrawingPointResponse? Control2 = null);
public sealed record DrawingTextResponse(string LayerId, DrawingStyleResponse Style, string Value, DrawingPointResponse Position, double Height, double Rotation);
public sealed record DrawingWarningResponse(string Code, int Count);
