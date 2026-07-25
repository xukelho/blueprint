# Product Requirements

**Status:** Draft  
**Owner:** Product  
**Last updated:** 2026-07-25

## Purpose

This document defines the product requirements for the MVP of the architecture revision collaboration platform.

It translates the product goals, scope and core workflows into functional and non-functional requirements that can guide design, implementation and acceptance testing. It defines required product behaviour without prescribing detailed interface designs or low-level technical implementation.

## Audience

This document is intended for:

- Product stakeholders
- Designers
- Software engineers
- Quality assurance
- Architecture professionals participating in discovery or pilot programmes
- Future operations, security and customer success teams

## Related Documents

- `Vision.md`
- `Problem Statement.md`
- `Goals.md`
- `Non Goals.md`
- `Success Metrics.md`
- `Target Users.md`
- `MVP Scope.md`
- `Core Workflows.md`
- `Roadmap.md`

## Product Summary

The product provides a shared browser-based workspace in which architecture professionals can publish project revisions and clients can review them, provide contextual feedback and record decisions.

The MVP must prove that this revision-centred workflow improves clarity, traceability and confidence compared with fragmented use of email, messaging applications, shared folders and meetings.

## Product Hypothesis

If architecture professionals can publish clearly identified revisions and clients can review, discuss and approve them in one shared browser-based workspace, both parties will experience greater clarity, traceability and confidence without replacing their existing authoring tools.

## User Roles

| Role | Description |
| --- | --- |
| Practice administrator | Manages the practice workspace, professional membership and authorised projects |
| Project professional | Creates and manages assigned projects, revisions, feedback and approval requests |
| Client | Reviews and responds within explicitly invited projects |
| Support operator | Diagnoses operational failures through controlled, auditable access |

A user may hold more than one professional role. Client access must remain limited to explicitly authorised projects.

## Requirement Priorities

Requirements use the following priorities:

| Priority | Meaning |
| --- | --- |
| Must | Required for the controlled MVP pilot |
| Should | Important for usability or operability; may be simplified if it does not block the core workflow |
| Could | Valuable but optional during MVP delivery |

## Functional Requirements

### FR-1: Accounts and Authentication

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-1.1 | Must | The system shall allow professional and client users to authenticate securely. |
| FR-1.2 | Must | The system shall provide a secure account-recovery flow or equivalent identity-provider recovery mechanism. |
| FR-1.3 | Must | The system shall allow users to sign out and shall invalidate the relevant session. |
| FR-1.4 | Must | The system shall require appropriate identity verification before accepting a project or practice invitation. |
| FR-1.5 | Must | The system shall prevent an invitation intended for one identity from being used by an unauthorised identity. |
| FR-1.6 | Should | The system shall allow users to maintain basic profile information, including a display name. |
| FR-1.7 | Must | The system shall support controlled user deactivation without deleting historical project contributions. |

### FR-2: Practice Membership

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-2.1 | Must | A professional user shall be able to create or join a practice workspace during onboarding. |
| FR-2.2 | Must | A practice administrator shall be able to invite professional users. |
| FR-2.3 | Must | The system shall prevent expired or revoked invitations from granting access. |
| FR-2.4 | Must | Re-sending or accepting an invitation shall not create duplicate memberships. |
| FR-2.5 | Must | The system shall enforce practice and project access on the server for every protected operation. |
| FR-2.6 | Should | A practice administrator shall be able to view and deactivate professional memberships. |

The MVP does not require a formal multi-tenant product architecture. This does not reduce the requirement to prevent unauthorised access between practices, projects or users.

### FR-3: Project Management

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-3.1 | Must | An authorised professional shall be able to create a project with the minimum required identifying information. |
| FR-3.2 | Must | A user shall see only projects they are authorised to access. |
| FR-3.3 | Must | An authorised professional shall be able to edit controlled project metadata. |
| FR-3.4 | Must | An authorised professional shall be able to assign or remove professional access to a project. |
| FR-3.5 | Must | An authorised professional shall be able to archive a project without deleting its history. |
| FR-3.6 | Must | Archived projects shall be clearly identified and protected from unintended active workflow changes. |
| FR-3.7 | Must | A failed project creation shall not leave a visible partial or duplicate project. |
| FR-3.8 | Should | The project view shall show its status, responsible practice and relevant participants. |

