# Roadmap

**Status:** Draft  
**Owner:** Product  
**Last updated:** 2026-07-25

## Purpose

This document defines the proposed sequence for validating, building and evolving the product.

The roadmap is outcome-based rather than date-based. It describes what must be learned or delivered before the product advances to the next stage. Delivery dates should only be added after technical discovery, capacity planning and pilot commitments provide enough evidence for credible estimates.

## Audience

This document is intended for:

- Product stakeholders
- Designers
- Software engineers
- Architecture professionals participating in discovery or pilot programmes
- Future commercial, operations and customer success teams

## Related Documents

- `Vision.md`
- `Problem Statement.md`
- `Goals.md`
- `Non Goals.md`
- `Success Metrics.md`
- `Target Users.md`
- `MVP Scope.md`
- `Core Workflows.md`
- `Product Requirements.md`

## Roadmap Principles

The roadmap should:

- Validate the problem and workflow before expanding the feature set
- Deliver one complete collaboration cycle before optimising individual features
- Use representative IFC files and real projects as early as possible
- Treat security, access control, revision integrity and recoverability as release requirements
- Keep the initial architecture operationally simple
- Avoid premature investment in multi-tenant architecture, advanced 3D, automatic comparison or AI features
- Advance between phases using evidence and exit criteria, not feature count alone

## Phase 0: Product Discovery and Pilot Preparation

### Objective

Confirm that the selected users experience the problem frequently enough, that the proposed workflow is understandable and that suitable practices can participate in a real-project pilot.

### Key activities

- Interview independent architects and small architecture practices
- Map their current revision, feedback and approval workflows
- Interview representative clients where possible
- Identify the decisions that require explicit approval
- Collect representative IFC files across relevant project types and sizes
- Test low-fidelity concepts for project, revision, feedback and approval workflows
- Define pilot participation, confidentiality, support and data-retention expectations
- Establish an initial analytics and research plan based on `Success Metrics.md`
- Record known IFC processing constraints and select the supported pilot profile

### Outputs

- Validated or revised problem statement
- Confirmed initial target segment
- Prioritised workflow risks
- Representative IFC test set
- Initial supported-file constraints
- Pilot candidate list
- Tested workflow prototypes
- Updated MVP scope and product requirements

### Exit criteria

- Multiple practices confirm that revision ambiguity, fragmented feedback or weak approval traceability is a material problem
- At least one suitable practice is willing to trial the product on a real project
- Both professional and client users can understand the proposed collaboration cycle
- Representative IFC files are available for technical validation
- No discovery finding invalidates the core product hypothesis

## Phase 1: Technical Foundations

### Objective

Establish the minimum secure and reliable foundation required to build and operate the collaboration workflow.

### Key capabilities

- Application environments and deployment baseline
- Authentication, account recovery and session management
- Practice, user, project and membership data model
- Project-level authorisation
- Database migrations and development data procedures
- S3-compatible object-storage integration using MinIO
- Background job execution for file processing and notifications
- Audit logging for security-relevant and data-changing actions
- Basic application logging, monitoring and failure diagnostics
- Backup and recovery procedures suitable for pilot data
- Automated test and continuous-integration baseline

### Architecture constraints

- The initial implementation will not adopt a formal multi-tenant SaaS architecture
- Access boundaries must still be enforced between practices, projects and users
- Storage access must always be authorised by the application
- Uploaded files and published revisions must not be silently replaced
- Object-storage access should be abstracted sufficiently to permit reassessment before launch

### Exit criteria

- Authentication and project authorisation pass automated and manual security tests
- A project file can be stored and retrieved only by an authorised user
- Background work can fail and retry without corrupting revision state
- Backup restoration has been exercised successfully
- Application failures can be identified through operational logs

## Phase 2: End-to-End MVP

### Objective

Deliver the complete collaboration cycle defined in `MVP Scope.md` and `Core Workflows.md`.

### Workstream A: Professional workspace

- Professional onboarding
- Practice and project creation
- Project participant management
- Client invitations
- Project list and project status
- Project archiving

### Workstream B: Revision management

- IFC upload and validation
- Immutable revision records
- Asynchronous processing
- Processing states and actionable failures
- Revision metadata and release notes
- Deliberate publication
- Current-revision identification
- Previous-revision history

### Workstream C: Browser-based review

- Limited 2D plan-oriented rendering derived from supported IFC content
- View or plan selection where required
- Zoom and pan
- Persistent project and revision context
- Clear unsupported or failed-processing states

### Workstream D: Feedback and resolution

- Contextual comments and questions
- Discussion replies
- Open, resolved and reopened states
- Revision and contextual references
- Matter filtering and status visibility
- Relevant participant notifications

### Workstream E: Approvals and history

- Approval requests tied to an exact revision or matter
- Approve and reject decisions
- Decision notes
- Immutable decision records
- Ordered project activity and revision history
- Clear outstanding-action visibility

### Workstream F: Pilot readiness

- Email notifications
- Usage analytics for defined success metrics
- Accessibility review of critical workflows
- Operational support views for processing failures
- Data-retention and project-archiving procedures
- Security, integrity, reliability and usability testing

