# Core Workflows

**Status:** Draft  
**Owner:** Product  
**Last updated:** 2026-07-25

## Purpose

This document describes the end-to-end workflows that must function in the MVP.

The workflows are written from the userâ€™s perspective and define the expected product behaviour without prescribing a specific interface or implementation.

## Audience

This document is intended for:

- Product stakeholders
- Designers
- Software engineers
- Architecture professionals participating in discovery or pilot programmes
- Quality assurance and future customer success teams

## Related Documents

- `Vision.md`
- `Problem Statement.md`
- `Goals.md`
- `Non Goals.md`
- `Success Metrics.md`
- `Target Users.md`
- `MVP Scope.md`

## Workflow Principles

Every core workflow should:

- Keep the project and revision context visible
- Make the current state and next action clear
- Preserve the identity and role of each participant
- Prevent silent replacement of project information
- Give users explicit success, failure and processing feedback
- Remain understandable to clients without BIM expertise
- Produce a traceable project history

## Workflow 1: Professional Onboarding

### Actor

Architecture professional.

### Preconditions

- The user has permission to create or join a practice workspace.
- The user can access the application and receive account-related email.

### Main flow

1. The professional creates an account or accepts a practice invitation.
2. The user verifies their identity where required.
3. The user creates or joins a practice workspace.
4. The application explains the core project and revision workflow.
5. The user reaches a project list with a clear action to create a project.

### Expected outcome

The professional has an active account, belongs to the correct practice and can begin a project without support intervention.

### Exceptions

- An expired invitation can be replaced without creating duplicate membership.
- An existing account can accept a new valid invitation.
- A user cannot join a practice through an invitation intended for another identity without appropriate verification.

## Workflow 2: Create a Project

### Actor

Practice administrator or authorised project professional.

### Preconditions

- The user is authenticated.
- The user has permission to create projects for the practice.

### Main flow

1. The professional starts project creation.
2. The user enters the minimum required project information.
3. The application validates the information.
4. The project is created in a private state.
5. The professional is assigned to the project.
6. The project appears in the professionalâ€™s project list.

### Expected outcome

A private project workspace exists and is ready to receive its first revision. No client has access until explicitly invited.

### Exceptions

- Validation errors identify the affected field and preserve the userâ€™s other input.
- A failed creation does not leave a visible partial or duplicate project.

## Workflow 3: Upload and Process a Revision

### Actor

Authorised project professional.

### Preconditions

- The project exists and is active.
- The user can publish revisions for the project.
- The file complies with the supported IFC constraints.

### Main flow

1. The professional selects the project and starts a new revision.
2. The user chooses an IFC file and enters release information.
3. The application validates the file type and upload constraints.
4. The file is uploaded to authorised object storage.
5. The application creates an immutable revision record in a processing state.
6. Background processing extracts the assets required for browser review.
7. The user can leave the page without losing the upload.
8. The application reports success or an actionable failure.
9. The processed revision remains unpublished until the professional deliberately publishes it.

### Expected outcome

A uniquely identified, ordered revision is stored with its original file, derived review assets, uploader, timestamps and processing result.

### Exceptions

- An invalid file is rejected before publication.
- An interrupted upload can fail safely without producing a publishable revision.
- A processing failure preserves diagnostic information and permits a controlled retry or a new upload.
- A revision is never silently replaced by a file with the same name.

## Workflow 4: Publish a Revision

### Actor

Authorised project professional.

### Preconditions

- The revision has processed successfully.
- The professional can review its identifying information.

### Main flow

1. The professional opens the processed revision.
2. The application shows the revision identifier, description and available review content.
3. The professional confirms publication.
4. The revision becomes available to authorised client users.
5. The application marks it as the current published revision.
6. The previously current revision remains accessible in history.
7. Relevant clients are notified.
8. A publication event is added to the project history.

### Expected outcome