### FR-4: Client Invitations and Access

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-4.1 | Must | An authorised professional shall be able to invite a client to a specific project using an email address. |
| FR-4.2 | Must | The invitation flow shall state which project access will be granted. |
| FR-4.3 | Must | A client shall gain access only after accepting a valid invitation using the intended identity. |
| FR-4.4 | Must | Removing a client from a project shall prevent future access while preserving their historical contributions. |
| FR-4.5 | Must | A client shall not be able to access another project by changing a URL, identifier or request payload. |
| FR-4.6 | Should | An authorised professional shall be able to view pending, accepted, expired and revoked invitations. |

### FR-5: Revision Upload and Processing

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-5.1 | Must | An authorised professional shall be able to upload a supported IFC file as a new project revision. |
| FR-5.2 | Must | The system shall validate file type, size and defined supported-file constraints. |
| FR-5.3 | Must | Every accepted upload shall create a uniquely identifiable revision record. |
| FR-5.4 | Must | Revision records shall preserve project, uploader, original filename, timestamps, ordered identifier and processing status. |
| FR-5.5 | Must | A professional shall be able to provide a revision title, description or release note. |
| FR-5.6 | Must | Processing shall occur asynchronously when it cannot reliably complete within the upload request. |
| FR-5.7 | Must | The system shall display pending, processing, successful and failed states clearly. |
| FR-5.8 | Must | A failed upload or processing job shall not produce a publishable revision. |
| FR-5.9 | Must | An interrupted or repeated request shall not create ambiguous duplicate revisions. |
| FR-5.10 | Must | A file with the same name as an earlier file shall not replace the earlier revision. |
| FR-5.11 | Should | Authorised users shall receive actionable information or a controlled retry path when processing fails. |
| FR-5.12 | Must | The original IFC file and any derived review assets shall remain associated with the same revision. |

### FR-6: Revision Publication and History

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-6.1 | Must | A successfully processed revision shall remain unpublished until an authorised professional explicitly publishes it. |
| FR-6.2 | Must | Publication shall identify the revision being made available to clients. |
| FR-6.3 | Must | The system shall identify exactly one current published revision for a project. |
| FR-6.4 | Must | Publishing a new revision shall not alter or remove previous revisions. |
| FR-6.5 | Must | Published revision file content shall be immutable. |
| FR-6.6 | Must | Corrections to published file content shall require a new revision. |
| FR-6.7 | Must | Concurrent publication attempts shall produce an unambiguous current revision. |
| FR-6.8 | Must | The system shall record revision publication in project history. |
| FR-6.9 | Must | Previous revisions shall remain available to authorised users. |
| FR-6.10 | Must | When a user opens an earlier revision, the system shall indicate that a newer current revision exists. |

### FR-7: Browser-Based Review

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-7.1 | Must | An authorised user shall be able to open a supported published revision in a contemporary web browser without specialist BIM authoring software. |
| FR-7.2 | Must | The MVP shall provide a limited 2D plan-oriented view derived from supported IFC content. |
| FR-7.3 | Must | Users shall be able to zoom and pan within the review view. |
| FR-7.4 | Must | Users shall be able to select between available supported plans or views where the pilot file requires it. |
| FR-7.5 | Must | Project name, revision identifier and current-versus-previous status shall remain clear during review. |
| FR-7.6 | Must | The application shall show a clear failure or unsupported state instead of incomplete or misleading review content. |
| FR-7.7 | Should | The review experience shall preserve enough context for a user returning from a notification or shared application link. |
| FR-7.8 | Could | The application may preserve the userâ€™s most recent supported view position for convenience. |

Full 3D model navigation is not required for the MVP.

### FR-8: Contextual Feedback

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-8.1 | Must | An authorised client or professional shall be able to create a comment or question associated with a specific revision. |
| FR-8.2 | Must | Where supported by the viewer, feedback shall retain a position or item reference within the 2D review context. |
| FR-8.3 | Must | The system shall show the selected revision and context before feedback is submitted. |
| FR-8.4 | Must | Feedback shall preserve its author, timestamp, revision, text and contextual reference. |
| FR-8.5 | Must | Authorised users shall be able to reply within a discussion. |
| FR-8.6 | Must | A matter shall support open and resolved states. |
| FR-8.7 | Must | Resolving a matter shall record who resolved it and when. |
| FR-8.8 | Should | An authorised user shall be able to reopen a resolved matter. |
| FR-8.9 | Must | Publishing a new revision shall not detach earlier feedback from its original revision. |
| FR-8.10 | Must | Users shall be able to identify or filter unresolved matters. |
| FR-8.11 | Must | Empty feedback shall not be submitted. |
| FR-8.12 | Must | The system shall prevent unauthorised users from viewing or changing feedback. |

