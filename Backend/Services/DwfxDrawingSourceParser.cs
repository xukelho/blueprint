using System.Globalization;
using System.IO.Compression;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Blueprint.Api.Contracts;

namespace Blueprint.Api.Services;

/// <summary>Reads the XPS vector pages embedded in a DWFX package into the neutral drawing contract.</summary>
public sealed partial class DwfxDrawingSourceParser : IDrawingSourceParser
{
    public string SourceFormat => "dwfx";

    public Task<DrawingContent> ParseAsync(Stream source, DrawingPreviewOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            using var package = new ZipArchive(source, ZipArchiveMode.Read, leaveOpen: true);
            var builder = new Builder(options);
            long expandedPageBytes = 0;
            foreach (var page in package.Entries.Where(entry => entry.FullName.EndsWith(".fpage", StringComparison.OrdinalIgnoreCase)))
            {
                cancellationToken.ThrowIfCancellationRequested();
                expandedPageBytes = checked(expandedPageBytes + page.Length);
                if (expandedPageBytes > options.MaxSourceBytes)
                    throw new DrawingPreviewException("drawing-too-large", "The DWFX page exceeds the preview size limit.", StatusCodes.Status413PayloadTooLarge);
                using var pageStream = page.Open();
                using var xml = XmlReader.Create(pageStream, new XmlReaderSettings
                {
                    DtdProcessing = DtdProcessing.Prohibit,
                    MaxCharactersInDocument = Math.Max(options.MaxSourceBytes, 1),
                    XmlResolver = null
                });
                builder.AddPage(XDocument.Load(xml), cancellationToken);
            }
            return Task.FromResult(builder.Build());
        }
        catch (DrawingPreviewException) { throw; }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new DrawingPreviewException("drawing-invalid", "The DWFX file could not be parsed.", StatusCodes.Status422UnprocessableEntity);
        }
    }

    private sealed class Builder(DrawingPreviewOptions options)
    {
        private const string LayerId = "dwfx-page";
        private readonly List<DrawingPathResponse> _paths = [];
        private readonly List<DrawingTextResponse> _text = [];
        private double _minX = double.PositiveInfinity, _minY = double.PositiveInfinity, _maxX = double.NegativeInfinity, _maxY = double.NegativeInfinity;
        private int _segmentCount;

        public void AddPage(XDocument page, CancellationToken cancellationToken)
        {
            if (page.Root is null) return;
            // XPS coordinates grow downward; normalize them to the CAD-style Y-up contract used by the viewer.
            var height = Number((string?)page.Root.Attribute("Height"));
            AddElement(page.Root, new Transform(1, 0, 0, -1, 0, height), cancellationToken);
        }

        private void AddElement(XElement element, Transform parent, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var transform = Transform.Parse((string?)element.Attribute("RenderTransform")).Then(parent);
            switch (element.Name.LocalName)
            {
                case "Path": AddPath(element, transform); break;
                case "Glyphs": AddGlyph(element, transform); break;
            }
            foreach (var child in element.Elements()) AddElement(child, transform, cancellationToken);
        }

        private void AddPath(XElement element, Transform transform)
        {
            var data = (string?)element.Attribute("Data");
            if (string.IsNullOrWhiteSpace(data)) return;
            var segments = ParsePath(data, transform);
            if (segments.Count == 0) return;
            AddSegments(segments.Count);
            var stroke = Color((string?)element.Attribute("Stroke"), "#26383b")!;
            var fillValue = (string?)element.Attribute("Fill");
            var fill = string.IsNullOrWhiteSpace(fillValue) ? null : Color(fillValue, null);
            var weight = Number((string?)element.Attribute("StrokeThickness"), 1) * transform.Scale;
            _paths.Add(new DrawingPathResponse(LayerId, new DrawingStyleResponse(stroke, weight, Fill: fill), false, segments));
        }

        private void AddGlyph(XElement element, Transform transform)
        {
            var value = (string?)element.Attribute("UnicodeString");
            if (string.IsNullOrEmpty(value)) return;
            var position = transform.Apply(Number((string?)element.Attribute("OriginX")), Number((string?)element.Attribute("OriginY")));
            var height = Math.Max(1, Number((string?)element.Attribute("FontRenderingEmSize"), 12) * transform.Scale);
            var color = Color((string?)element.Attribute("Fill"), "#26383b")!;
            _text.Add(new DrawingTextResponse(LayerId, new DrawingStyleResponse(color, 0), value, position, height, transform.Rotation));
            Include(position);
            Include(new DrawingPointResponse(position.X + height * value.Length * .6, position.Y + height));
        }

        public DrawingContent Build()
        {
            if (_paths.Count == 0 && _text.Count == 0)
                throw new DrawingPreviewException("drawing-empty", "The DWFX contains no renderable two-dimensional geometry.", StatusCodes.Status422UnprocessableEntity);
            return new DrawingContent(null, new DrawingBoundsResponse(_minX, _minY, _maxX, _maxY),
                [new DrawingLayerResponse(LayerId, "DWFX", true, "#26383b")], _paths, _text, []);
        }

        private List<DrawingSegmentResponse> ParsePath(string data, Transform transform)
        {
            var tokens = PathToken().Matches(data).Select(match => match.Value).ToArray();
            var result = new List<DrawingSegmentResponse>();
            var index = 0;
            char command = '\0';
            var current = new Point(0, 0);
            var figureStart = current;
            while (index < tokens.Length)
            {
                if (char.IsLetter(tokens[index][0])) command = tokens[index++][0];
                if (command == '\0') throw new FormatException("A DWFX path command is missing.");
                var relative = char.IsLower(command);
                switch (char.ToUpperInvariant(command))
                {
                    case 'M':
                        current = ReadPoint(tokens, ref index, current, relative);
                        figureStart = current;
                        command = relative ? 'l' : 'L';
                        break;
                    case 'L': AddLine(result, current, current = ReadPoint(tokens, ref index, current, relative), transform); break;
                    case 'H':
                        var x = ReadNumber(tokens, ref index) + (relative ? current.X : 0);
                        AddLine(result, current, current = new Point(x, current.Y), transform);
                        break;
                    case 'V':
                        var y = ReadNumber(tokens, ref index) + (relative ? current.Y : 0);
                        AddLine(result, current, current = new Point(current.X, y), transform);
                        break;
                    case 'A':
                        var rx = ReadNumber(tokens, ref index); var ry = ReadNumber(tokens, ref index); var rotation = ReadNumber(tokens, ref index);
                        var large = ReadNumber(tokens, ref index) != 0; var sweep = ReadNumber(tokens, ref index) != 0;
                        var end = ReadPoint(tokens, ref index, current, relative);
                        AddArc(result, current, end, rx, ry, rotation, large, sweep, transform);
                        current = end;
                        break;
                    case 'Z':
                        AddLine(result, current, figureStart, transform); current = figureStart; command = '\0'; break;
                    default: throw new FormatException($"Unsupported DWFX path command '{command}'.");
                }
            }
            return result;
        }

        private void AddArc(List<DrawingSegmentResponse> result, Point start, Point end, double rx, double ry, double rotationDegrees, bool large, bool sweep, Transform transform)
        {
            rx = Math.Abs(rx); ry = Math.Abs(ry);
            if (rx == 0 || ry == 0 || (start.X == end.X && start.Y == end.Y)) { AddLine(result, start, end, transform); return; }
            var phi = rotationDegrees * Math.PI / 180;
            var cos = Math.Cos(phi); var sin = Math.Sin(phi);
            var dx = (start.X - end.X) / 2; var dy = (start.Y - end.Y) / 2;
            var xp = cos * dx + sin * dy; var yp = -sin * dx + cos * dy;
            var scale = xp * xp / (rx * rx) + yp * yp / (ry * ry);
            if (scale > 1) { var factor = Math.Sqrt(scale); rx *= factor; ry *= factor; }
            var numerator = Math.Max(0, rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp);
            var denominator = rx * rx * yp * yp + ry * ry * xp * xp;
            var coefficient = (large == sweep ? -1 : 1) * Math.Sqrt(denominator == 0 ? 0 : numerator / denominator);
            var cxp = coefficient * rx * yp / ry; var cyp = coefficient * -ry * xp / rx;
            var cx = cos * cxp - sin * cyp + (start.X + end.X) / 2;
            var cy = sin * cxp + cos * cyp + (start.Y + end.Y) / 2;
            var startAngle = Angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
            var delta = Angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
            if (!sweep && delta > 0) delta -= Math.PI * 2;
            if (sweep && delta < 0) delta += Math.PI * 2;
            var steps = Math.Max(4, (int)Math.Ceiling(Math.Abs(delta) / (Math.PI / 12)));
            var previous = start;
            for (var step = 1; step <= steps; step++)
            {
                var angle = startAngle + delta * step / steps;
                var next = new Point(cx + cos * rx * Math.Cos(angle) - sin * ry * Math.Sin(angle), cy + sin * rx * Math.Cos(angle) + cos * ry * Math.Sin(angle));
                AddLine(result, previous, next, transform); previous = next;
            }
        }

        private static double Angle(double ux, double uy, double vx, double vy) => Math.Atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        private void AddLine(List<DrawingSegmentResponse> result, Point start, Point end, Transform transform)
        {
            var transformedStart = transform.Apply(start.X, start.Y); var transformedEnd = transform.Apply(end.X, end.Y);
            result.Add(new DrawingSegmentResponse("line", transformedStart, transformedEnd));
            Include(transformedStart); Include(transformedEnd);
        }
        private void AddSegments(int count)
        {
            _segmentCount += count;
            if (_segmentCount > options.MaxSegments)
                throw new DrawingPreviewException("drawing-too-complex", "The DWFX contains too much geometry for an interactive preview.", StatusCodes.Status422UnprocessableEntity);
        }
        private void Include(DrawingPointResponse point) { _minX = Math.Min(_minX, point.X); _minY = Math.Min(_minY, point.Y); _maxX = Math.Max(_maxX, point.X); _maxY = Math.Max(_maxY, point.Y); }
        private static Point ReadPoint(string[] tokens, ref int index, Point current, bool relative)
        {
            var x = ReadNumber(tokens, ref index); var y = ReadNumber(tokens, ref index);
            return relative ? new Point(current.X + x, current.Y + y) : new Point(x, y);
        }
        private static double ReadNumber(string[] tokens, ref int index)
        {
            if (index >= tokens.Length || char.IsLetter(tokens[index][0])) throw new FormatException("A DWFX path argument is missing.");
            return double.Parse(tokens[index++], NumberStyles.Float, CultureInfo.InvariantCulture);
        }
        private static double Number(string? value, double fallback = 0) => double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ? number : fallback;
        private static string? Color(string? value, string? fallback)
        {
            if (string.IsNullOrWhiteSpace(value)) return fallback;
            if (value.StartsWith('{')) return fallback;
            return value.Length == 9 && value[0] == '#' ? $"#{value[3..]}" : value;
        }
    }

    private readonly record struct Point(double X, double Y);
    private readonly record struct Transform(double M11, double M12, double M21, double M22, double OffsetX, double OffsetY)
    {
        public static Transform Identity => new(1, 0, 0, 1, 0, 0);
        public double Scale => Math.Sqrt(Math.Abs(M11 * M22 - M12 * M21));
        public double Rotation => Math.Atan2(M12, M11);
        public DrawingPointResponse Apply(double x, double y) => new(x * M11 + y * M21 + OffsetX, x * M12 + y * M22 + OffsetY);
        public Transform Then(Transform parent) => new(
            M11 * parent.M11 + M12 * parent.M21, M11 * parent.M12 + M12 * parent.M22,
            M21 * parent.M11 + M22 * parent.M21, M21 * parent.M12 + M22 * parent.M22,
            OffsetX * parent.M11 + OffsetY * parent.M21 + parent.OffsetX,
            OffsetX * parent.M12 + OffsetY * parent.M22 + parent.OffsetY);
        public static Transform Parse(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return Identity;
            var numbers = value.Split([',', ' '], StringSplitOptions.RemoveEmptyEntries).Select(part => double.Parse(part, CultureInfo.InvariantCulture)).ToArray();
            return numbers.Length == 6 ? new Transform(numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5]) : throw new FormatException("Invalid DWFX transform.");
        }
    }

    [GeneratedRegex(@"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?", RegexOptions.CultureInvariant)]
    private static partial Regex PathToken();
}
