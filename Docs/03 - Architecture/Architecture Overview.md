# Architecture Overview

**Status:** Draft  
**Owner:** Engineering  
**Last updated:** 2026-07-25

## Purpose

This document describes the high-level architecture of the architecture revision collaboration platform.

It defines the main system responsibilities, boundaries, data flows and deployment assumptions for the MVP. Detailed technology choices belong in `Technology Stack.md`, while implementation-level decisions that require further investigation should be recorded as architecture decision records.

## Audience

This document is intended for:

- Software engineers
- Product and design stakeholders
- Quality assurance engineers
- Security and operations contributors
- Technical partners involved in the pilot

## Related Documents

- `MVP Scope.md`
- `Core Workflows.md`
- `Product Requirements.md`
- `Roadmap.md`
- `Technology Stack.md`
- `Repository Structure.md`
- `Architecture Principles.md`

## Architectural Context

The product provides a private browser-based workspace in which architecture professionals publish IFC-based project revisions and clients review them, create contextual feedback and record decisions.

The MVP is not a BIM authoring tool, a complete common data environment or a formal multi-tenant SaaS platform. Its architecture must support the core collaboration cycle reliably without introducing infrastructure intended only for hypothetical future scale.

The principal architectural challenges are:

- Secure project and file access
- Immutable and correctly ordered revisions
- Asynchronous processing of potentially large IFC files
- Generation and delivery of browser-compatible 2D review assets
- Reliable association between revisions, comments, decisions and stored files
- Traceable user and system activity
- Recovery from interrupted uploads and processing failures

## Architecture Style

The MVP will use a modular monolith for the primary application, supported by a separate asynchronous processing worker.

The modular monolith keeps business rules, transactions and deployment manageable during product validation. Internal modules must still have explicit responsibilities and avoid uncontrolled dependencies.

The processing worker is separated because IFC parsing and asset generation:

- Can be computationally expensive
- May take substantially longer than an interactive request
- Must be retried without repeating the original upload
- May require a specialised runtime or libraries
- Should be scaled or constrained independently if pilot workloads require it

The architecture does not require independently deployed microservices for each business capability.

## System Context

### Human actors

| Actor | Interaction |
| --- | --- |
| Practice administrator | Manages the practice, professional users and authorised projects |
| Project professional | Creates projects, uploads and publishes revisions, responds to feedback and requests approvals |
| Client | Reviews published revisions, creates feedback and records requested decisions |
| Support operator | Investigates operational failures using explicitly authorised support capabilities |

### External dependencies

| Dependency | Purpose |
| --- | --- |
| Email delivery provider | Account, invitation, publication, reply and approval notifications |
| S3-compatible object storage | Original IFC files and generated review assets |
| Identity or authentication service | Authentication if identity is not implemented within the application |
| Monitoring and log destination | Operational health, errors, performance and audit investigation |

## Logical Components

### Web application

The web application provides the user interface for professional and client workflows. It is responsible for:

- Authentication and session interactions
- Project and revision navigation
- Upload initiation and progress
- 2D revision review
- Contextual comments and replies
- Approval requests and decisions
- Project history and status
- Accessible error and processing feedback

The browser must not receive object-storage credentials or unrestricted object URLs.

### Application API

The API is the authoritative entry point for product operations. It is responsible for:

- Authentication and authorisation enforcement
- Input validation
- Project, participant and revision lifecycle rules
- Comment, matter and approval workflows
- Issuing controlled upload and download access
- Creating processing jobs
- Notification requests
- Audit and product-event recording
- Consistent error responses

Business rules must remain in application or domain services rather than being duplicated in controllers, user-interface code or workers.

### Background processing worker

The worker processes durable jobs created by the application. Its responsibilities include:

- Retrieving an authorised source IFC object
- Validating the supported IFC profile
- Extracting required metadata
- Generating the limited 2D review representation
- Storing derived assets
- Recording processing progress and diagnostics
- Marking a revision as ready or failed
- Supporting safe retry after transient failure

The worker must treat every job as potentially repeated. It must not publish revisions, make approval decisions or bypass application authorisation rules.

### Relational database

The relational database is the system of record for:

- Users and authentication references
- Practices and memberships
- Projects and project participants
- Revisions and processing state
- Object metadata and storage keys
- Comments, replies and resolution state
- Approval requests and decisions
- Invitations
- Notification state
- Audit and product events
- Durable background-job coordination where selected

Binary project files must not be stored directly in the relational database.

### Object storage

S3-compatible object storage contains:

- Original uploaded IFC files
- Generated 2D review assets
- Processing artefacts that must be retained
- Exports or previews when these are introduced

MinIO is the initial implementation for development and pilot delivery. Storage keys must be generated by the application and associated with database records. Files must remain private and be delivered only after authorisation, using a controlled application response or short-lived signed access.

### Notification component

Notification handling converts domain events into email messages. Delivery should occur asynchronously so that a temporary provider failure does not invalidate a successful project action.

Notification content must avoid unnecessary sensitive project information and must link users back to an authenticated project context.

### Observability and audit

Operational telemetry and the business audit history serve different purposes:

- Operational logs, metrics and traces help diagnose system health and performance.
- Audit events provide a durable record of security-relevant and material business actions.
- Product analytics measure validated user behaviour without becoming the authoritative project history.

These data sets may use different retention and access policies.

## Principal Data Model

The following entities define the central ownership and traceability chain:

`Practice â†’ Project â†’ Revision â†’ Review Matter or Approval`

Supporting entities include:

- User
- Practice membership
- Project participant
- Invitation
- Stored object
- Processing job
- Comment and reply
- Approval request and decision
- Notification
- Audit event

Every project-scoped record must be traceable to its project. Every revision-specific record must retain its revision identifier even after a newer revision is published.

The current revision is a project-level reference to one successfully published revision. It does not replace, mutate or delete previous revisions.

## Core Data Flows

### Upload and processing

1. An authorised professional requests a new revision upload.
2. The API creates an upload intent and an immutable revision identity.
3. The original file is written to private object storage.
4. The API verifies completion and creates a durable processing job.
5. The worker processes the file and writes derived assets to object storage.
6. The worker records the outcome against the revision.
7. The API exposes the updated status to authorised users.
8. A successful revision remains unpublished until the professional explicitly publishes it.

The process must tolerate a repeated completion request, worker restart or transient storage failure without producing duplicate revisions or conflicting assets.

### Publish and notify

1. An authorised professional publishes a successfully processed revision.
2. The application transaction marks that revision as published and updates the projectâ€™s current-revision reference.
3. Earlier revisions remain unchanged and accessible.
4. An audit event and notification request are recorded.
5. Notification delivery occurs asynchronously.

A notification failure must not reverse a valid publication.

### Review and comment

1. The API confirms the clientâ€™s project access.
2. The browser loads revision metadata and authorised review assets.
3. The client creates feedback linked to the revision and, where available, a stable 2D context reference.
4. The API stores the matter and its initial comment transactionally.
5. Replies and status changes append to the matter history.

Feedback remains linked to its original revision after later publications.

### Approval

1. A professional creates an approval request for an exact project revision and subject.
2. The authorised client reviews that immutable request context.
3. The client records an approval or rejection, with the required note.
4. The application records the actor, timestamp and decision.
5. The completed decision cannot be silently edited or redirected to another revision.

## Security Boundaries

The primary security boundary is the application API.

The following rules apply:

- Every protected request is authenticated.
- Project membership and role are checked for every project-scoped operation.
- Storage access is authorised through application-owned records.
- File identifiers and storage keys are not treated as proof of access.
- Worker credentials grant only the storage and job access required for processing.
- Support access is explicit, limited and auditable.
- Public sharing is not supported by the MVP.
- User-supplied IFC files are untrusted input and are processed within controlled resource and execution limits.

Although the initial system is not formally multi-tenant, records belonging to different practices and projects must not be exposed across access boundaries.

## Data Integrity and Consistency

The architecture must preserve these invariants:

- A published revision is immutable.
- A project has at most one current published revision.
- A revision number or identifier is unambiguous within its project.
- A review matter retains its original revision context.
- An approval identifies one subject, revision, decision-maker and decision time.
- Database records and object-storage assets remain associated.
- Archiving does not silently delete project history.
- Retried operations do not create unintended duplicates.

Database transactions should protect relational state. Work that crosses the database, object storage and external providers must use explicit states, idempotent handlers and reconciliation rather than assuming a distributed transaction.

## Deployment View

The initial deployment consists of:

- One web frontend
- One application API
- One or more background worker processes
- One relational database
- One MinIO deployment
- An email provider integration
- Centralised logging and basic monitoring

Development environments may run these components through containers. Production or pilot deployment may place them on a managed container platform or virtual infrastructure, provided the same boundaries and configuration model are preserved.

Independent horizontal scaling is not an MVP requirement. The API and worker should nevertheless remain stateless between requests and jobs, excluding their use of the database and object storage, so that additional instances can be introduced safely if justified.

## Failure and Recovery Model

Expected failure conditions include:

- Interrupted uploads
- Unsupported or malformed IFC files
- IFC processing timeouts
- Worker termination
- Temporary object-storage unavailability
- Email-provider failure
- Concurrent publication attempts
- Repeated client requests

Each long-running operation must expose an explicit state such as pending, processing, ready or failed. Failures must preserve enough diagnostic context for support and must never present incomplete assets as a successfully processed revision.

Backups must cover both the relational database and object storage. Recovery procedures must verify the relationship between restored metadata and restored objects.

## Deliberately Deferred Architecture

The MVP does not require:

- A formal multi-tenant data architecture
- A microservice per product capability
- Kubernetes
- Event streaming infrastructure
- Full 3D model delivery
- Real-time collaborative editing
- Automatic geometric revision comparison
- AI processing
- Multi-region deployment
- A dedicated data warehouse

These capabilities require new evidence and explicit architectural decisions rather than speculative preparation.

## Open Technical Decisions

The following decisions must be closed through technical discovery or an architecture decision record:

- Supported IFC schema versions and file limits
- IFC parsing and 2D asset-generation approach
- Stable coordinate or element references for contextual feedback
- Background-job coordination and retry mechanism
- Identity implementation or external provider
- Pilot hosting environment
- Backup, restore and retention targets
- File-scanning and processing-isolation controls
- Object-storage delivery strategy
- Notification provider
- Minimum observability stack

## Architecture Validation

Before the MVP pilot, the team must demonstrate:

- End-to-end processing of representative IFC files
- Correct authorisation for every project and file operation
- Recovery from an interrupted upload and worker restart
- Idempotent processing retry
- Safe concurrent publication behaviour
- Preservation of revision, discussion and approval history
- Database and object-storage backup restoration
- Sufficient performance for the agreed pilot file profile