All authorised participants can identify and access the same current revision, while earlier revisions remain unchanged.

### Exceptions

- A failed notification does not reverse a valid publication, but it is recorded for retry or support.
- Concurrent publication attempts result in one unambiguous current revision.
- A revision that has not processed successfully cannot be published.

## Workflow 5: Invite a Client

### Actor

Authorised project professional.

### Preconditions

- The project exists.
- The professional can manage project participants.

### Main flow

1. The professional enters the clientâ€™s email address and confirms project access.
2. The application shows the access that will be granted.
3. An invitation linked to the specific project is created.
4. The client receives an invitation.
5. The client creates an account or signs in using the invited identity.
6. The client accepts the invitation.
7. The project becomes visible to that client.
8. The project history records the access event at an appropriate level.

### Expected outcome

The intended client can access only the project to which they were invited.

### Exceptions

- Expired and revoked invitations cannot grant access.
- Re-sending an invitation does not create duplicate membership.
- Removing a client prevents future access without deleting their historical contributions.

## Workflow 6: Client Reviews the Current Revision

### Actor

Client.

### Preconditions

- The client is authenticated and authorised for the project.
- At least one revision has been published.

### Main flow

1. The client opens the project from an invitation, notification or project list.
2. The application clearly identifies the current revision.
3. The client opens the browser-based review view.
4. The client navigates the available 2D plan content using zoom and pan.
5. The revision identifier and relevant context remain visible.
6. The client can see existing matters relevant to the revision.
7. The review event is recorded for engagement measurement.

### Expected outcome

The client can inspect the intended revision without installing specialist software and can distinguish it from previous revisions.

### Exceptions

- If review assets are unavailable, the client sees a clear status instead of incomplete or misleading content.
- An outdated link may open its original revision, but the application warns that a newer current revision exists.
- The client cannot access another project by modifying a URL or identifier.

## Workflow 7: Create Contextual Feedback

### Actors

Client or authorised project professional.

### Preconditions

- The user can access the project and revision.

### Main flow

1. The user starts a comment or question from the relevant revision.
2. Where supported, the user selects a position or item in the 2D review context.
3. The user enters the feedback.
4. The application shows the revision and selected context before submission.
5. The feedback is created with an open status.
6. The author, timestamp, revision and contextual reference are preserved.
7. Relevant participants are notified.
8. The matter appears in the revision and project activity views.

### Expected outcome

Participants can understand what the feedback refers to without reconstructing its context from a separate communication channel.

### Exceptions

- Empty feedback cannot be submitted.
- A failed submission is not displayed as successfully saved.
- Feedback created on an older revision remains associated with that revision.

## Workflow 8: Discuss and Resolve a Matter

### Actors

Client and authorised project professional.

### Preconditions

- An open comment or question exists.

### Main flow

1. A participant opens the matter.
2. The application displays its original revision context and complete discussion.
3. Participants add replies as required.
4. An authorised participant records the resolution.
5. The matter changes to resolved.
6. The application records who resolved it and when.
7. The matter remains readable in project history.

### Expected outcome

The project contains an explicit, traceable outcome rather than an abandoned conversation.

### Exceptions

- A resolved matter may be reopened, with the action recorded.
- Deactivating a user does not remove their historical messages.
- Newer revisions do not erase or silently relocate the original context.

## Workflow 9: Request Approval

### Actor

Authorised project professional.

### Preconditions

- The subject of approval exists and can be identified.
- At least one authorised client is available.

### Main flow

1. The professional starts an approval request.
2. The user selects the exact revision and, where relevant, the matter being approved.
3. The user identifies the client decision-maker and adds instructions or a deadline.
4. The application presents a confirmation summary.
5. The approval request is created in a pending state.
6. The selected client is notified.
7. The request appears in the project activity and pending-action views.

### Expected outcome

The client receives an unambiguous request that identifies what decision is required.

### Exceptions

