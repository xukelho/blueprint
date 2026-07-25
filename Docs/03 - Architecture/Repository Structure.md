# Repository Structure

**Status:** Draft  
**Owner:** Engineering  
**Last updated:** 2026-07-25

## Purpose

This document defines the intended source-repository structure for the architecture revision collaboration platform.

The structure supports a modular monolith, a separate IFC processing worker, shared contracts, automated tests and repeatable deployment. It describes ownership and dependency boundaries rather than requiring every directory to exist before it contains useful code.

## Audience

This document is intended for:

- Software engineers
- Quality assurance engineers
- Technical leadership
- DevOps and operations contributors

## Related Documents

- `Architecture Overview.md`
- `Technology Stack.md`
- `Architecture Principles.md`
- `Product Requirements.md`

## Repository Strategy

The MVP will use one repository for the web client, application API, processing worker, tests, infrastructure configuration and technical documentation.

A monorepository is appropriate because:

- The product has one delivery team and one release objective.
- API, client and worker contracts evolve together.
- End-to-end changes can be reviewed atomically.
- Shared quality checks and local orchestration remain easier to maintain.
- The system does not yet require independent product release cycles.

The monorepository does not permit arbitrary imports between components. Deployable applications remain independently buildable.

## Proposed Top-Level Structure

```text
/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ web/
â”‚   â”œâ”€â”€ api/
â”‚   â””â”€â”€ ifc-worker/
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ api-contract/
â”‚   â”œâ”€â”€ review-format/
â”‚   â””â”€â”€ test-support/
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ integration/
â”‚   â”œâ”€â”€ end-to-end/
â”‚   â”œâ”€â”€ architecture/
â”‚   â””â”€â”€ fixtures/
â”œâ”€â”€ infrastructure/
â”‚   â”œâ”€â”€ compose/
â”‚   â”œâ”€â”€ deployment/
â”‚   â”œâ”€â”€ observability/
â”‚   â””â”€â”€ scripts/
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ product/
â”‚   â”œâ”€â”€ architecture/
â”‚   â”œâ”€â”€ decisions/
â”‚   â”œâ”€â”€ operations/
â”‚   â””â”€â”€ api/
â”œâ”€â”€ .github/
â”‚   â””â”€â”€ workflows/
â”œâ”€â”€ .editorconfig
â”œâ”€â”€ .gitignore
â”œâ”€â”€ README.md
â””â”€â”€ compose.yaml
```

Names may be adapted to the selected CI provider or build tooling, but the responsibility boundaries should remain.

## Applications

### `apps/web`

Contains the browser application.

Suggested internal structure:

```text
apps/web/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ features/
â”‚   â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ api/
â”‚   â”œâ”€â”€ review/
â”‚   â”œâ”€â”€ auth/
â”‚   â”œâ”€â”€ styles/
â”‚   â””â”€â”€ utilities/
â”œâ”€â”€ public/
â”œâ”€â”€ tests/
â””â”€â”€ package.json
```

Responsibilities:

- Application shell and routing
- Product feature interfaces
- API client integration
- 2D review rendering and interaction
- Accessibility and responsive behaviour
- Client-side error and loading states

Product features should be grouped by capability rather than by generic file type. For example, project pages, queries and components should live close to the project feature instead of being scattered across global `pages`, `hooks` and `services` directories.

Shared visual components should remain presentation-focused. Business rules must not migrate into a generic component library.

### `apps/api`

Contains the ASP.NET Core application and modular-monolith business logic.

Suggested internal structure:

```text
apps/api/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ Api/
â”‚   â”œâ”€â”€ Modules/
â”‚   â”‚   â”œâ”€â”€ Identity/
â”‚   â”‚   â”œâ”€â”€ Practices/
â”‚   â”‚   â”œâ”€â”€ Projects/
â”‚   â”‚   â”œâ”€â”€ Revisions/
â”‚   â”‚   â”œâ”€â”€ ReviewMatters/
â”‚   â”‚   â”œâ”€â”€ Approvals/
â”‚   â”‚   â”œâ”€â”€ Notifications/
â”‚   â”‚   â””â”€â”€ Audit/
â”‚   â”œâ”€â”€ SharedKernel/
â”‚   â””â”€â”€ Infrastructure/
â””â”€â”€ tests/
    â”œâ”€â”€ Unit/
    â”œâ”€â”€ Integration/
    â””â”€â”€ Architecture/
```

Each business module may contain:

- Domain entities and value objects
- Commands, queries and application services
- Validation
- Persistence mappings
- Module-specific endpoints
- Events and handlers
- Unit and integration tests

The precise folder names may follow the selected .NET solution conventions. The required outcome is that business capabilities remain recognisable and dependencies remain enforceable.

### `apps/ifc-worker`

Contains the isolated IFC processing application.

Suggested internal structure:

```text
apps/ifc-worker/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ jobs/
â”‚   â”œâ”€â”€ processing/
â”‚   â”œâ”€â”€ extractors/
â”‚   â”œâ”€â”€ exporters/
â”‚   â”œâ”€â”€ manifests/
â”‚   â”œâ”€â”€ storage/
â”‚   â””â”€â”€ diagnostics/
â”œâ”€â”€ tests/
â””â”€â”€ fixtures/
```

Responsibilities:

- Claiming durable processing jobs
- Loading the source IFC file
- Validating the supported profile
- Extracting the required data
- Generating 2D assets and a versioned manifest
- Writing derived objects
- Recording processing results

