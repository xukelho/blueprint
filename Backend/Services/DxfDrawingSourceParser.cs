using ACadSharp.Entities;
using ACadSharp.IO;
using Blueprint.Api.Contracts;

namespace Blueprint.Api.Services;

/// <summary>Converts the portable subset of a DXF document to the viewer's format-neutral drawing contract.</summary>
public sealed class DxfDrawingSourceParser : IDrawingSourceParser
{
    public string SourceFormat => "dxf";

    public Task<DrawingContent> ParseAsync(Stream source, DrawingPreviewOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new DxfReader(source);
            var document = reader.Read();
            var builder = new DrawingBuilder(options);
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
            throw new DrawingPreviewException("drawing-invalid", "The DXF file could not be parsed.", StatusCodes.Status422UnprocessableEntity);
        }
    }

    private sealed class DrawingBuilder(DrawingPreviewOptions options)
    {
        private readonly List<DrawingPathResponse> _paths = [];
        private readonly List<DrawingTextResponse> _text = [];
        private readonly Dictionary<string, DrawingLayerResponse> _layers = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> _warnings = new(StringComparer.OrdinalIgnoreCase);
        private double _minX = double.PositiveInfinity, _minY = double.PositiveInfinity, _maxX = double.NegativeInfinity, _maxY = double.NegativeInfinity;
        private int _segmentCount;

        public void Add(Entity entity)
        {
            var layerId = entity.Layer?.Name ?? "0";
            if (!_layers.ContainsKey(layerId)) _layers[layerId] = new DrawingLayerResponse(layerId, layerId, true, "#26383b");
            var style = new DrawingStyleResponse("#26383b", 0);
            switch (entity)
            {
                case Line line:
                    AddPath(layerId, style, false, [LineSegment(line.StartPoint.X, line.StartPoint.Y, line.EndPoint.X, line.EndPoint.Y)]);
                    break;
                case Arc arc:
                    AddPath(layerId, style, false, [new DrawingSegmentResponse("arc", Center: Point(arc.Center.X, arc.Center.Y), Radius: arc.Radius, StartAngle: arc.StartAngle, EndAngle: arc.EndAngle)]);
                    IncludeArcBounds(arc.Center.X, arc.Center.Y, arc.Radius, arc.Radius, arc.StartAngle, arc.EndAngle);
                    break;
                case Circle circle:
                    AddPath(layerId, style, true, [new DrawingSegmentResponse("arc", Center: Point(circle.Center.X, circle.Center.Y), Radius: circle.Radius, StartAngle: 0, EndAngle: Math.PI * 2)]);
                    Include(circle.Center.X - circle.Radius, circle.Center.Y - circle.Radius);
                    Include(circle.Center.X + circle.Radius, circle.Center.Y + circle.Radius);
                    break;
                case LwPolyline polyline:
                    AddPolyline(layerId, style, polyline.Vertices.Select(vertex => Point(vertex.Location.X, vertex.Location.Y)).ToArray(), polyline.IsClosed);
                    break;
                case TextEntity text:
                    AddText(layerId, style, text.Value, text.InsertPoint.X, text.InsertPoint.Y, text.Height, text.Rotation);
                    break;
                case MText text:
                    AddText(layerId, style, text.PlainText, text.InsertPoint.X, text.InsertPoint.Y, text.Height, text.Rotation);
                    break;
                default:
                    Warn("unsupported-entity");
                    break;
            }
        }

        public DrawingContent Build()
        {
            if (!_paths.Any() && !_text.Any())
                throw new DrawingPreviewException("drawing-empty", "The DXF contains no renderable two-dimensional geometry.", StatusCodes.Status422UnprocessableEntity);
            return new DrawingContent(null, new DrawingBoundsResponse(_minX, _minY, _maxX, _maxY), _layers.Values.ToArray(), _paths, _text,
                _warnings.Select(pair => new DrawingWarningResponse(pair.Key, pair.Value)).ToArray());
        }

        private void AddPolyline(string layerId, DrawingStyleResponse style, IReadOnlyList<DrawingPointResponse> vertices, bool closed)
        {
            if (vertices.Count < 2) return;
            var segments = new List<DrawingSegmentResponse>();
            for (var index = 1; index < vertices.Count; index++) segments.Add(LineSegment(vertices[index - 1], vertices[index]));
            if (closed) segments.Add(LineSegment(vertices[^1], vertices[0]));
            AddPath(layerId, style, closed, segments);
        }

        private void AddText(string layerId, DrawingStyleResponse style, string? value, double x, double y, double height, double rotation)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            _text.Add(new DrawingTextResponse(layerId, style, value, Point(x, y), Math.Max(height, 1), rotation));
            Include(x, y);
            Include(x + Math.Max(height, 1) * Math.Max(1, value.Length) * .6, y + Math.Max(height, 1));
        }

        private void AddPath(string layerId, DrawingStyleResponse style, bool closed, IReadOnlyList<DrawingSegmentResponse> segments)
        {
            if (!segments.Count.Equals(0))
            {
                _segmentCount += segments.Count;
                if (_segmentCount > options.MaxSegments)
                    throw new DrawingPreviewException("drawing-too-complex", "The DXF contains too much geometry for an interactive preview.", StatusCodes.Status422UnprocessableEntity);
                _paths.Add(new DrawingPathResponse(layerId, style, closed, segments));
                foreach (var segment in segments)
                {
                    if (segment.Start is not null) Include(segment.Start.X, segment.Start.Y);
                    if (segment.End is not null) Include(segment.End.X, segment.End.Y);
                }
            }
        }

        private void IncludeArcBounds(double x, double y, double radiusX, double radiusY, double start, double end)
        {
            Include(x + radiusX * Math.Cos(start), y + radiusY * Math.Sin(start));
            Include(x + radiusX * Math.Cos(end), y + radiusY * Math.Sin(end));
            foreach (var angle in new[] { 0d, Math.PI / 2, Math.PI, Math.PI * 1.5 })
                if (AngleWithinSweep(angle, start, end)) Include(x + radiusX * Math.Cos(angle), y + radiusY * Math.Sin(angle));
        }

        private static bool AngleWithinSweep(double angle, double start, double end)
        {
            while (end < start) end += Math.PI * 2;
            while (angle < start) angle += Math.PI * 2;
            return angle <= end;
        }
        private void Include(double x, double y) { _minX = Math.Min(_minX, x); _minY = Math.Min(_minY, y); _maxX = Math.Max(_maxX, x); _maxY = Math.Max(_maxY, y); }
        private void Warn(string code) => _warnings[code] = _warnings.GetValueOrDefault(code) + 1;
        private static DrawingPointResponse Point(double x, double y) => new(x, y);
        private static DrawingSegmentResponse LineSegment(double x1, double y1, double x2, double y2) => new("line", Point(x1, y1), Point(x2, y2));
        private static DrawingSegmentResponse LineSegment(DrawingPointResponse start, DrawingPointResponse end) => new("line", start, end);
    }
}
