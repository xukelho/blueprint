# Target Users

**Status:** Draft  
**Owner:** Product  
**Last updated:** 2026-07-25

## Purpose

This document identifies the users for whom the product is being designed and clarifies their roles, needs and constraints.

The initial product is intended to improve collaboration between architecture professionals and their clients during project revision, review and approval. It is not intended to serve every participant in the architecture, engineering and construction lifecycle from its first release.

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
- `MVP Scope.md`
- `Core Workflows.md`

## Primary User: Architecture Professional

The primary user is an architecture professional responsible for sharing project revisions, collecting feedback and maintaining a clear record of decisions.

This group may include:

- Independent architects
- Small architecture practices
- Project architects
- Architectural designers working under the supervision of an architect
- Practice administrators supporting project communication

### Core needs

Architecture professionals need to:

- Create and organise client projects
- Upload and publish clearly identified project revisions
- Ensure clients are reviewing the correct revision
- Explain changes without duplicating context across multiple channels
- Collect comments, questions and decisions in one place
- Request and record approval of a specific revision or matter
- Track unresolved matters
- Preserve a reliable history of revisions, feedback and decisions
- Control who can access each project

### Current difficulties

Architecture professionals commonly coordinate this work through a combination of email, messaging applications, shared folders, file-transfer services, PDFs and meetings. This can create:

- Ambiguity about which file is current
- Feedback that is detached from the relevant revision
- Decisions that are difficult to retrieve later
- Repeated explanations and follow-up messages
- Limited visibility of unresolved matters
- Disputes about what was shown, requested or approved
- Administrative work that adds little design value

### Product expectations

The professional user expects the platform to be dependable, simple to administer and compatible with their existing authoring workflow. They should not have to replace BIM or CAD tools in order to use it.

## Primary User: Client

The client is the person who commissions, reviews or approves architecture work but does not normally use specialist BIM authoring software.

This group may include:

- Private residential clients
- Small property developers
- Business owners commissioning a commercial space
- Representatives of organisations commissioning architecture work
- Other authorised decision-makers acting for the client

### Core needs

Clients need to:

- Access the project without installing specialist software
- Understand which revision is current
- Review information in a clear browser-based experience
- Ask questions and provide feedback in the relevant context
- Understand what requires their attention
- Distinguish open matters from resolved matters
- Know exactly what they are being asked to approve
- Review previous revisions and decisions when necessary

### Current difficulties

Clients may not understand professional file conventions, BIM terminology or the significance of a revision identifier. They can struggle when:

- Several similar files are shared through different channels
- Feedback must be described using page numbers or lengthy messages
- The architect assumes familiarity with specialist software
- Approval requests do not identify the exact revision or subject
- Earlier discussions are difficult to find
- Project responsibilities and next actions are unclear

### Product expectations

The client experience must require little or no training. Language, navigation and status information should be understandable to a non-specialist user, while still preserving the accuracy required by the architecture professional.

## User Roles in the MVP

| Role | Main responsibilities | Expected access |
| --- | --- | --- |
| Practice administrator | Manages the practice workspace and professional users | Practice-level administration and all authorised projects |
| Project professional | Creates projects, publishes revisions, responds to feedback and requests approvals | Assigned projects |
| Client | Reviews revisions, creates feedback and records requested decisions | Invited projects only |

A single person may hold more than one professional role. The MVP should avoid unnecessary role complexity while ensuring that client access remains strictly limited to explicitly invited projects.

## Buyer and User Relationship

The expected buyer is the architecture professional or architecture practice. The client is a critical product user but is not expected to purchase an individual subscription for the initial product.

This model reflects the distribution of value:

- The practice gains a repeatable collaboration and audit process across projects.
- The client receives simpler access and clearer communication.
- Client participation increases the value and retention potential of the practice account.

Commercial assumptions must be validated through pilot programmes and willingness-to-pay research.

## Initial Target Segment

The first target segment is independent architects and small architecture practices that:

- Manage several active client projects
- Work directly with non-specialist clients
- Exchange multiple project revisions
- Currently depend on email, messaging and shared folders
- Can trial the product on a real project
- Have sufficient autonomy to adopt a lightweight collaboration tool

This segment is preferred for early validation because the decision-maker is close to the workflow, onboarding can remain manageable and product feedback can be obtained directly.

## Secondary Users

The following users may participate later or in a limited capacity, but are not the primary focus of the MVP:

- Engineers and specialist consultants
- Interior designers
- Contractors
- Quantity surveyors
- Planning consultants
- External project managers
- Larger developer organisations with formal approval structures

Their inclusion may require additional permissions, workflows, document types or contractual controls. These needs should be validated before expanding the role model.

## Excluded or Deferred User Groups

The MVP is not specifically designed for:

- Large multidisciplinary enterprises requiring complex identity governance
- Construction-site coordination and issue management
- Public-sector procurement and formal document-control processes
- Users seeking BIM or CAD authoring capabilities
- Teams requiring full common data environment functionality
- Anonymous public review of project files

These groups may eventually benefit from the platform, but designing for them initially would add complexity before the core product hypothesis is validated.

## User Selection Principles

Discovery interviews and pilot recruitment should prioritise participants who:

- Have recently experienced revision or approval confusion
- Can describe their current workflow in detail
- Are willing to use the product on a real project
- Include both a professional and at least one participating client
- Can provide representative IFC files
- Are willing to discuss adoption barriers and commercial value

The pilot cohort should include variation in practice size, project type, client confidence with technology and IFC model complexity without becoming too broad to interpret.

## Accessibility and Inclusion

The client experience must account for different levels of technical confidence, age, visual ability and device choice.

The product should:

- Use clear language and avoid unnecessary BIM terminology
- Support keyboard navigation and common assistive technologies
- Maintain readable contrast and text sizing
- Provide meaningful status labels that do not depend on colour alone
- Work on contemporary desktop and tablet browsers
- Provide a usable mobile experience for notifications and simple responses

Complex model review may remain better suited to a larger screen, but users should not be blocked from understanding project status or responding to a matter on mobile.

## Validation Questions

Research with target users should determine:

- How practices currently identify and distribute revisions
- Which communication failures occur most frequently
- Which decisions require explicit approval
- Whether clients can review IFC-derived content without specialist help
- How much onboarding each user role requires
- Which project information users consider sensitive
- Whether the proposed role and access model is sufficient
- Whether practices will adopt the platform without replacing existing authoring tools
- What level of value supports willingness to pay

The target-user definition should be revised when evidence shows that a different segment experiences the problem more frequently, adopts the workflow more readily or receives materially greater value.