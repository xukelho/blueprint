# Blueprint API

The API is an ASP.NET Core application targeting .NET 10.

## Run locally

Start PostgreSQL and configure the connection string:

```powershell
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5837;Database=blueprint;Username=blueprint;Password=blueprint_dev_password"
dotnet run --project Backend/Blueprint.Api.csproj
```

On startup, the API applies pending Entity Framework Core migrations. When the
`users` table is empty, it creates a development administrator with username
`admin` and password `admin`. The password is stored as a hash. These bootstrap
credentials are unsafe for production and must be replaced before deployment.

Audit actor ID `-999` identifies actions performed by the System. It is reserved
metadata and does not correspond to a row in `users`.

## Endpoints

- `GET /api/health` returns `200` and `{"status":"healthy"}`.
- `POST /api/auth/login` accepts `{"username":"...","password":"..."}`.
  It returns `200` and `{"status":"success"}` for valid credentials, or `401`
  and `{"status":"fail"}` otherwise.
- `GET /openapi/v1.json` exposes the generated OpenAPI contract.
