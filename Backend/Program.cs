using Blueprint.Api.Authentication;
using Blueprint.Api.Data;
using Blueprint.Api.Endpoints;
using Blueprint.Api.Services;
using Blueprint.Api.Storage;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is required.");

builder.Services.AddDbContext<BlueprintDbContext>(
    options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<ICredentialValidator, DatabaseCredentialValidator>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddObjectStorage(builder.Configuration);
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.Configure<DrawingPreviewOptions>(builder.Configuration.GetSection(DrawingPreviewOptions.SectionName));
builder.Services.AddSingleton<IDrawingSourceParser, DxfDrawingSourceParser>();
builder.Services.AddScoped<DrawingPreviewService>();
builder.Services.AddScoped<ProjectPhaseService>();
builder.Services.AddScoped<PhaseRemovalService>();
builder.Services.AddScoped<FileMaintenanceProcessor>();
builder.Services.AddHostedService<ClientInvitationExpiryService>();
builder.Services.AddHostedService<FileMaintenanceService>();
if (builder.Environment.IsEnvironment("Testing"))
{
    builder.Services.AddSingleton<IDataProtectionProvider>(
        new EphemeralDataProtectionProvider());
}
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "blueprint.session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

await DatabaseInitializer.InitializeAsync(app.Services);

app.MapOpenApi();
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthEndpoints();
app.MapAuthenticationEndpoints();
app.MapAdministrationEndpoints();
app.MapProfileEndpoints();
app.MapCompanyEndpoints();
app.MapCompanyMemberEndpoints();
app.MapProjectEndpoints();
app.MapProjectDocumentEndpoints();
app.MapClientManagementEndpoints();
app.MapClientInvitationEndpoints();

app.Run();

public partial class Program;
