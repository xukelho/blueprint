using Blueprint.Api.Services;

namespace Blueprint.Api.IntegrationTests;

public sealed class DrawingSampleParserTests
{
    public static IEnumerable<object[]> DxfSamples() => Samples("DXF", "*.dxf");
    public static IEnumerable<object[]> DwgSamples() => Samples("DWG", "*.dwg");
    public static IEnumerable<object[]> DwfxSamples() => Samples("DWFX", "*.dwfx");

    [Theory]
    [MemberData(nameof(DxfSamples))]
    public async Task StillParsesDxfSampleIntoNeutralDrawing(string path)
    {
        await using var source = File.OpenRead(path);
        var drawing = await new DxfDrawingSourceParser().ParseAsync(source, new DrawingPreviewOptions());

        AssertDrawing(drawing);
    }

    [Theory]
    [MemberData(nameof(DwgSamples))]
    public async Task ParsesDwgSampleIntoNeutralDrawing(string path)
    {
        await using var source = File.OpenRead(path);
        var drawing = await new DwgDrawingSourceParser().ParseAsync(source, new DrawingPreviewOptions());

        AssertDrawing(drawing);
    }

    [Theory]
    [MemberData(nameof(DwfxSamples))]
    public async Task ParsesDwfxSampleIntoNeutralDrawing(string path)
    {
        await using var source = File.OpenRead(path);
        var drawing = await new DwfxDrawingSourceParser().ParseAsync(source, new DrawingPreviewOptions());

        AssertDrawing(drawing);
    }

    private static IEnumerable<object[]> Samples(string folder, string pattern)
    {
        var directory = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Samples", folder));
        return Directory.GetFiles(directory, pattern, new EnumerationOptions { MatchCasing = MatchCasing.CaseInsensitive })
            .OrderBy(path => path)
            .Select(path => new object[] { path });
    }

    private static void AssertDrawing(DrawingContent drawing)
    {
        Assert.True(drawing.Paths.Count + drawing.Text.Count > 0);
        Assert.True(double.IsFinite(drawing.Bounds.MinX));
        Assert.True(double.IsFinite(drawing.Bounds.MinY));
        Assert.True(drawing.Bounds.MaxX > drawing.Bounds.MinX);
        Assert.True(drawing.Bounds.MaxY > drawing.Bounds.MinY);
    }
}
