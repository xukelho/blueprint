# Success Metrics

**Status:** Draft  
**Owner:** Product  
**Last updated:** 2026-07-25

## Purpose

This document defines how the success of the product and its MVP will be measured.

The metrics focus on validating the core product hypothesis: that a shared, revision-centred workspace can improve communication, traceability and decision-making between architecture professionals and their clients.

These metrics are intended to guide product decisions during early validation. They are not permanent commercial targets and should be reviewed as real usage data becomes available.

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
- `Target Users.md`
- `MVP Scope.md`
- `Core Workflows.md`

## Definition of MVP Success

The MVP will be considered successful if pilot users can use it to manage real project revisions, discuss issues in context and record decisions without depending on fragmented communication channels for the same workflow.

Success requires evidence of repeated use and measurable value for both architecture professionals and clients. Account creation, file uploads or isolated demonstrations are not sufficient on their own.

## North Star Metric

### Active Projects with a Completed Collaboration Cycle

The primary product metric is the number and proportion of active projects that complete at least one full collaboration cycle:

1. An architecture professional uploads a project revision.
2. A client accesses and reviews that revision.
3. At least one comment, question or approval request is created.
4. The matter is resolved or a decision is recorded.
5. The resulting project history remains available to both parties.

This metric reflects the complete value delivered by the product rather than activity within a single feature.

## Product Validation Metrics

| Metric | Definition | Initial MVP target |
| --- | --- | --- |
| Pilot activation rate | Percentage of invited architecture practices that create a project, upload a valid revision and invite at least one client | At least 60% |
| Client participation rate | Percentage of invited clients who access a revision and perform at least one meaningful action | At least 50% |
| Collaboration-cycle completion rate | Percentage of active pilot projects that complete at least one full collaboration cycle | At least 50% |
| Repeat professional usage | Percentage of activated architecture practices that upload a second revision or create another project within 60 days | At least 40% |
| Multi-revision usage | Percentage of active projects containing two or more revisions | At least 40% |
| Decision capture rate | Percentage of resolved matters that contain an explicit resolution, response or approval record | At least 80% |
| Pilot retention | Percentage of activated practices still using the product at the end of the pilot period | At least 50% |

The targets above are initial validation thresholds. They should be assessed alongside the number and quality of pilot participants and should not be interpreted as statistically mature benchmarks.

## Workflow Effectiveness Metrics

The MVP should make the revision and approval process clearer and easier to follow.

| Metric | Measurement |
| --- | --- |
| Time to first client review | Time between a revision becoming available and the client first opening it |
| Time to first response | Time between a comment or question being created and receiving its first reply |
| Time to resolution | Time between a matter being created and being marked as resolved |
| Approval completion time | Time between an approval request and the recorded client decision |
| Unresolved matter rate | Percentage of comments, questions and approval requests that remain open beyond an agreed period |
| Revision engagement | Percentage of published revisions opened by at least one invited client |
| Contextual communication rate | Percentage of project discussions recorded against a revision or project item rather than as unstructured project-level messages |

No universal time target will initially be assigned to these metrics because project cadence varies significantly. During the pilot, the baseline will be established and compared with the participantsâ€™ previous processes.

## User-Reported Value

Quantitative product usage must be supported by qualitative evidence that the platform solves a real problem.

At the end of each pilot, architecture professionals and clients should be asked whether the product:

- Made it easier to understand which project revision was current
- Reduced uncertainty about pending comments, questions and decisions
- Improved the traceability of changes and approvals
- Reduced the need to search across email, messaging applications and shared folders
- Made communication easier to understand in the context of the project
- Increased confidence that decisions had been properly recorded
- Was valuable enough to use on another real project

### Initial qualitative targets

- At least 70% of architecture professionals should report that the platform improved the clarity or traceability of the collaboration process.
- At least 60% of clients should report that reviewing and responding to project information was easy.
- At least 50% of activated practices should state that they would use the product on another project.
- At least 30% of activated practices should demonstrate willingness to pay or agree to continue with a paid pilot.

## Usability Metrics

The core workflows must be usable without extensive training or continuous support.

