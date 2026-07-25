# Architecture Principles

**Status:** Draft  
**Owner:** Engineering  
**Last updated:** 2026-07-25

## Purpose

This document defines the principles used to make and review technical decisions for the architecture revision collaboration platform.

The principles protect the productâ€™s core qualities: trust, traceability, secure collaboration and the ability to learn quickly during the MVP. They guide decisions but do not replace engineering judgement or architecture decision records.

## Audience

This document is intended for:

- Software engineers
- Product and design stakeholders
- Quality assurance engineers
- Security and operations contributors
- Technical reviewers

## Related Documents

- `Goals.md`
- `Non Goals.md`
- `MVP Scope.md`
- `Product Requirements.md`
- `Architecture Overview.md`
- `Technology Stack.md`
- `Repository Structure.md`

## 1. Optimise for Validated Product Value

Architecture exists to deliver and test the core collaboration workflow:

1. A professional publishes a revision.
2. A client reviews it.
3. Participants discuss a matter or request a decision.
4. The matter is resolved or the decision is recorded.
5. The history remains trustworthy.

Technical work should be prioritised by its contribution to this cycle, its safety or its ability to remove a validated delivery risk.

Infrastructure for advanced 3D, automatic comparison, AI, enterprise integrations or formal multi-tenancy must not delay the MVP without evidence that it is necessary.

## 2. Prefer the Simplest Architecture That Meets Current Requirements

The initial system should use a modular monolith and a separate processing worker rather than a network of microservices.

Simplicity means:

- Fewer independently operated components
- Clear deployment and recovery
- Straightforward local development
- Transactions where strong consistency is required
- Explicit module boundaries

Simplicity does not mean placing all behaviour in controllers, sharing one unstructured codebase or ignoring future change. A simple architecture can still be disciplined.

## 3. Preserve Revision and Decision Integrity

Revisions, discussions and approvals form the productâ€™s trust record.

The system must ensure:

- Published revisions are immutable.
- Previous revisions are never silently replaced.
- The current revision is unambiguous.
- Feedback remains attached to its original context.
- Approval records identify the exact revision and subject.
- Material state changes record the actor and time.
- Corrections occur through explicit new records or controlled amendments.

Data models and user interfaces should make invalid or ambiguous states difficult to create.

## 4. Authorise Every Project Operation

Authentication alone is insufficient.

Every project-scoped operation must verify:

- The authenticated user
- Their relationship to the practice and project
- Their role
- The requested action
- The affected resource

The same rule applies to API data, original files, derived assets, exports and support tools.

The initial absence of a formal multi-tenant architecture does not weaken project and practice access boundaries.

## 5. Treat Files and Parsers as Untrusted

Uploaded IFC files are untrusted input.

Processing must apply:

- File-type and size checks
- Supported-profile validation
- Bounded CPU, memory and execution time
- Isolated worker execution
- Safe temporary-file handling
- Controlled storage permissions
- Diagnostic reporting without exposing sensitive content

Parser crashes and malformed files are expected failure modes and must not compromise the API or other project data.

## 6. Keep Interactive Requests Short

File parsing, asset generation, notification delivery and other long-running work must not block ordinary HTTP requests.

The application should:

- Persist an operation before scheduling work
- Return a clear status to the user
- Run long work asynchronously
- Expose progress or a meaningful state
- Handle retries safely
- Preserve diagnostics when work fails

A page refresh or browser closure must not cancel a valid server-side processing operation.

## 7. Design Retried Operations to Be Safe

Networks, browsers, providers and workers repeat requests. Handlers involved in uploads, job execution, publication, notification and approval must account for retries.

Idempotency should be achieved through:

- Stable operation identifiers
- Database uniqueness constraints
- Explicit state transitions
- Atomic job claims
- Versioned output locations
- Detection of already-completed work

Retrying an operation must not create duplicate revisions, duplicate decisions or conflicting current-revision state.

## 8. Use the Database as the Business System of Record

The relational database owns business identity, state, access and relationships.

Object storage owns file bytes. An objectâ€™s existence, name or URL does not establish:

- Who owns it
- Who may access it
- Which revision it belongs to
- Whether it is published
- Whether it is safe to display

Business operations must begin from authorised database records and then resolve the required stored objects.

## 9. Make State Explicit

Long-running and consequential workflows must use explicit, reviewable states.

Examples include:

- Revision: uploading, processing, ready, failed, published or archived
- Matter: open, resolved or reopened
- Approval: pending, approved, rejected, withdrawn or expired where supported
- Notification: pending, sent or failed

State transitions should be validated centrally. Booleans that permit contradictory combinations should be avoided where a single state model is clearer.

## 10. Separate Business Rules from Delivery and Infrastructure

Core rules should not depend directly on:

- HTTP controllers
- Browser components
- MinIO-specific classes
- Email-provider SDKs
- Logging vendors
- IFC-tool command-line details

