# MVP Scope

**Status:** Draft  
**Owner:** Product  
**Last updated:** 2026-07-25

## Purpose

This document defines the minimum product scope required to validate the core hypothesis of the platform.

The MVP must allow architecture professionals and their clients to collaborate around project revisions, contextual feedback and recorded decisions. It should be sufficient for real pilot projects without attempting to become a complete BIM authoring tool or common data environment.

## Audience

This document is intended for:

- Product stakeholders
- Designers
- Software engineers
- Architecture professionals participating in discovery or pilot programmes
- Future commercial and customer success teams

## Related Documents

- `Vision.md`
- `Problem Statement.md`
- `Goals.md`
- `Non Goals.md`
- `Success Metrics.md`
- `Target Users.md`
- `Core Workflows.md`

## MVP Product Hypothesis

If architecture professionals can publish clearly identified revisions and clients can review, discuss and approve them in one shared browser-based workspace, both parties will experience greater clarity, traceability and confidence than when using fragmented communication channels.

The MVP exists to test this hypothesis with real projects and representative users.

## Scope Principles

The MVP should:

- Deliver one complete collaboration cycle
- Prioritise clarity and traceability over feature breadth
- Preserve the professionalâ€™s control over publication and access
- Remain usable by clients without specialist BIM software
- Integrate with, rather than replace, existing authoring tools
- Create trustworthy records of revisions, feedback and approvals
- Support safe iteration during a limited pilot

## In Scope

### 1. Authentication and accounts

- Secure sign-in for professional and client users
- Basic user profile management
- Practice membership for professional users
- Invitation-based client access
- Password recovery or an equivalent secure authentication recovery flow
- Session management and sign-out

### 2. Practice and project management

- Create a practice workspace during onboarding
- Create and edit a project
- View projects available to the signed-in user
- Archive a project without silently deleting its history
- Assign professional users to a project
- Invite and remove client access
- Display clear project status and ownership information

The application will not use a multi-tenant product architecture for the initial implementation. Access boundaries must nevertheless be enforced between practices, projects and users. A future architectural migration may be evaluated if commercial scale or operational requirements justify it.

### 3. Revision management

- Upload a supported IFC file as a new project revision
- Validate the file type and basic upload constraints
- Process the file asynchronously where required
- Display processing, success and failure states
- Assign an ordered revision identifier
- Add a title, description or release note
- Publish a processed revision to invited clients
- Identify one published revision as the current revision
- View previous revisions without overwriting them
- Preserve uploader, timestamp and revision metadata

Published revisions must be immutable. Corrections must be represented by a new revision or by controlled metadata changes that do not alter the original file record.

### 4. Browser-based review

- Open a supported revision in a web browser
- Present a limited 2D plan-oriented view derived from the IFC content
- Navigate the available plans or views required by the selected pilot projects
- Zoom and pan
- Display enough project and revision information to prevent ambiguity
- Provide a graceful failure state when a file cannot be processed or displayed

Advanced 3D visualisation is not required for the MVP. Any technical foundation that permits future 3D support must not expand the initial user-facing scope.

### 5. Contextual feedback

- Create a comment or question associated with a specific revision
- Associate feedback with a relevant position or item when supported by the 2D viewer
- Reply within a discussion
- Display author and timestamp
- Track open and resolved states
- Record who resolved a matter and when
- Reopen a resolved matter where appropriate
- Filter or identify matters by status

The original context of a discussion must remain identifiable even after a newer revision is published.

### 6. Approval

- Request approval from an authorised client
- Identify the exact project, revision and subject of the request
- Allow the client to approve or reject the request
- Permit an optional or required decision note according to the workflow
- Record the decision-maker and timestamp
- Prevent later editing from silently changing the approval record
- Display pending and completed approval requests

The MVP approval record supports collaboration and traceability. It is not presented as a qualified electronic signature or as automatically satisfying every legal or contractual approval requirement.

### 7. Project activity and history

- Show an ordered history of revisions
- Show publication events
- Show material feedback and status changes
- Show approval requests and decisions
- Identify the current revision
- Allow authorised users to inspect the history of a project

The history should answer: what changed, what was discussed, what remains open, what was decided, by whom and when.

