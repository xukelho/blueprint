using System.Text;
using Blueprint.Api.Services;

namespace Blueprint.Api.IntegrationTests;

public sealed class DxfDrawingSourceParserTests
{
    [Fact]
    public async Task ConvertsCommonPlanGeometryToTheNeutralDrawingContract()
    {
        const string dxf = """
            0
            SECTION
            2
            ENTITIES
            0
            LINE
            8
            Walls
            10
            0
            20
            0
            11
            120
            21
            80
            0
            CIRCLE
            8
            Furniture
            10
            60
            20
            40
            40
            12
            0
            ENDSEC
            0
            EOF
            """;
        await using var source = new MemoryStream(Encoding.UTF8.GetBytes(dxf));

        var drawing = await new DxfDrawingSourceParser().ParseAsync(source, new DrawingPreviewOptions());

        Assert.Equal(2, drawing.Paths.Count);
        Assert.NotEmpty(drawing.Layers);
        Assert.Equal(0, drawing.Bounds.MinX);
        Assert.Equal(120, drawing.Bounds.MaxX);
        Assert.Equal(80, drawing.Bounds.MaxY);
    }

    [Fact]
    public async Task RejectsDxfWithoutRenderablePlanGeometry()
    {
        const string dxf = "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n";
        await using var source = new MemoryStream(Encoding.UTF8.GetBytes(dxf));

        var exception = await Assert.ThrowsAsync<DrawingPreviewException>(() => new DxfDrawingSourceParser().ParseAsync(source, new DrawingPreviewOptions()));

        Assert.Equal("drawing-empty", exception.Code);
    }
}
