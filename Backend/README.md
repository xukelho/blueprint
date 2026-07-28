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

## User data model

Every user has a required role from `user_roles`. The available roles are
`platform admin`, `client`, `company`, and `architect`. Existing users are
assigned the `platform admin` role when the role migration is applied.

Role-specific details are stored in `clients`, `companies`, and `architects`.
Each profile has a unique `user_id`, so a user can have at most one record in
each profile table. Deleting a user deletes its associated profile records.

## Endpoints

- `GET /api/health` returns `200` and `{"status":"healthy"}`.
- `POST /api/auth/login` accepts `{"username":"...","password":"..."}`.
  It returns `200` and `{"status":"success"}` for valid credentials, or `401`
  and `{"status":"fail"}` otherwise.
- `POST /api/auth/logout` ends the current authentication flow and returns
  `200` and `{"status":"success"}`.
- `/api/admin/users` supports `GET`, `POST`, `PUT /{id}`, and `DELETE /{id}`.
  User passwords are hashed when created or changed and are never returned.
- `/api/admin/clients`, `/api/admin/architects`, and `/api/admin/companies`
  support `GET`, `POST`, `PUT /{id}`, and `DELETE /{id}`. A profile can only
  be created for an existing user with the corresponding role. Its `userId`
  is immutable after creation.
- Deleting a user also deletes its client, architect, or company profile.
  Deleting a profile leaves the central user record in place.
- `GET /openapi/v1.json` exposes the generated OpenAPI contract.