### 8. Notifications

- Notify invited users of relevant project access
- Notify clients when a revision is published
- Notify relevant participants of new replies or approval requests
- Link notifications to the correct project context
- Avoid exposing sensitive project information in notification content

Email notifications are sufficient for the MVP. In-app notification history may be included if required for reliable workflow completion.

### 9. File storage and delivery

- Store uploaded IFC files and derived assets in S3-compatible object storage
- Use MinIO for the initial development and pilot implementation
- Authorise access before delivering a file or derived asset
- Preserve file integrity and revision association
- Support backup and recovery appropriate to pilot data

The object-storage decision should be reviewed closer to launch if reliability, managed-service or operational requirements change.

### 10. Administration and support

- Provide basic operational visibility into failed uploads and processing jobs
- Allow authorised support personnel to diagnose issues without bypassing access controls
- Record security-relevant and data-changing actions
- Provide safe procedures for deactivating users and archiving projects

### 11. Security and privacy baseline

- Enforce project-level authorisation on every protected operation
- Encrypt data in transit
- Protect credentials using accepted password-hashing or external identity practices
- Prevent public access to private project files
- Record relevant authentication, access and data-change events
- Apply data-retention and deletion procedures appropriate to pilot agreements
- Avoid cross-project or cross-practice data exposure

## Explicitly Out of Scope

The following are not required for the MVP:

- BIM or CAD model editing
- Full 3D model navigation
- Automatic geometric comparison between revisions
- AI-generated change summaries
- Clash detection
- Real-time multi-user cursors or co-editing
- Construction-site issue management
- Tendering, procurement or cost management
- Full common data environment functionality
- Complex enterprise role hierarchies
- Public project sharing
- Native desktop or mobile applications
- Qualified electronic signatures
- Billing automation
- A self-service marketplace
- Custom branding for each practice
- Integrations with every BIM authoring or document-management product

Items outside scope may be explored after the core workflow meets its success criteria.

## Technical Boundaries

### Deployment model

The initial application is not being designed as a multi-tenant SaaS architecture. It may still serve multiple authorised practices during a controlled pilot, but the deployment, data and operational model should remain intentionally simple.

Any future move to a formal multi-tenant architecture must be treated as a deliberate migration involving identity, data partitioning, storage, observability, billing and security review.

### Supported files

IFC is the primary project input format. The exact IFC schema versions, maximum file size and supported model characteristics must be defined using representative pilot files.

CAD authoring, proprietary authoring formats and PDF-first workflows are not required for initial validation.

### Object storage

MinIO is the initial S3-compatible storage implementation. Application code should interact through an appropriate abstraction so the decision can be reassessed before production launch without changing product behaviour.

## MVP Release Criteria

The MVP is ready for controlled pilot use when:

- A professional can create a project and publish a valid revision
- An invited client can access and review that revision
- Both parties can create and resolve contextual feedback
- A professional can request approval and the client can record a decision
- The project history accurately preserves the complete cycle
- Supported uploads meet the agreed processing reliability threshold
- Access-control, data-integrity and backup testing has passed
- Core workflows meet the usability criteria in `Success Metrics.md`
- Known limitations are documented for pilot participants
- Operational support can identify and respond to failed processing

## Scope Change Control

A proposed addition should enter the MVP only when it is necessary to:

- Complete the core collaboration cycle
- Protect project confidentiality or data integrity
- Remove a demonstrated blocker affecting pilot participation
- Measure a defined success criterion

Features should not be added solely because they are expected in adjacent BIM, project-management or document-management products.

Material scope decisions should record:

- The user problem being addressed
- Evidence from research or pilot usage
- Impact on delivery and technical risk
- Whether the change affects the product hypothesis
- Which existing item will be deferred if capacity is fixed

## Post-MVP Candidates

Subject to validation, later phases may consider:

- 3D model review
- Automatic revision comparison
- IFC metadata-based change detection
- AI-assisted revision summaries
- Additional professional and consultant roles
- More granular permissions
- Integrations with authoring and storage products
- Extended reporting and exports
- Formalised enterprise deployments
- Commercial subscription and billing workflows

These candidates are not commitments and should be prioritised using observed user value.