### FR-9: Approval

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-9.1 | Must | An authorised professional shall be able to request a decision from an authorised client. |
| FR-9.2 | Must | An approval request shall identify the exact project, revision and subject requiring a decision. |
| FR-9.3 | Must | The system shall prevent an approval request for an unpublished or inaccessible revision. |
| FR-9.4 | Must | The authorised client shall be able to approve or reject the request. |
| FR-9.5 | Must | The workflow shall support a decision note and may require one for rejection. |
| FR-9.6 | Must | A completed decision shall preserve the decision-maker, outcome, timestamp, subject and revision. |
| FR-9.7 | Must | A completed decision shall not be silently edited or reassigned. |
| FR-9.8 | Must | A changed design or approval subject shall require a new request rather than altering the completed record. |
| FR-9.9 | Must | Users shall be able to distinguish pending, approved, rejected and superseded requests. |
| FR-9.10 | Must | Concurrent or repeated submissions shall not create conflicting completed decisions. |

The MVP approval feature is a traceable collaboration record. It shall not claim to be a qualified electronic signature or to satisfy every contractual approval requirement automatically.

### FR-10: Activity and Traceability

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-10.1 | Must | The project shall provide an ordered history of revisions and publication events. |
| FR-10.2 | Must | The history shall include material feedback state changes and approval requests and decisions. |
| FR-10.3 | Must | Relevant events shall identify the actor and timestamp. |
| FR-10.4 | Must | The history shall make the current revision distinguishable from previous revisions. |
| FR-10.5 | Must | Authorised users shall be able to determine what was published, discussed, resolved and decided. |
| FR-10.6 | Must | History records required for traceability shall not be silently deleted when access is removed or a project is archived. |
| FR-10.7 | Should | Users shall be able to navigate from a history event to the relevant revision or matter when they retain access. |

### FR-11: Notifications

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-11.1 | Must | The system shall send project invitations to the intended email address. |
| FR-11.2 | Must | Relevant clients shall be notified when a revision is published. |
| FR-11.3 | Must | Relevant users shall be notified of approval requests. |
| FR-11.4 | Should | Relevant users shall be notified of new feedback replies and material status changes. |
| FR-11.5 | Must | Every notification action shall link to the correct project context after authentication. |
| FR-11.6 | Must | Notification content shall avoid exposing sensitive project information unnecessarily. |
| FR-11.7 | Must | A notification-delivery failure shall not reverse a valid publication, feedback action or decision. |
| FR-11.8 | Should | Failed notifications shall be available for operational diagnosis and controlled retry. |

Email is sufficient as the primary notification channel for the MVP.

### FR-12: Administration and Support

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-12.1 | Must | Authorised operators shall be able to identify failed uploads and processing jobs. |
| FR-12.2 | Must | Operational diagnostics shall not require bypassing project access controls without an explicit, audited support mechanism. |
| FR-12.3 | Must | Security-relevant and data-changing administrative actions shall be recorded. |
| FR-12.4 | Must | The system shall provide a safe procedure for deactivating users and archiving projects. |
| FR-12.5 | Should | Authorised operators shall be able to initiate controlled retries for retryable background failures. |

### FR-13: Product Measurement

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-13.1 | Must | The system shall capture the events required to calculate the core metrics in `Success Metrics.md`. |
| FR-13.2 | Must | Measurement events shall distinguish user role, project, revision and meaningful workflow action where permitted. |
| FR-13.3 | Must | Analytics shall distinguish completed collaboration actions from passive page views. |
| FR-13.4 | Must | Analytics collection shall respect privacy, data-minimisation and pilot agreements. |
| FR-13.5 | Should | The team shall be able to review activation, client participation, revision engagement and collaboration-cycle completion. |

## Non-Functional Requirements

