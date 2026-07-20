# Project start protocol

This document is the executable source of truth for initializing a project and for the recurring implementation workflows that follow. Read it completely whenever `projectConfig.meta.initialized === false`.

## Operating principles

- Treat `project.config.ts` as the primary source of project facts.
- Never ask the user to choose the documentation set, folder structure, CSS architecture, component boundaries, or core validation checks. They are already defined here.
- Ask only for business, content, visual, functional, or legal information that is materially missing.
- Do not invent claims, prices, policies, certifications, legal text, analytics IDs, credentials, or integrations.
- Prefer Astro, semantic HTML, Tailwind utilities, and small scoped scripts. Add a client framework only for a justified interactive island.
- Keep pages declarative: routes coordinate data, SEO, and section order; components render; `data/` and `lib/` hold content and transformations.
- A successful compile is not visual approval. Inspect the rendered interface at the project viewports whenever visual work is involved.
- Do not implement a complete website during initialization. Build the foundation and leave page-by-page implementation ready.

## Phase 1 — Detect state

1. Read `project.config.ts`.
2. Check `projectConfig.meta.initialized`.
3. If it is `false`, read this file completely before editing implementation files.
4. Inspect existing source, documents, references, package scripts, and repository status.
5. Do not implement finished pages or commercial sections.
6. List information that is absent, contradictory, or still a placeholder.
7. Preserve existing work. Never reset or replace user changes to make initialization easier.

If `initialized` is `true`, stop this protocol and route context through `AGENTS.md`.

## Phase 2 — Collect only missing information

Read `project.config.ts`, `references/README.md`, `references/references.json` when present, and every actual file in `references/` before asking questions.

The only acceptable information to request is:

- company and project identity;
- sector and offer;
- audience;
- primary objective and conversion;
- pages and their purpose;
- required functionality;
- language and locale;
- desired style and explicit exclusions;
- available visual references and what each reference is for;
- available content and assets;
- business, legal, technical, schedule, or accessibility constraints.

Ask one compact batch only when several answers are genuinely blocking. Do not ask how to organize files, which documents to create, which tests to install, which CSS architecture to use, how to split components, or what files the agent should read.

Record confirmed answers in `project.config.ts`. Keep unknown business facts visibly unresolved in the project documents; do not conceal them with plausible copy.

## Phase 3 — Analyze references

For each declared reference:

1. Respect `useFor`, `doNotUseFor`, and `notes`.
2. Inspect the actual file at useful size. Do not infer from a filename alone.
3. Extract principles independently for:
   - composition and hierarchy;
   - typography and type scale;
   - density, spacing, and rhythm;
   - image framing, cropping, lighting, and media priority;
   - navigation and interaction;
   - surfaces, borders, radii, and depth;
   - motion and state transitions;
   - small details;
   - patterns to avoid.
4. Write what is learned from each reference in `docs/project/DESIGN.md`.
5. Combine compatible principles into an original system. Never copy an entire reference, its brand, its assets, or its exact composition.
6. If references conflict, use their assigned purpose first, then the project objective and audience. Document the resolution.

A reference never defines the whole site unless its metadata explicitly assigns that role.

## Phase 4 — Generate context

Create or complete these documents from `docs/templates/` without duplicating large blocks:

- `docs/project/PROJECT.md`: product, audience, goals, scope, routes, constraints, and unresolved business facts.
- `docs/project/DESIGN.md`: visual intent, extracted reference principles, tokens, typography, layout, imagery, motion, responsive behavior, exclusions, and visual definition of done.
- `docs/project/ARCHITECTURE.md`: stack, route/data/component contracts, shared and page-specific boundaries, islands, functionality, SEO, images, and dependency decisions.
- `docs/project/CONTENT.md`: source inventory, voice, message hierarchy, page content needs, metadata, and missing copy.
- `docs/project/QA.md`: commands, viewports, interaction cases, accessibility, SEO, performance, visual checks, and release criteria.
- One file per route in `docs/project/pages/`, using `docs/templates/PAGE.template.md`.

