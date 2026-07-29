using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Npgsql;

namespace Blueprint.Api.IntegrationTests;

public sealed class PostgreSqlApiFixture : IAsyncLifetime
{
    private readonly string _databaseName =
        $"blueprint_test_{Guid.NewGuid():N}";
    private Process? _apiProcess;
    private string _adminConnectionString = string.Empty;
    private readonly StringBuilder _apiOutput = new();

    public HttpClient Client { get; private set; } = null!;

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        _adminConnectionString =
            Environment.GetEnvironmentVariable("BLUEPRINT_TEST_ADMIN_CONNECTION")
            ?? "Host=localhost;Port=5837;Database=postgres;Username=blueprint;Password=blueprint_dev_password";

        var databaseConnection = new NpgsqlConnectionStringBuilder(
            _adminConnectionString)
        {
            Database = _databaseName,
            Pooling = false
        };
        ConnectionString = databaseConnection.ConnectionString;

        await using (var adminConnection = new NpgsqlConnection(_adminConnectionString))
        {
            await adminConnection.OpenAsync();
            await using var createDatabase = adminConnection.CreateCommand();
            createDatabase.CommandText = $"CREATE DATABASE \"{_databaseName}\"";
            await createDatabase.ExecuteNonQueryAsync();
        }

        var port = GetAvailablePort();
        var baseAddress = new Uri($"http://127.0.0.1:{port}");
        var apiAssembly = typeof(Program).Assembly.Location;
        var startInfo = new ProcessStartInfo
        {
            FileName = Environment.GetEnvironmentVariable("DOTNET_HOST_PATH")
                ?? "dotnet",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add(apiAssembly);
        startInfo.ArgumentList.Add("--urls");
        startInfo.ArgumentList.Add(baseAddress.ToString());
        startInfo.Environment["ConnectionStrings__DefaultConnection"] =
            ConnectionString;
        startInfo.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
        startInfo.Environment["Logging__EventLog__LogLevel__Default"] = "None";

        _apiProcess = Process.Start(startInfo)
            ?? throw new InvalidOperationException("The API process could not be started.");
        _apiProcess.OutputDataReceived += (_, eventArgs) =>
        {
            if (eventArgs.Data is not null)
            {
                _apiOutput.AppendLine(eventArgs.Data);
            }
        };
        _apiProcess.ErrorDataReceived += (_, eventArgs) =>
        {
            if (eventArgs.Data is not null)
            {
                _apiOutput.AppendLine(eventArgs.Data);
            }
        };
        _apiProcess.BeginOutputReadLine();
        _apiProcess.BeginErrorReadLine();

        Client = new HttpClient { BaseAddress = baseAddress };
        await WaitForApiAsync();
    }

    public async Task DisposeAsync()
    {
        Client?.Dispose();

        if (_apiProcess is { HasExited: false })
        {
            _apiProcess.Kill(entireProcessTree: true);
            await _apiProcess.WaitForExitAsync();
        }
        _apiProcess?.Dispose();

        NpgsqlConnection.ClearAllPools();
        if (string.IsNullOrEmpty(_adminConnectionString))
        {
            return;
        }

        await using var adminConnection = new NpgsqlConnection(_adminConnectionString);
        await adminConnection.OpenAsync();
        await using var terminateConnections = adminConnection.CreateCommand();
        terminateConnections.CommandText =
            """
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = @databaseName
              AND pid <> pg_backend_pid();
            """;
        terminateConnections.Parameters.AddWithValue("databaseName", _databaseName);
        await terminateConnections.ExecuteNonQueryAsync();

        await using var dropDatabase = adminConnection.CreateCommand();
        dropDatabase.CommandText = $"DROP DATABASE IF EXISTS \"{_databaseName}\"";
        await dropDatabase.ExecuteNonQueryAsync();
    }

    private async Task WaitForApiAsync()
    {
        var deadline = DateTimeOffset.UtcNow.AddSeconds(30);
        while (DateTimeOffset.UtcNow < deadline)
        {
            if (_apiProcess?.HasExited == true)
            {
                throw new InvalidOperationException(
                    $"The API exited with code {_apiProcess.ExitCode}.{Environment.NewLine}{_apiOutput}");
            }

            try
            {
                using var response = await Client.GetAsync("/api/health");
                if (response.StatusCode == HttpStatusCode.OK)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
                // Kestrel is still starting.
            }

            await Task.Delay(100);
        }

        throw new TimeoutException("The API did not become healthy within 30 seconds.");
    }

    private static int GetAvailablePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }
}