### NFR-1: Security and Authorisation

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-1.1 | Must | Every protected server operation shall verify the authenticated userâ€™s authorisation for the affected practice, project and resource. |
| NFR-1.2 | Must | Denied access shall not reveal sensitive resource contents or confirm more information than necessary. |
| NFR-1.3 | Must | Private files and derived assets shall not be publicly accessible. |
| NFR-1.4 | Must | File delivery shall use short-lived or otherwise controlled authorised access. |
| NFR-1.5 | Must | Data shall be encrypted in transit using current accepted protocols. |
| NFR-1.6 | Must | Passwords, when managed by the application, shall be stored using an accepted adaptive password-hashing algorithm and never as plaintext. |
| NFR-1.7 | Must | Secrets shall not be stored in source control or exposed to clients. |
| NFR-1.8 | Must | The system shall record relevant authentication, authorisation and data-change events. |
| NFR-1.9 | Must | Access-control tests shall cover cross-project and cross-practice attempts. |

### NFR-2: Privacy and Data Protection

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-2.1 | Must | The system shall collect only personal and project data required for the defined workflow and operation. |
| NFR-2.2 | Must | Pilot participants shall receive clear information about data use, retention and support access. |
| NFR-2.3 | Must | The product shall support defined retention, export and deletion procedures appropriate to pilot agreements and applicable law. |
| NFR-2.4 | Must | Deletion procedures shall distinguish between removable personal data and records that must be retained for project integrity or legal obligations. |
| NFR-2.5 | Must | Logs and notifications shall avoid unnecessary sensitive project content. |

### NFR-3: Data Integrity and Recoverability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-3.1 | Must | Published revision files and completed approval records shall be immutable. |
| NFR-3.2 | Must | Revision ordering and current-revision state shall remain consistent under concurrent requests. |
| NFR-3.3 | Must | Retried operations shall not create duplicate publication, decision or notification outcomes. |
| NFR-3.4 | Must | Database records and object-storage assets shall preserve their association. |
| NFR-3.5 | Must | The system shall have automated backups appropriate to the pilotâ€™s recovery needs. |
| NFR-3.6 | Must | A restore procedure shall be tested before pilot use. |
| NFR-3.7 | Must | Unrecoverable loss of accepted pilot project data is not an acceptable release condition. |

### NFR-4: Reliability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-4.1 | Must | Core application availability during pilot usage periods shall target at least 99%. |
| NFR-4.2 | Must | At least 95% of valid files within the defined supported IFC profile shall process successfully. |
| NFR-4.3 | Must | A background failure shall produce an observable failure state and shall not corrupt revision data. |
| NFR-4.4 | Must | The application shall recover safely from interrupted uploads, repeated requests and worker restarts. |
| NFR-4.5 | Should | Retryable external delivery failures shall use bounded retries and operational visibility. |

### NFR-5: Performance

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-5.1 | Must | Median response time for standard non-file operations shall be below one second under expected pilot load. |
| NFR-5.2 | Must | Core pages shall provide visible progress when work exceeds normal interactive response time. |
| NFR-5.3 | Must | File processing performance shall be measured by file size and model complexity using representative pilot files. |
| NFR-5.4 | Should | The 2D review view shall become interactable within an agreed threshold for the supported pilot file profile. |
| NFR-5.5 | Should | Large file uploads shall show progress or an equivalent clear state. |

Fixed IFC processing and viewer thresholds shall be set after technical discovery with representative files.

### NFR-6: Usability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-6.1 | Must | Critical workflows shall use language understandable to clients without BIM expertise. |
| NFR-6.2 | Must | The current project, revision and next required action shall be clear in relevant workflows. |
| NFR-6.3 | Must | Errors shall identify what failed and, where possible, what the user can do next. |
| NFR-6.4 | Must | User input shall be preserved when recoverable validation errors occur. |
| NFR-6.5 | Must | At least 80% of representative usability-test participants shall complete each critical workflow without facilitator intervention. |
| NFR-6.6 | Must | At least 90% of representative participants shall correctly identify the current revision. |