| Workflow | Success criterion |
| --- | --- |
| Create a project | A new professional user can create a project without assistance |
| Upload a revision | A professional user can upload a supported IFC file and understand its processing state |
| Invite a client | A professional user can invite the correct client and understand the clientâ€™s access |
| Review a revision | A client can open and navigate a revision in the browser without specialist BIM software |
| Create contextual feedback | A client can add a comment or question to the relevant revision context |
| Resolve a matter | Participants can understand the current status and record its resolution |
| Request and record approval | Both parties can identify what is being approved and see the resulting decision |
| Review project history | A user can identify the current revision and understand the sequence of previous revisions and decisions |

During moderated usability testing:

- At least 80% of participants should complete each critical workflow without facilitator intervention.
- At least 90% should be able to identify the current revision correctly.
- At least 80% should be able to find the status and outcome of a previously recorded matter.

## Reliability and Performance Metrics

Early product validation depends on the platform being sufficiently reliable for real project use.

| Metric | Initial MVP target |
| --- | --- |
| Successful supported-file processing | At least 95% of valid, supported IFC uploads |
| Core application availability during pilot usage periods | At least 99% |
| Unrecoverable data-loss incidents | Zero |
| Incorrect revision ordering or current-version identification | Zero confirmed incidents |
| Incorrect project access or cross-project data exposure | Zero confirmed incidents |
| Successful page loads for core workflows | At least 99% |
| Median response time for standard non-file operations | Less than 1 second under expected pilot load |

IFC processing and browser rendering performance should also be measured by file size and model complexity. Initial acceptable thresholds will be established using representative pilot files before fixed performance targets are adopted.

## Business Validation Metrics

The MVP must provide early evidence that the problem is commercially relevant, even though revenue growth is not the primary objective of the validation phase.

Business validation will consider:

- Number of architecture practices willing to participate in a real-project pilot
- Percentage of pilot practices that complete activation
- Percentage willing to continue using the product after the pilot
- Willingness to pay and acceptable pricing ranges
- Number of client participants invited per active project
- Number and type of objections that prevent adoption
- Support effort required to onboard and retain each practice
- Evidence that the product can fit into existing architecture workflows without replacing authoring tools

## Guardrail Metrics

Product growth or engagement must not come at the expense of trust, usability or professional control.

The following guardrails apply:

- No confirmed unauthorised access to project information
- No loss or silent replacement of project revisions
- No ambiguous approval record where the approving person, subject or revision cannot be identified
- No product behaviour that presents an outdated revision as current
- No requirement for clients to install specialist BIM authoring software
- No dependency on advanced 3D visualisation, automatic revision comparison or model editing to complete the MVPâ€™s core workflow
- Support volume must remain manageable for a small pilot and must not conceal fundamental usability problems

## Measurement Principles

### Measure meaningful actions

Metrics should distinguish between passive activity and actions that demonstrate product value. For example, opening a page is less meaningful than reviewing a revision, recording feedback or completing an approval.

### Evaluate both user roles

The platform only creates value when architecture professionals and clients can participate successfully. Metrics must not focus exclusively on the professional user.

### Combine quantitative and qualitative evidence

Early usage numbers can be misleading when the pilot group is small. Product analytics, interviews, support requests and direct observation should be reviewed together.

### Preserve project context

Events should be measured in relation to the relevant organisation, project, revision and participant role, while respecting privacy and data-protection requirements.

### Review targets after the pilot

Initial targets are hypotheses. After the first meaningful pilot cohort, targets should be reviewed using observed baselines, participant feedback and differences between project types.

## MVP Evaluation Decision

At the end of the validation phase, the product should proceed to the next stage when:

- The North Star Metric demonstrates repeated completion of real collaboration cycles.
- Both architecture professionals and clients report improved clarity or traceability.
- Critical workflows meet the usability targets.
- No unresolved security, access-control or data-integrity concern undermines trust.
- A meaningful proportion of practices show repeat usage and willingness to continue or pay.
- The evidence indicates that the value comes from revision management, contextual communication and approvals rather than from features outside the MVP scope.

If these conditions are not met, the team should identify whether the cause is the underlying problem, the selected target users, the proposed workflow or the implementation before expanding the product scope.