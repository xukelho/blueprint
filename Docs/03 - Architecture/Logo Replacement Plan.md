# Logo replacement plan

Status: Draft, ready for Orchestrator review  
Owner: feature-architect (TASK-0015 / PKG-001)  
Last updated: 2026-09-19

Replace the current graphical logo with the supplied `raclette logo.svg` across the application. This task delivers the implementation plan; application changes follow in the parent workflow TASK-0014.

## Verified inventory

| Location | Current behaviour | Planned change |
| --- | --- | --- |
| `Frontend/src/components/BlueprintLogoMark.tsx` | Inline old geometric mark, inheriting `currentColor` | Replace with a shared `BrandLogoMark` wrapper loading the supplied SVG |
| `Frontend/src/pages/LoginPage.tsx:107` | Desktop login logo | Use the shared replacement |
| `Frontend/src/pages/LoginPage.tsx:150` | Mobile login logo, displayed at widths up to 760 px | Use the shared replacement |
| `Frontend/src/components/PortalShell.tsx:126` | Shared portal sidebar logo | Use the shared replacement for every portal role |
| `Frontend/src/assets/logo.svg` | Old artwork; no tracked consumer found | Replace its contents with the supplied SVG |
| `Frontend/src/styles.css` | SVG-only size selectors; mint/teal containers and a dark-theme override | Target the replacement image and tune only logo sizing/backgrounds |
| `Frontend/index.html` | No favicon link | No existing icon to replace; adding a favicon is optional follow-up scope |

Tracked-source searches found no other product-logo renderers, backend logo assets, web app manifest, touch icon or documentation image references. The architectural background and project drawing SVGs are separate illustrations, outside this replacement.

The supplied file is untracked, parses as XML, and contains a square `0 0 512 512` viewBox with transparent background and fixed blue `#2563EB` strokes. It includes descriptive title/description metadata and fine 4-unit guide lines. Its artwork and colour should be preserved.

## Implementation sequence

1. Copy the supplied file's contents into `Frontend/src/assets/logo.svg`, replacing the unused old artwork. Keep the root source file intact. Treat the frontend asset as the single runtime source and document its provenance. The Docker build context and development bind mount contain only `Frontend`, so importing directly from the repository root would make deployment fragile.
2. Rename the shared component to `BrandLogoMark.tsx`. Import the asset through Vite and render an image with `alt=""`, `aria-hidden="true"` and the existing optional `className` prop. All current placements accompany brand text, so the mark is decorative. Using an image preserves the original SVG without duplicating path data or introducing repeated inline title IDs. Existing Vite client types support the asset import; no new dependency is needed.
3. Update both page/component imports and all three render sites. Update `.brand__mark svg` and `.sidebar-brand__mark svg` to target the image or a dedicated logo class, with explicit square dimensions, `display: block` and `object-fit: contain`.
4. Check legibility and adjust the logo presentation. Current images are only 25 px on login and 24 px in the sidebar; the new 4-unit lines become approximately 0.19 px at those sizes. Start by using more of the existing 38 px/36 px containers. Use a neutral light logo tile if needed to support the fixed blue strokes, with a targeted dark-theme override so the shared accent rule does not restore the old background. Determine final sizes from rendered inspection; do not simplify, crop or recolour the supplied artwork without a further design decision.
5. Ensure the sidebar brand button retains an accessible name when its text is hidden in collapsed mode; add a stable descriptive `aria-label` if needed. Preserve its dashboard navigation and keyboard focus behaviour.
6. Audit the final tree for `BlueprintLogoMark` and the old logo path data. The component and asset must no longer contain the old artwork. Keep product naming changes separate: the wordmark text, page titles, metadata, namespaces and storage keys still use Blueprint. The source filename alone does not settle whether the future product spelling is Raclety or Raclette.

## Validation and acceptance

- Run the existing frontend build and test suite in the configured Node 22 environment. With the Compose frontend running, use `docker compose exec blueprint-frontend npm run build` and `docker compose exec blueprint-frontend npm run test:run` from the repository root.
- Inspect desktop login, mobile login (including either side of the 760 px breakpoint), and the portal sidebar expanded/collapsed. Inspect portal light and dark themes and representative administrator, company, employee and client routes using the shared shell.
- Confirm that the original blue artwork loads without distortion, clipping or broken requests; fine lines remain reasonably legible, brand text stays aligned, and navigation/focus still works. Capture before/after screenshots for review.
- Inspect the production build or preview to confirm that the bundled asset resolves without depending on the root source file. Re-scan for old component imports and old artwork.
- Reuse existing behavioural tests; no new path snapshots or tests that merely duplicate SVG markup are required. Add a focused accessibility/navigation regression only if behaviour changes.

Acceptance: all three current logo placements show the supplied design, the old component artwork and old asset contents are gone, the asset works in the frontend build, and visual checks pass across the listed layouts/themes. A favicon or broader rename may be scheduled separately by the Orchestrator.

## Handoff

- Changes made: this plan only; application code and the supplied SVG remain unchanged.
- Validation performed: inspected tracked logo/image references, shared component consumers, responsive/theme CSS, frontend scripts/types, and Docker boundaries; parsed the source SVG as XML. No build, test suite or browser visual check was run for this documentation-only task.
- Decisions proposed: one bundled SVG source behind a neutral shared component; preserve supplied geometry and blue colour; constrain this stage to logo replacement.
- Risks: fine-line legibility at small sizes, fixed-blue contrast against existing tiles, and the untracked root source requiring deliberate inclusion when implementing. No implementation blocker was found.
- Reporting blocker: the required AOS progress command failed with `PermissionError` creating `C:\Git\Agentic OS\agentic-os-state\.aos.lock`; that state directory is outside this session's writable roots. This document preserves the handoff locally. The final report is subject to the same access restriction.
- Recommended next action: Orchestrator reviews this plan and schedules implementation plus rendered QA through the parent workflow. No specialist was contacted directly.