Each page file must define purpose, audience need, primary conversion, narrative order, section responsibilities, content inputs, component candidates, responsive behavior, SEO, states, acceptance criteria, and explicit non-goals.

## Phase 5 — Generate the visual system

Adapt the single global stylesheet:

- `src/styles/globals.css`;
- Tailwind `@theme` tokens for colors, typography, containers, radii, shadows, and easing;
- `:root` variables only for shared values that do not map cleanly to Tailwind theme namespaces;
- font assets and `@font-face` declarations when fonts are available and licensed;
- minimal base rules, accessibility behavior, and reduced motion;
- general responsive rules derived from content capacity.

Do not create additional global CSS files, Tailwind configuration files, or parallel token sources. Compose components with Tailwind utilities. Add a rule to `globals.css` only when it is genuinely shared or cannot be expressed clearly with utilities.

Do not create finished heroes, service blocks, testimonial blocks, galleries, pricing, CTAs, headers, footers, or card systems. Tokens express a project’s visual logic; they are not a shortcut to a rigid component library.

## Phase 6 — Define architecture

Determine and document:

- route inventory and page purpose;
- narrative and section order for each route;
- truly shared components and project-specific components;
- structured local data and content ownership;
- interactive islands and their fallback behavior;
- required functionality and external integrations;
- dependencies, with a reason and expected client cost;
- mobile, intermediate, and desktop behavior;
- technical and on-page SEO strategy;
- image storage, responsive sizes, priority, alt text, and remote source policy.

Use React only for complex state or a sharply bounded third-party island. Do not use it for static layout. Do not use JavaScript to solve CSS layout.

## Phase 7 — Prepare foundation

Implement only:

- project configuration;
- base styles and generated visual system;
- SEO defaults, `SEO`, `JsonLd`, canonical handling, sitemap, and robots;
- `BaseLayout`, `PageShell`, skip link, responsive images, and neutral primitives;
- project font configuration;
- minimal Header and Footer only when needed to validate navigation; mark them as provisional and project-specific;
- empty routes or honest skeletons that expose page names and implementation status;
- project-specific integrations only when explicitly required and justified;
- project-specific QA criteria and viewport review instructions.

Do not automatically build the full site. Initialization ends with a stable implementation platform and documented page plans.

## Phase 8 — Validate

Run in this order:

1. `bun run check`
2. `bun run build`
3. Start `bun run dev` and inspect the rendered foundation at 390 × 844, 768 × 1024, and 1440 × 1000 with the browser tools available in the current environment.
4. Also inspect 320 px when text, navigation, forms, or grids are risky.

During the rendered review:

- traverse navigation and keyboard focus;
- exercise real form behavior when forms exist;
- detect content outside the viewport;
- verify one `h1`, essential links, image loading, focus visibility, reduced motion, long content, and 404 behavior;
- compare observable output with `docs/project/DESIGN.md`.

The permanent starter intentionally does not install browser automation or visual-regression packages. Add such tooling only when the project’s risk and delivery process justify it, then document its commands in `docs/project/QA.md`.

If a check fails, fix only the cause introduced or exposed by initialization and rerun the smallest affected set before the full gate.

## Phase 9 — Finish initialization

Only after the required checks pass:

1. Set `meta.initialized` to `true`.
2. Set `meta.initializedAt` to the current ISO timestamp.
3. Run `bun run check` and `bun run build` again.
4. Return:
   - generated structure;
   - main decisions;
   - files created or materially changed;
   - required functionality and added integrations;
   - installed dependencies and why;
   - checks and viewports executed;
   - known limitations or missing business content;
   - recommended first page to implement.

Never mark initialization complete merely because the context documents exist.

## Protocol: plan a page