### NFR-7: Accessibility and Device Support

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-7.1 | Must | Critical workflows shall support keyboard navigation. |
| NFR-7.2 | Must | Controls and status information shall have meaningful accessible names and structure. |
| NFR-7.3 | Must | Status shall not be communicated by colour alone. |
| NFR-7.4 | Must | Text and essential controls shall meet accepted contrast and scaling expectations. |
| NFR-7.5 | Must | Core workflows shall support current major desktop browsers. |
| NFR-7.6 | Should | Plan review shall support contemporary tablet browsers. |
| NFR-7.7 | Must | Mobile users shall be able to understand project status and complete simple responses, even if complex plan review is better suited to a larger screen. |

The target accessibility conformance level and supported browser versions shall be fixed before pilot acceptance testing.

### NFR-8: Observability and Supportability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-8.1 | Must | Application and background processing failures shall produce structured operational logs. |
| NFR-8.2 | Must | Requests and background jobs shall have identifiers that permit end-to-end diagnosis without exposing secrets. |
| NFR-8.3 | Must | Operators shall be alerted to conditions that threaten availability, data integrity or processing reliability. |
| NFR-8.4 | Must | Logs shall retain enough information to diagnose failed supported-file processing while respecting project confidentiality. |
| NFR-8.5 | Should | Operational dashboards shall show application health, processing success, queue state and notification failures. |

### NFR-9: Maintainability and Delivery

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-9.1 | Must | Database changes shall use version-controlled, repeatable migrations. |
| NFR-9.2 | Must | Core business rules and authorisation boundaries shall have automated tests. |
| NFR-9.3 | Must | Continuous integration shall run relevant tests and code-quality checks before release. |
| NFR-9.4 | Must | Development, test and production configuration shall remain separate. |
| NFR-9.5 | Must | Environment-specific development users or data shall never be introduced into production unintentionally. |
| NFR-9.6 | Should | Material architectural decisions shall be recorded using architecture decision records. |

### NFR-10: Storage and Portability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-10.1 | Must | Uploaded IFC files and derived assets shall use S3-compatible object storage. |
| NFR-10.2 | Must | MinIO shall be the initial object-storage implementation for development and pilot delivery. |
| NFR-10.3 | Must | Object-storage access shall be encapsulated so that the implementation can be reassessed before production launch without changing product behaviour. |
| NFR-10.4 | Must | Stored objects shall have stable associations with application-owned revision records. |
| NFR-10.5 | Should | Integrity metadata shall permit detection of missing or unexpectedly changed objects. |

## Business Rules

### BR-1: Project access

- Project access is private by default.
- A professional requires appropriate practice and project permission.
- A client requires an accepted invitation or explicit project membership.
- Removing access does not remove historical attribution.

### BR-2: Revision identity

- Each revision belongs to exactly one project.
- Each accepted revision has a stable identity and ordered project sequence.
- File names are descriptive metadata and are not revision identities.
- A project may have multiple unpublished revisions but only one current published revision.
- Published file content cannot be replaced.

### BR-3: Feedback context

- Every feedback matter belongs to a project and a revision.
- Context remains associated with the original revision after later publication.
- Resolution changes status but does not erase the discussion.

### BR-4: Approval

- An approval request identifies one exact subject and revision.
- Only an authorised intended decision-maker may complete it.
- A completed decision is immutable.
- A materially changed subject requires a new request.

### BR-5: Archiving and deletion

- Archiving removes a project from active workflows but preserves its traceable history.
- Deactivation removes future access without rewriting historical authorship.
- Destructive deletion requires a defined retention and recovery procedure.

## Supported-File Profile

IFC is the primary project input format for the MVP.

Before pilot release, the team must define:

- Supported IFC schema versions
- Maximum accepted file size
- Required model characteristics
- Supported plan or storey extraction behaviour
- Known unsupported geometry or authoring-tool exports
- Expected processing threshold by representative file category
- User-facing validation and failure messages

Files outside the supported profile may be rejected clearly. They must not produce incomplete review content that appears valid.

## Data Requirements

At minimum, the product data model must represent:

- Users and authentication identities
- Practices and professional memberships
- Projects and project memberships
- Invitations and invitation lifecycle
- Revisions and ordered revision identity
- Original files and derived review assets
- Processing jobs and outcomes
- Publication state and current revision
- Feedback matters, replies and contextual references
- Matter status history
- Approval requests and decisions
- Notifications and delivery status
- Audit and project activity events
- Product-measurement events

The detailed schema belongs in technical design documentation.

## External Dependencies

The MVP is expected to depend on:

- Email delivery
- S3-compatible object storage
- IFC parsing and 2D asset-generation components
- Background job execution
- Database persistence
- Application monitoring and log collection

Each dependency must have a defined failure state, timeout behaviour and operational diagnostic path.

## Explicit Exclusions

The following are not product requirements for the MVP:

- BIM or CAD editing
- Full 3D model navigation
- Automatic geometric comparison between revisions
- AI-generated change summaries
- Clash detection
- Real-time collaborative cursors or co-editing
- Full common data environment functionality
- Construction-site issue management
- Complex enterprise role hierarchies
- Public or anonymous project sharing
- Native desktop or mobile applications
- Qualified electronic signatures
- Billing automation
- Formal multi-tenant SaaS architecture
- Broad integrations with authoring and document-management products

## MVP Acceptance Scenarios

### Scenario 1: Complete collaboration cycle

1. A professional creates a project.
2. The professional uploads a valid supported IFC file.
3. The revision processes successfully.
4. The professional publishes it and invites a client.
5. The client signs in and reviews the correct revision.
6. The client creates contextual feedback.
7. The professional replies and resolves the matter.
8. The professional requests approval.
9. The client records a decision.
10. Both users can inspect the resulting project history.

The scenario passes only if each record identifies the correct project, revision, actor, state and timestamp.

### Scenario 2: New revision without historical loss

1. A project has a published revision with feedback and a completed decision.
2. A professional publishes a second revision.
3. The second revision becomes current.
4. The first revision, its feedback and its decision remain unchanged and accessible.
5. Opening the first revision clearly indicates that a newer current revision exists.

### Scenario 3: Access isolation

1. Two users have access to different projects.
2. Each user attempts to retrieve the other project and its files using page navigation, direct URLs and modified request identifiers.
3. Every unauthorised attempt is denied without exposing project contents.
4. Relevant denied actions are available for security diagnosis.

### Scenario 4: Processing failure

1. A professional uploads an invalid, unsupported or unprocessable file.
2. The system produces a clear failed or rejected state.
3. The revision cannot be published.
4. Existing project revisions remain unaffected.
5. An operator can diagnose the failure.
6. The user can take an appropriate next action.

### Scenario 5: Concurrency and repeat submission

1. Publication or approval is submitted more than once or concurrently.
2. The system produces one consistent outcome.
3. No duplicate current revision, conflicting approval or misleading history is created.

### Scenario 6: Access removal

1. A client contributes feedback and a decision.
2. An authorised professional removes the clientâ€™s future project access.
3. The client can no longer access the project.
4. Their earlier contributions and attribution remain in project history.

## Release Criteria

The product is ready for a controlled pilot when:

- All Must requirements required by the selected pilot workflow have passed acceptance testing
- The complete collaboration-cycle scenario passes in an integrated environment
- Supported-file constraints and known limitations are documented
- Authorisation tests show no confirmed cross-project or cross-practice exposure
- Revision ordering, immutability and approval integrity tests pass
- Backup restoration has been tested
- Operational staff can diagnose failed processing and notification delivery
- Critical workflows meet the agreed usability and accessibility acceptance level
- Measurement events required by `Success Metrics.md` have been verified
- No unresolved critical security, privacy, data-loss or workflow-integrity defect remains

## Open Decisions

The following details require discovery or technical validation before implementation is considered complete:

- Supported IFC schema versions and model constraints
- Maximum upload size
- 2D extraction and rendering approach
- Definition and granularity of contextual viewer references
- Whether rejection notes are always mandatory
- Invitation expiry duration
- Retention and deletion periods
- Exact support-operator access model
- Pilot availability and recovery objectives
- Target browser versions and accessibility conformance level
- Threshold at which an in-app notification history becomes necessary

Open decisions must be resolved through research, technical spikes, pilot agreements or explicit product decisions. They should not be filled through undocumented implementation assumptions.

## Change Control

A material requirement change should record:

- The affected requirement identifier
- The user problem or evidence supporting the change
- Its impact on scope, security, architecture and delivery
- Its effect on acceptance tests and success metrics
- Whether another requirement will be deferred

Requirements that introduce advanced 3D, model editing, automatic comparison, AI functionality, formal multi-tenant architecture or broad enterprise scope require an explicit post-MVP decision.