Application and domain code define the required behaviour. Infrastructure adapters implement storage, email, identity and processing details.

This separation supports testing and the specific planned reassessment of object storage before launch without creating a speculative framework for every dependency.

## 11. Use Stable, Versioned Contracts

Contracts crossing a deployment or language boundary must be explicit and versioned.

This includes:

- Public API schemas
- IFC processing jobs
- Generated review manifests
- Contextual feedback references
- Domain-event or notification payloads that are persisted

Consumers must not infer meaning from undocumented fields or storage paths. Incompatible format changes require migration or side-by-side version handling.

## 12. Build Observability Into Workflows

The system must explain what happened without requiring reproduction of every failure.

Important operations should carry correlation identifiers across:

- Browser request
- API command
- Processing job
- Storage operation
- Notification attempt

Logs should be structured. Metrics should cover success, failure, duration and backlog. Audit records should cover material business and security events.

Observability data must not contain credentials, raw IFC content, invitation tokens or unnecessary personal information.

## 13. Fail Safely and Visibly

A failure must not be presented as success or leave an ambiguous business state.

The system should:

- Preserve the last valid revision
- Mark incomplete processing clearly
- Keep failed derived assets unpublished
- Return actionable user feedback
- Retain support diagnostics
- Retry only where safe
- Avoid destructive automatic cleanup before reconciliation

Where database and object-storage operations cannot be atomic together, the design must include reconciliation and safe orphan handling.

## 14. Automate Quality at the Repository Boundary

The main branch must remain buildable and testable.

Automated checks should cover:

- Formatting and static analysis
- Type checking
- Unit and integration tests
- Authorisation behaviour
- API and manifest compatibility
- Database migrations
- Production builds
- Dependency and secret scanning

Critical architecture rules should be enforced by code or tests where practical instead of relying only on documentation.

## 15. Prefer Representative Evidence Over Assumption

IFC performance and compatibility decisions must use representative pilot files.

The team should measure:

- Parsing success
- Processing duration
- Peak memory
- Generated asset size
- Browser rendering performance
- Output fidelity
- Behaviour with invalid files

Fixed file limits, worker resources and supported schemas should be established from evidence and documented. Synthetic happy-path files alone are insufficient.

## 16. Protect Portability Where a Decision Is Intentionally Temporary

MinIO is selected for the initial implementation, while the launch storage provider will be reassessed.

The application should therefore use:

- A bounded S3 feature subset
- Application-owned storage keys
- Provider-neutral storage interfaces
- Configuration outside business logic
- Migration and integrity tooling where a provider change is approved

This principle applies because a reassessment is already planned. It should not be used to add abstraction around every technology without a credible alternative or change scenario.

## 17. Design for Operability by a Small Team

The MVP must be deployable and supportable without a dedicated platform organisation.

Operational choices should favour:

- Repeatable deployments
- Clear health checks
- Useful alerts
- Documented backups and restoration
- Simple rollback
- Bounded infrastructure
- Diagnosable job failures
- Safe administrative procedures

Introducing a component also introduces patching, monitoring, backup, security and incident responsibilities.

## 18. Make Privacy and Retention Deliberate

The platform handles private project information and personal data.

The design must:

- Collect only information required for the workflow
- Restrict access by role and project
- Define retention for files, events and logs
- Support agreed deletion and archival procedures
- Avoid sensitive data in URLs and notifications
- Separate operational telemetry from the authoritative project record
- Document any external processor or provider

Deletion must not silently break required audit or contractual history. Retention conflicts should be resolved as explicit product and legal decisions.

## 19. Maintain Accessibility as a System Quality

Accessibility is not limited to final visual review.

Components, status models and workflows should support:

- Keyboard navigation
- Semantic controls
- Screen-reader labels
- Sufficient contrast
- Text alternatives
- Status indications that do not depend on colour
- Clear validation and error messages
- Usable fallback information where complex visual content is inaccessible

The 2D viewer should be complemented by accessible project, revision and matter information.

## 20. Record Material Decisions

Architecture decisions should be recorded when they:

- Establish a long-lived constraint
- Add a major dependency
- Change a system boundary
- Affect security, privacy or data ownership
- Select among meaningful alternatives
- Reverse a previous decision

An architecture decision record must capture context, the decision, alternatives, consequences and status. Superseded decisions remain in history.

## Applying the Principles

Technical proposals should answer:

1. Which current requirement or measured risk does this address?
2. How does it preserve revision, access and decision integrity?
3. What new operational responsibility does it introduce?
4. How will it be tested and observed?
5. What failure states does it create?
6. Does it cross or weaken an existing boundary?
7. Is the decision reversible, and is portability genuinely required?
8. Does it require an architecture decision record?

When principles conflict, security, data integrity and the trustworthy project record take precedence over delivery convenience. The remaining trade-off should be documented explicitly.
