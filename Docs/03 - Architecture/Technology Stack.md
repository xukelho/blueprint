# Technology Stack

**Status:** Draft  
**Owner:** Engineering  
**Last updated:** 2026-07-25

## Purpose

This document defines the initial technology baseline for the architecture revision collaboration platform and identifies choices that still require technical validation.

The stack favours technologies that support rapid MVP delivery, strong typing, automated testing, asynchronous file processing and straightforward self-hosted development. A technology should not be introduced solely because it may be useful at hypothetical future scale.

## Audience

This document is intended for:

- Software engineers
- Technical leadership
- Security and operations contributors
- Quality assurance engineers

## Related Documents

- `Product Requirements.md`
- `Roadmap.md`
- `Architecture Overview.md`
- `Repository Structure.md`
- `Architecture Principles.md`

## Decision Status

The terms in this document have the following meaning:

| Status | Meaning |
| --- | --- |
| Selected | Part of the agreed initial implementation |
| Baseline | Recommended starting choice; confirm before implementation begins |
| Candidate | Requires a focused technical spike or architecture decision |
| Deferred | Not required for the MVP |

## Stack Summary

| Area | Technology | Status | Rationale |
| --- | --- | --- | --- |
| Web client | React with TypeScript | Baseline | Mature component ecosystem, typed client code and strong support for interactive review interfaces |
| Web build tooling | Vite | Baseline | Fast development workflow and a simple production build |
| Application API | ASP.NET Core Web API | Baseline | Strong authentication, validation, observability and background-service support within the teamâ€™s primary ecosystem |
| Application language | C# on a supported .NET release | Baseline | Strong typing, mature tooling and long-term maintainability |
| Relational database | PostgreSQL | Baseline | Reliable transactional storage, indexing and JSON support without changing the relational system of record |
| Data access | Entity Framework Core | Baseline | Version-controlled migrations and integration with the .NET application |
| Object storage | MinIO through the S3 API | Selected | Simple S3-compatible development and pilot storage; reassess before production launch |
| IFC processing | Isolated processing worker | Selected | Long-running and resource-intensive work must remain outside interactive API requests |
| IFC toolkit | IfcOpenShell or validated equivalent | Candidate | Broad IFC capability, subject to licensing, supported-schema and output-quality validation |
| Worker language | Python or .NET, selected by the IFC spike | Candidate | The IFC toolchain should drive the runtime decision rather than stack uniformity alone |
| Job persistence | PostgreSQL-backed durable jobs or a compatible job library | Candidate | Avoid a separate broker until workload evidence requires it |
| Email | Transactional email provider behind an application adapter | Candidate | Provider choice depends on pilot hosting, deliverability and regional requirements |
| Containers | Docker-compatible container images | Baseline | Repeatable local and hosted environments |
| Local orchestration | Docker Compose | Baseline | Sufficient for the initial multi-component development environment |
| CI/CD | Repository-hosted automated pipeline | Baseline | Repeatable builds, tests, scans, migrations and deployments |
| Observability | Structured logs, metrics and distributed traces using OpenTelemetry-compatible instrumentation | Baseline | Vendor-neutral diagnostics across the API and worker |
| Infrastructure as code | Lightweight, hosting-appropriate configuration | Candidate | Select after the pilot hosting environment is known |

No exact package or runtime version should be copied into this document. Versions must be pinned in the repository and updated through the dependency-management process.

## Web Client

### Baseline

- React
- TypeScript with strict type checking
- Vite
- Standards-based HTML and CSS
- A tested routing solution
- A small data-fetching and cache layer where required
- An accessible component approach

### Responsibilities

The web client handles:

- Project, revision and participant interfaces
- File selection and upload progress
- 2D review interaction
- Contextual feedback placement
- Approval and history views
- Accessible validation and error feedback

The client must not implement authoritative permission, revision-state or approval rules. It may hide unavailable actions for usability, but the API must independently reject unauthorised operations.

### Selection constraints

The 2D viewer implementation must be validated before adopting a large visualisation framework. The chosen approach must support:

- Pan and zoom
- Stable context references for feedback
- Responsive rendering of representative pilot assets
- Keyboard-accessible supporting controls
- Clear revision identity
- Graceful handling of unsupported content

Canvas, SVG or a specialised viewer library may be selected after the IFC processing spike establishes the asset format.

## Application API

### Baseline

- ASP.NET Core Web API
- C#
- Entity Framework Core
- OpenAPI documentation generated from the API contract
- Dependency injection through the platformâ€™s standard container
- Structured application configuration

### Application organisation

The API should be organised as a modular monolith by business capability:

- Identity and access
- Practices
- Projects
- Revisions
- Review matters
- Approvals
- Notifications
- Audit
- Administration

Modules may share infrastructure through explicit interfaces. Controllers or endpoints should remain thin and delegate business behaviour to application services.

### API contract

The HTTP API should:

- Use resource-oriented routes
- Return consistent error objects
- Validate inputs at the boundary
- Support idempotency for retry-sensitive operations
- Apply pagination to unbounded collections
- Keep internal storage keys and provider details private
- Generate an OpenAPI contract used by documentation and, where useful, typed client generation

REST is sufficient for the MVP. GraphQL is deferred unless a demonstrated client-query problem justifies it.

## Relational Data

### Baseline

- PostgreSQL
- Entity Framework Core migrations
- Database constraints for critical invariants
- UTC timestamps
- Application-generated opaque public identifiers where sequential internal identifiers would expose information

The relational database is authoritative for business state. Object storage contains file bytes, not business ownership or permission truth.

### Practices

- Every schema change is version controlled.
- Migrations run as an explicit deployment step.
- Production-like data is not embedded in migrations.
- Development seed data is isolated from production configuration.
- Concurrency-sensitive operations use database constraints or transactions.
- Queries involving project data include explicit access scope.
- Audit records are append-oriented.

