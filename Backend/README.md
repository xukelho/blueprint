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

## Clean-slate migration reset

The obsolete `AddUserRolesAndProfiles` migration was replaced rather than
upgraded because this application is still in its initial development phase.
Before running the new migration against an existing development database,
manually return that database to the state immediately after `InitialCreate`:

- Drop `architects`, `clients`, `companies`, and the old role lookup
  `user_roles`, including their foreign keys and indexes.
- Drop the `users.role_id` foreign key, index, and column.
- Delete existing rows from `users`; the retained table is schema only, and the
  development administrator will be bootstrapped again on the next startup.
- Remove the `AddUserRolesAndProfiles` row from `__EFMigrationsHistory`.
- Preserve the `users` table and the `InitialCreate` history row.

An empty database needs no manual preparation; both retained migrations apply
normally. No data-preservation path is provided for the obsolete schema.

## User and company data model

`users` is the central authentication and audit table. Roles are stored in
`roles`, with the many-to-many assignments in `user_roles`. The seeded roles
are `platform admin`, `client`, `employee`, and `architect`.

The supported account categories are:

- A platform administrator has only the `platform admin` role and no profile.
- A client has the `client` role and exactly one row in `clients`.
- An employee has the `employee` role and exactly one row in `employees`.
  Employees may additionally have the `architect` role.

Every employee belongs to one company. A client may belong to one company or
remain independent. Companies are not users and do not receive credentials.
Deleting an employee or client deletes its central user and role assignments.

Company deletion is soft deletion through `is_active`. It preserves employees,
clients, and authentication access. Inactive companies cannot be edited or
selected for a new association, and restoring one requires direct database
intervention. Existing linked accounts will eventually have read-only access
to company projects; that rule must be enforced when project write endpoints
and authenticated request identity are introduced.

## Endpoints

- `GET /api/health` returns `200` and `{"status":"healthy"}`.
- `POST /api/auth/login` accepts `{"username":"...","password":"..."}`.
  Successful responses contain an ordered `roles` array. Invalid credentials
  return `401`.
- `POST /api/auth/logout` returns `200` and `{"status":"success"}`.
- `GET /api/admin/roles` returns the read-only role catalogue.
- `/api/admin/users` supports account-level `GET`, `PUT /{id}`, and
  `DELETE /{id}`. `POST` creates a platform administrator.
- `/api/admin/employees` and `/api/admin/clients` support `GET`, `POST`,
  `PUT /{id}`, and `DELETE /{id}`. Creation atomically writes the central user,
  required roles, and profile. Profile deletion removes the whole account.
- `/api/admin/companies` supports `GET`, `POST`, `PUT /{id}`, and
  `DELETE /{id}`. Lists hide inactive companies unless
  `includeInactive=true`; `DELETE` is idempotent and sets `is_active=false`.
- `GET /openapi/v1.json` exposes the generated OpenAPI contract.

## Integration tests

The integration tests create an isolated database, start the real API, and
remove the database afterwards. PostgreSQL must be available. By default they
use the development instance on port `5837`; override the administrative
connection when needed:

```powershell
$env:BLUEPRINT_TEST_ADMIN_CONNECTION = "Host=localhost;Port=5837;Database=postgres;Username=blueprint;Password=blueprint_dev_password"
dotnet test Backend.Tests/Blueprint.Api.IntegrationTests.csproj
```