1. Read the route’s page document, `PROJECT.md`, and only the relevant parts of `DESIGN.md` and `ARCHITECTURE.md`.
2. Inspect shared components and adjacent route patterns before proposing new abstractions.
3. Confirm purpose, primary action, content inputs, section narrative, and non-goals.
4. Define section order, semantic outline, data ownership, shared versus local components, responsive transformations, interactions, SEO, and acceptance criteria.
5. Identify exact files allowed for the implementation.
6. Update the page document; do not implement until the plan has no unresolved structural decisions.

## Protocol: implement one section

1. Work on one named section only.
2. State allowed files, prohibited files, visual reference and assigned use, responsive behavior, acceptance criteria, and checks before editing.
3. Reuse Tailwind theme tokens and primitives; create a new component only when it owns a real contract, state, accessibility, or reuse.
4. Use Tailwind utilities in component markup. Do not create another CSS file.
5. Run `bun run check`.
6. Inspect the real rendered page at mobile and desktop with the browser tools available for the project.
7. Report files changed, behavior covered, checks, visual findings, and anything intentionally deferred.

## Protocol: visual review

1. Open the real running site.
2. Inspect the relevant route at mobile, tablet when layout changes, and desktop.
3. Compare observable output with `DESIGN.md` and the route plan.
4. Do not edit during the first pass.
5. Classify findings as blocking, high, medium, or low.
6. For every finding, cite evidence, viewport, and exact candidate files.
7. Agree or infer the smallest correction scope, then edit and re-inspect.

## Protocol: fix responsive

1. Reproduce at the failing width and one width on each side.
2. Identify the cause: intrinsic size, grid/flex minimum, fixed measure, media, text, interaction, or cascade.
3. Fix content capacity rather than adding device-specific patches.
4. Preserve semantic order and avoid duplicated mobile markup.
5. Check 320, 390, 768, and 1440 px when the component is shared.
6. Verify overflow, text zoom, focus, targets, images, and long labels.

## Protocol: structural change

Allowed: semantic HTML, order, hierarchy, grid structure, component boundaries, props, data ownership, and architecture.

Prohibited during this pass: secondary color tuning, decorative effects, typographic polish, shadow tuning, and unrelated motion. Record aesthetic follow-ups separately.

Inspect all direct consumers before changing a shared contract. Update architecture or page documents when the ownership model changes.

## Protocol: aesthetic change

Allowed: typography, color, spacing, image treatment, surface, border, radius, shadow, and motion.

Prohibited unless strictly required: renaming components, moving files, changing data models, modifying APIs, changing routes, or altering architecture. A local aesthetic exception stays scoped; do not modify global tokens to repair one isolated component.

## Protocol: refactor

Refactor only when duplication, unclear responsibility, repeated bugs, or a real reusable contract justifies it.

1. Define observable behavior that must remain unchanged.
2. List consumers and checks.
3. Make one conceptual change at a time.
4. Avoid speculative variants and universal components with unrelated props.
5. Run check, build when structure changes, project-specific tests when present, and visual comparison.
6. Stop if the refactor expands beyond the named responsibility.

## Protocol: QA

Use `docs/project/QA.md` as the checklist. Run static checks, build, project-specific tests when present, accessibility inspection, SEO inspection, broken media/link checks, responsive review, reduced motion, and real interaction. Report failures by cause and distinguish pre-existing limitations from introduced regressions.

## Loop prevention and stop rules

- Before each edit cycle, state one falsifiable hypothesis and the evidence that would confirm it.
- After each cycle, inspect the actual rendered result; do not repeat the same change with different numbers.
- Never widen scope to escape a local problem.
- After two unsuccessful implementation attempts for the same defect, stop editing. Revert only your failed attempt if safe, preserve user work, document both hypotheses and observed results, and request a structural decision or new evidence.
- Stop immediately when required content, legal authority, credentials, an external API contract, or brand identity is missing and a guess would materially change the result.
- Keep an explicit allowed-file list for section work, refactors, and reviews. Adding a file requires a reason tied to the task.
- Do not perform opportunistic cleanup, dependency upgrades, global token changes, route moves, or data migrations during an unrelated task.