PostgreSQL JSON columns may hold bounded metadata whose structure is external or variable, but they should not replace a clear relational model for core entities.

## Object Storage

### Selected implementation

MinIO will provide S3-compatible object storage during development and the initial pilot.

The application must access storage through a narrow adapter that supports:

- Creating controlled upload access
- Confirming object existence and metadata
- Opening authorised downloads
- Writing and reading generated assets
- Deleting only through explicit lifecycle procedures
- Health and connectivity checks

Buckets and objects must remain private. Short-lived signed URLs may be used after application authorisation. Object names should be generated, non-guessable and independent of user-supplied filenames.

The production storage choice will be reassessed before launch. Portability means using the required subset of the S3 API and configuration abstraction; it does not require supporting multiple providers simultaneously.

## IFC Processing

### Required architecture

IFC processing runs in a separate worker process. The worker receives a durable job reference, loads the source object, generates approved outputs and updates the processing result.

### Technical spike

Before selecting the final IFC toolchain, a spike must evaluate representative pilot files for:

- Supported IFC schema versions
- Parsing success and diagnostic quality
- Extraction of storeys, plans and relevant element metadata
- 2D output fidelity
- Stable element or coordinate references
- Processing time and peak memory
- Behaviour with malformed files
- Licensing and redistribution constraints
- Containerisation and operating-system dependencies

IfcOpenShell is the primary candidate, but the architecture does not declare it selected until this spike is completed.

### Output contract

The worker should produce a versioned manifest describing:

- Processor and output-format version
- Source revision identifier
- Available plans or views
- Asset locations
- Coordinate system and bounds
- Stable contextual identifiers where supported
- Warnings and unsupported content

Generated output formats should be web-compatible and cacheable. The browser must not need to parse the full original IFC file merely to complete the MVP review workflow.

## Background Jobs

The first job mechanism should provide:

- Durable job state
- Atomic claim or lease
- Retry with bounded backoff
- Attempt count and diagnostics
- Cancellation or supersession where safe
- Idempotent handlers
- Visibility into queued, running, succeeded and failed jobs

A PostgreSQL-backed mechanism is preferred initially because the database is already required. Redis, RabbitMQ, Kafka or a cloud queue should be added only when the chosen worker toolchain, reliability requirements or observed load provides a concrete reason.

## Authentication and Authorisation

The identity implementation remains a focused architecture decision.

The selected solution must support:

- Secure account authentication
- Verified invitation acceptance
- Password recovery or equivalent account recovery
- Session revocation
- Practice and project roles
- Auditable security events
- Future external identity integration without changing project ownership rules

Whether authentication is application-managed or delegated, project authorisation remains within the application.

Secrets must be supplied through environment-specific secret management. Passwords, tokens and connection strings must never be committed to the repository.

## Notifications

Email is the required MVP channel.

The application should define provider-neutral notification interfaces and versioned templates. Delivery is asynchronous and records:

- Notification type
- Intended recipient
- Related project context
- Delivery state
- Attempt count
- Provider reference where appropriate
- Failure information without storing sensitive provider payloads unnecessarily

The provider will be selected using deliverability, data-processing terms, regional availability, cost and developer experience.

## Testing Stack

The repository must support:

- Unit tests for domain and application rules
- Integration tests against PostgreSQL and MinIO-compatible storage
- API contract tests
- Worker tests using representative and deliberately invalid IFC fixtures
- Frontend component and interaction tests
- End-to-end tests for the critical collaboration cycle
- Authorisation tests for every role and project boundary
- Migration tests

Containerised test dependencies are preferred over mocks for storage and database integration. Large or sensitive pilot files must not be committed as ordinary test fixtures.

## Observability

The baseline includes:

- Structured, searchable logs
- Correlation identifiers across HTTP requests and processing jobs
- Metrics for request performance, failures, queue state and file processing
- Distributed traces where they materially improve diagnosis
- Health endpoints for the API, database, storage and worker
- Alerting appropriate to pilot operating hours

OpenTelemetry-compatible instrumentation is preferred to avoid binding application code to one monitoring vendor.

Sensitive file content, credentials, invitation tokens and personal data must not be written to logs.

## Development and Deployment

### Local development

Docker Compose should provide:

- PostgreSQL
- MinIO
- Application API
- Processing worker
- Optional local email capture
- Optional observability components

The web client may run either inside a container or through its native development server, provided the documented workflow remains consistent across the team.

### CI pipeline

Every change should pass:

- Formatting and static analysis
- Type checking
- Unit and integration tests
- Production builds
- Dependency and secret scanning
- Database migration validation
- Container-image build where relevant

### Deployment

The pilot hosting choice is open. It must support:

- Private network communication where appropriate
- Managed secrets
- Persistent PostgreSQL and object-storage data
- Independent worker restart
- TLS
- Backups
- Centralised logs
- Repeatable rollback

Kubernetes is not required for the MVP.

## Deferred Technologies

The following are intentionally not part of the initial stack:

- Microservice orchestration
- Kubernetes as a default
- Event-streaming platforms
- Elasticsearch or a separate search cluster
- Data warehouse and business-intelligence platform
- WebSockets for real-time co-editing
- Native mobile frameworks
- Full 3D rendering engine
- AI model infrastructure
- Multiple active object-storage providers

## Selection Criteria

Any proposed addition must be assessed against:

- Direct contribution to an MVP requirement
- Team familiarity and maintainability
- Security and privacy
- Operational burden
- Testability
- Licensing
- Portability where a future decision is already anticipated
- Measured performance using representative IFC files
- Cost during development, pilot and expected early production

Material choices and changes must be recorded in architecture decision records.