The worker must not contain project-facing HTTP endpoints or business operations such as publication and approval.

If the worker is implemented in .NET, it may share solution-level build tooling with the API. If it is implemented in Python, it must have its own locked dependencies, linting, tests and container build.

## Shared Packages

Shared packages are permitted only for stable contracts or infrastructure-independent utilities.

### `packages/api-contract`

Contains generated or source-controlled API contract artefacts used by the web client and tests.

The OpenAPI document generated by the API remains the authoritative external HTTP contract. Generated client code must not be edited manually.

### `packages/review-format`

Contains the versioned schema for IFC-derived review manifests and contextual references.

This package may provide:

- JSON Schema
- TypeScript types
- .NET models
- Python models
- Compatibility fixtures

The format must be language-neutral. One applicationâ€™s internal classes must not become the cross-runtime contract by accident.

### `packages/test-support`

Contains bounded, reusable test builders or local-environment helpers.

It must not become a dumping ground for production business logic or broad utility code.

## Tests

### Component-local tests

Unit and focused integration tests should live beside the application they verify. This keeps ownership clear and allows each application to run its tests independently.

### Repository-level tests

`tests/` contains tests that cross deployable boundaries:

- End-to-end collaboration workflows
- API and review-manifest compatibility
- Authorisation matrix tests
- Database and object-storage integration
- Container and deployment smoke tests
- Architecture dependency rules

### Fixtures

Small, synthetic and licence-safe fixtures may be committed to `tests/fixtures`.

Representative IFC files must:

- Contain no confidential client information
- Have a documented source and permitted use
- Be small enough for normal repository operations
- Include expected processing results where practical

Large fixtures should use a documented external test-data mechanism with integrity hashes. Secrets and real production data must never be used as fixtures.

## Infrastructure

### `infrastructure/compose`

Contains local orchestration overrides, service configuration and development-only dependencies.

### `infrastructure/deployment`

Contains hosting-specific deployment definitions selected for the pilot. It should not contain secrets.

### `infrastructure/observability`

Contains dashboards, collector configuration, alerts and local observability setup.

### `infrastructure/scripts`

Contains non-destructive operational and developer scripts with documented inputs. Scripts that mutate production data require explicit safety controls and operational documentation.

Database migrations belong with the application that owns the database model, not in a generic script directory.

## Documentation

### `docs/product`

Contains the product definition, including:

- Vision and problem statement
- Goals and non-goals
- Target users
- MVP scope
- Core workflows
- Product requirements
- Success metrics
- Roadmap

### `docs/architecture`

Contains the current architecture overview, stack, repository structure, principles and relevant diagrams.

### `docs/decisions`

Contains architecture decision records using sequential identifiers:

```text
0001-use-modular-monolith.md
0002-use-minio-for-initial-object-storage.md
0003-select-ifc-processing-toolchain.md
```

Each record should state the context, decision, alternatives, consequences and status.

### `docs/operations`

Contains runbooks for:

- Deployment and rollback
- Backup and restoration
- Failed upload or processing diagnosis
- User and project support
- Incident response
- Data retention and deletion

### `docs/api`

Contains human-authored API guidance and generated contract outputs where keeping them in version control is useful.

## Dependency Rules

The repository must enforce the following direction:

- The web application depends on public API and review-format contracts, not API internals.
- The API does not depend on the web application.
- Domain and application code do not depend on HTTP controllers or concrete providers.
- Infrastructure implements interfaces defined by the owning application or module.
- Business modules interact through explicit application contracts or events.
- The worker depends on the review-format contract and its processing infrastructure, not on web code.
- Tests may depend on production applications; production applications must not depend on test projects.
- Shared packages must not depend on deployable applications.

Circular module dependencies are not permitted.

## Configuration and Secrets

Configuration follows environment-specific overrides with validated startup options.

The repository may contain:

- Example environment files without credentials
- Safe local defaults
- Configuration schemas
- Secret names and setup instructions

The repository must not contain:

- Passwords
- Private keys
- API tokens
- Production connection strings
- Signed object-storage URLs
- Real client data

Applications should fail clearly at startup when required configuration is missing.

## Build and Tooling Conventions

The repository root should provide a small set of documented commands for:

- Starting the local environment
- Installing or restoring dependencies
- Building all applications
- Running formatting and static analysis
- Running unit, integration and end-to-end tests
- Creating and applying database migrations
- Building container images
- Validating generated contracts

Language-specific tools remain within their application directories. Root commands may orchestrate them but should not obscure how each application is built.

Dependency lock files must be committed. Generated build output, local databases, credentials and temporary IFC-processing artefacts must be ignored.

## Ownership and Change Rules

- Changes to a public API contract must update affected client and integration tests.
- Changes to the review manifest must be versioned and tested across API, worker and web.
- Database changes require a migration and rollback or recovery consideration.
- Material dependency changes require security and licence review.
- Changes to architectural boundaries require an architecture decision record.
- Documentation should be updated in the same change as the behaviour it describes.

## Structure Evolution

A new service or repository should be introduced only when there is evidence of:

- A genuinely independent release lifecycle
- Conflicting runtime or security requirements that cannot be isolated within the repository
- A need for independent ownership
- Material scaling requirements
- Repository size or build performance that cannot be addressed more simply

Splitting code is a migration decision, not a prerequisite for implementing clean boundaries.