### Exit criteria

- Every core workflow can be completed in an integrated environment
- The MVP release criteria in `MVP Scope.md` are satisfied
- Critical requirements in `Product Requirements.md` have passed acceptance testing
- Supported IFC files meet the initial processing-reliability threshold
- No unresolved critical access-control, revision-integrity or data-loss defect remains
- Known limitations and pilot support procedures are documented

## Phase 3: Controlled Pilot

### Objective

Determine whether real professional-client collaboration produces repeated use, measurable value and credible willingness to pay.

### Key activities

- Onboard a small number of selected practices
- Configure each pilot around a real project and participating client
- Monitor activation and workflow completion
- Observe initial professional and client sessions
- Collect product analytics, support requests and processing failures
- Conduct midpoint and end-of-pilot interviews
- Compare platform usage with participantsâ€™ previous communication workflow
- Test pricing expectations and willingness to continue
- Fix critical blockers while protecting the defined MVP scope

### Pilot priorities

- Successful collaboration cycles
- Correct current-revision identification
- Client participation without specialist software
- Traceable feedback, resolution and approval
- Reliable supported-file processing
- Manageable onboarding and support effort
- Trust in project confidentiality and record integrity

### Exit criteria

The pilot is ready for evaluation when:

- A meaningful set of projects has had enough time to complete the relevant workflow
- Both user roles have participated
- Quantitative and qualitative evidence has been collected
- Critical incidents and support interventions have been recorded
- The team can assess the decision conditions in `Success Metrics.md`

## Phase 4: Validation Decision and Product Hardening

### Objective

Use pilot evidence to decide whether to proceed, refine the product hypothesis, change the target segment or stop investment.

### Decision paths

#### Proceed

Proceed when users repeatedly complete collaboration cycles, report improved clarity or traceability and demonstrate sufficient intent to continue or pay.

Likely priorities:

- Resolve the most frequent pilot usability problems
- Improve IFC compatibility and processing performance
- Strengthen onboarding and self-service support
- Formalise service monitoring, backup and incident response
- Refine permissions and administrative controls where evidenced
- Define commercial packaging and billing requirements
- Prepare production data-protection and contractual materials
- Reassess object storage and deployment requirements before launch

#### Refine and repeat

Repeat a focused validation cycle when the problem remains credible but activation, client participation or workflow completion is below target.

Possible causes to test:

- Incorrect target segment
- Excessive IFC or onboarding friction
- Client review experience that requires too much support
- Approval workflow that does not match real practice
- Value that is present but too infrequent for the proposed commercial model

#### Reposition or stop

Reconsider continued investment when real projects do not produce meaningful collaboration cycles, users do not perceive improved clarity or traceability, or the necessary workflow depends on functionality deliberately outside the product hypothesis.

### Exit criteria

- A documented product decision has been made using the success metrics
- Evidence, limitations and unresolved risks are recorded
- The next investment stage has a defined scope and measurable outcome

## Phase 5: Post-MVP Expansion

This phase is conditional. Candidates must be prioritised using validated user needs, commercial evidence, technical risk and strategic fit.

### Potential capability groups

#### Review intelligence

- Automatic comparison between revisions
- IFC metadata-based change detection
- AI-assisted change and discussion summaries
- Improved search and filtering across project history

#### Richer model review

- 3D model navigation
- Element selection and richer model context
- Additional model and document formats
- More advanced annotations

#### Team and enterprise capabilities

- Additional professional and consultant roles
- More granular permissions
- External identity providers
- Formal multi-tenant architecture, if justified
- Organisation-level reporting and administration

#### Ecosystem and operations

- Integrations with authoring, storage and document-management products
- Extended exports and reports
- Billing and subscription management
- Managed production object storage
- Enhanced observability, support and service-level controls

### Entry conditions

A post-MVP capability should be prioritised only when:

- It addresses a demonstrated user or commercial need
- The core collaboration cycle already performs sufficiently well
- Its expected value can be measured
- Its security, operational and architectural impact is understood
- It does not undermine the clarity of the productâ€™s primary purpose

## Cross-Cutting Work

The following activities continue throughout all phases:

- User research and pilot feedback
- Security and privacy review
- Accessibility
- Automated testing and quality assurance
- Observability and operational readiness
- Documentation and architectural decision records
- Measurement instrumentation and data-quality checks
- Review of product assumptions and scope

## Roadmap Governance

The roadmap should be reviewed:

- At the end of each phase
- When discovery or pilot evidence materially changes an assumption
- When a security, privacy or operational risk affects release readiness
- When a proposed scope change would delay the complete collaboration cycle
- Before committing to production architecture or commercial launch

Each material roadmap change should record:

- The evidence or constraint that triggered the change
- The expected user or business outcome
- The affected requirements and success metrics
- The delivery and technical impact
- What is being deferred or removed

## Current Priority

The current priority is to complete product discovery and convert the MVP definition into an implementable, testable plan.

Advanced 3D review, automatic revision comparison, AI functionality, formal multi-tenant architecture and broad integrations remain deferred until the core collaboration hypothesis has been validated.