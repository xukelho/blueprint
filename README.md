# Blueprint

Blueprint is a browser-based collaboration platform for architecture professionals and their clients.

It provides a shared, revision-centred workspace where professionals can publish project revisions and clients can review them, provide contextual feedback and record decisions. The product is intended to improve clarity, traceability and confidence throughout the revision and approval process.

Blueprint does not replace CAD or BIM authoring software. It complements existing professional tools by centralising the collaboration that currently takes place across email, messaging applications, shared folders and meetings.

## Project Status

**Current phase:** Product definition and architecture  
**Documentation status:** Draft  
**Last updated:** 2026-07-25

Implementation has not yet started. Product assumptions, MVP boundaries and technical choices should be validated before they are treated as permanent decisions.

## Core Product Workflow

1. An architecture professional creates a project.
2. The professional uploads an IFC file as a new revision.
3. The platform processes the file and generates a browser-compatible 2D review representation.
4. The professional publishes the revision and invites the client.
5. The client reviews the revision and creates contextual comments or questions.
6. Participants discuss and resolve the matters raised.
7. The professional requests a decision when approval is required.
8. The platform preserves the revision, discussion and decision history.

## MVP Direction

The MVP is designed to validate one complete collaboration cycle on real architecture projects.

The initial product includes:

- Secure professional and client access
- Practice and project management
- IFC-based revision upload and asynchronous processing
- A limited browser-based 2D review experience
- Contextual comments, questions and replies
- Matter resolution and reopening
- Approval requests and recorded client decisions
- Revision and project history
- Notifications, audit records and essential operational controls

Advanced 3D visualisation, model editing, automatic revision comparison, billing, public sharing and native mobile applications are outside the initial MVP.

## Key Decisions

- The initial application will not use a formal multi-tenant architecture.
- Access boundaries must still be enforced between practices, projects and users.
- IFC is the primary project exchange format.
- The MVP review experience is focused on 2D views.
- Published revisions are immutable.
- MinIO is the selected S3-compatible object storage for development and the initial pilot.
- The primary application will begin as a modular monolith.
- IFC processing will run in a separate asynchronous worker.
- The initial repository will be a monorepository.

Technology marked as a baseline or candidate in the architecture documentation remains subject to validation before implementation.

## Documentation

### Product Foundation

- [Vision](Vision.md)
- [Problem Statement](Problem%20Statement.md)
- [Goals](Goals.md)
- [Non Goals](Non%20Goals.md)
- [Success Metrics](Success%20Metrics.md)
- [Target Users](Target%20Users.md)
- [MVP Scope](MVP%20Scope.md)
- [Core Workflows](Core%20Workflows.md)
- [Product Requirements](Product%20Requirements.md)
- [Roadmap](Roadmap.md)

### Architecture

- [Architecture Overview](03%20-%20Architecture/Architecture%20Overview.md)
- [Technology Stack](03%20-%20Architecture/Technology%20Stack.md)
- [Repository Structure](03%20-%20Architecture/Repository%20Structure.md)
- [Architecture Principles](03%20-%20Architecture/Architecture%20Principles.md)

## Documentation Conventions

- Documents are written in British English.
- Draft documents must show their status, owner and last-updated date.
- Product documents describe the problem, expected outcomes and required behaviour.
- Architecture documents describe system boundaries, technical direction and engineering constraints.
- Significant technical choices that require investigation should be recorded as architecture decision records.
- Requirements use stable identifiers so that design, implementation and tests can reference them.
- A document should link to related documents rather than duplicate their detailed content.

## Docker Commands

Run these commands from the repository root. `make start` and the individual
service start commands run in the foreground, just like `docker compose up`.
Use `Ctrl+C` to stop a foreground process.

| Command | Description |
| --- | --- |
| `make start` / `make up` | Start all services defined in `docker-compose.yml`. |
| `make stop` / `make down` | Stop and remove all Compose containers and networks. |
| `make restart` | Bring down all services, then start them again. |
| `make startdb` / `make updb` | Start only the `postgresdb` database service. |
| `make stopdb` | Stop only the database service. |
| `make downdb` | Stop and remove only the database container. Its named volume is retained. |
| `make restartdb` | Remove the database container, then start it again. |
| `make startapi` / `make upapi` | Start only the `blueprint-api` service. |
| `make stopapi` | Stop only the API service. |
| `make downapi` | Stop and remove only the API container. |
| `make restartapi` | Remove the API container, then start it again. |
| `make startfrontend` / `make upfrontend` | Start only the `blueprint-frontend` service. |
| `make stopfrontend` | Stop only the frontend service. |
| `make downfrontend` | Stop and remove only the frontend container. |
| `make restartfrontend` | Remove the frontend container, then start it again. |

Docker Compose cannot run `down` for just one service: its `down` command always
targets the whole project. The service-specific `down*` commands therefore stop
and remove that service's container, which provides the equivalent scoped result.

## Guiding Principle

Blueprint should make it unambiguous which revision is current, what feedback remains open, what decisions were made and who made them—without requiring clients to install specialist BIM software.