- A request cannot be issued for an unpublished or inaccessible revision.
- Repeated actions do not create duplicate requests without warning.
- Revoking a pending request is recorded and does not resemble a client decision.

## Workflow 10: Record an Approval Decision

### Actor

Authorised client.

### Preconditions

- A pending approval request is assigned to or available to the client.

### Main flow

1. The client opens the approval request.
2. The application displays the exact project, revision, subject and request details.
3. The client reviews the relevant content.
4. The client chooses approve or reject.
5. The client enters a note when required.
6. The application asks for explicit confirmation.
7. The decision is recorded with the clientâ€™s identity and timestamp.
8. The professional is notified.
9. The approval record appears in project history.

### Expected outcome

Both parties can later determine what was decided, by whom and against which revision.

### Exceptions

- A completed decision cannot be silently edited.
- A correction requires a new recorded action that preserves the previous decision.
- An unauthorised user cannot decide on behalf of the selected client.
- A newer revision does not inherit approval automatically.

## Workflow 11: Review Project History

### Actors

Authorised professional or client.

### Preconditions

- The project contains at least one recorded event.

### Main flow

1. The user opens the project history.
2. The application shows events in a clear chronological order.
3. The user can identify revisions, publication events, feedback, resolutions and approval decisions.
4. The current revision is clearly distinguished.
5. The user opens a historical event to inspect its original context.
6. Access rules continue to apply to historical content.

### Expected outcome

The user can reconstruct the significant sequence of project information and decisions without searching through external communication channels.

### Exceptions

- Archived projects remain readable to authorised users according to retention policy.
- Removed users remain attributed to their historical actions.
- Failed system operations are not presented as completed user actions.

## Workflow 12: Archive a Project

### Actor

Practice administrator or authorised project professional.

### Preconditions

- The project exists.
- The user has archive permission.

### Main flow

1. The user chooses to archive the project.
2. The application explains the effect on access and future activity.
3. The user confirms the action.
4. The project becomes read-only or otherwise restricted according to policy.
5. Existing history and revision records are preserved.
6. The archive action is recorded.

### Expected outcome

Inactive projects no longer clutter active workflows, but their records are not silently destroyed.

### Exceptions

- Archiving does not delete object-storage files.
- Restoration, if supported, is a separate recorded action.
- Permanent deletion follows a distinct retention and authorisation process.

## Cross-Workflow States

### Revision states

| State | Meaning |
| --- | --- |
| Uploading | File transfer is in progress |
| Processing | The file is stored and review assets are being prepared |
| Failed | Processing did not complete successfully |
| Ready | Processing succeeded but the revision is not published |
| Published | The revision is visible to authorised clients |
| Superseded | A newer published revision is current |

### Matter states

| State | Meaning |
| --- | --- |
| Open | A response or action is still required |
| Resolved | An explicit resolution has been recorded |
| Reopened | Further attention is required after an earlier resolution |

### Approval states

| State | Meaning |
| --- | --- |
| Pending | A client decision has been requested |
| Approved | The authorised client approved the identified subject |
| Rejected | The authorised client rejected the identified subject |
| Revoked | The professional withdrew the request before a decision |

## Audit and Traceability Requirements

Across all workflows, the platform must preserve:

- The acting user
- The userâ€™s role and relevant authorisation context
- The project and revision involved
- The action and resulting state
- The timestamp in a consistent system time standard
- Previous and new values for material status changes where appropriate

Audit information must support security and problem diagnosis without exposing private content unnecessarily.

## Workflow Validation

The workflows should be validated through:

- Moderated usability testing with both professional and client users
- End-to-end automated tests for critical paths
- Authorisation tests covering direct URL and identifier manipulation
- Representative IFC files of different size and complexity
- Failure testing for uploads, processing, notifications and concurrent actions
- Pilot observation using real collaboration cycles

Completion and usability targets are defined in `Success Metrics.md`.