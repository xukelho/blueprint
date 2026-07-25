using Blueprint.Api.Authentication;
using Blueprint.Api.Data;
using Blueprint.Api.Endpoints;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is required.");

builder.Services.AddDbContext<BlueprintDbContext>(
    options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<ICredentialValidator, DatabaseCredentialValidator>();

var app = builder.Build();

await DatabaseInitializer.InitializeAsync(app.Services);

app.MapOpenApi();
app.MapHealthEndpoints();
app.MapAuthenticationEndpoints();

app.Run();

public partial class Program;
