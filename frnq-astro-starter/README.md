# Astro + Tailwind starter

Minimal reusable foundation for new Astro websites. It provides the decisions that should stay stable between projects—strict TypeScript, Tailwind, SEO, images, accessibility, basic components, documentation routing, and AI initialization—without installing product-specific tooling.

## Create a project

```bash
bun create astro@latest my-project --template <user>/frnq-astro-starter
cd my-project
bun install
```

For a private template, create the repository from your Git provider’s template UI, clone it, and run `bun install`.

## Initialize the website

1. Fill any known facts in `project.config.ts`.
2. Add visual material to `references/` and describe its purpose in `references.json`.
3. Ask the coding agent:

```text
Inicializa el proyecto.
```

In Cursor, `/start-project` starts the same protocol.

The agent reads `project.config.ts` and `PROJECT_START.md`, asks only for missing business or visual facts, creates the project documents and page plans, adapts the Tailwind theme, prepares the technical foundation, validates it, and finally changes `meta.initialized` to `true`.

Initialization does not build the complete website. It leaves the system ready for page-by-page implementation.

## Permanent core

```text
Astro static output
TypeScript strictest
Tailwind 4 through its Vite plugin
One global stylesheet
Sitemap, canonical, robots and structured data
Responsive local images with astro:assets
Accessibility defaults and reduced motion
BaseLayout, PageShell and narrow primitives
Cursor, Codex and agent context routing
```

React, CMS, analytics, ecommerce, content collections, form providers, deployment adapters, and automated browser tooling are not part of the core. Add them only when a project requires them.

## Styles

`src/styles/globals.css` is the only stylesheet in the starter. It contains:

- `@import "tailwindcss"`;
- neutral Tailwind `@theme` tokens;
- the few shared custom properties that do not map to a Tailwind namespace;
- minimal base and accessibility rules;
- reduced-motion behavior.

Use Tailwind utilities directly in Astro components. During initialization, replace the neutral seed tokens with the project’s colors, typography, scale, containers, surfaces, radii, shadows, and motion. Do not create a second token source or additional global stylesheets.

## Structure

```text
src/
├── assets/
├── components/
│   ├── core/
│   ├── layout/
│   ├── primitives/
│   ├── sections/
│   └── ui/
├── config/
├── content/
├── data/
├── layouts/
├── lib/
├── pages/
└── styles/
    └── globals.css
```

Pages coordinate data, SEO, and section order. Layouts own the document shell. Sections represent meaningful page blocks. Primitives stay narrow. Data and integrations remain outside visual components.

## Project documents

- `docs/project/PROJECT.md`: business, audience, scope, routes, and constraints.
- `docs/project/DESIGN.md`: visual system, references, responsive behavior, and motion.
- `docs/project/ARCHITECTURE.md`: routes, components, data, integrations, SEO, and images.
- `docs/project/CONTENT.md`: voice, sources, page content, metadata, and missing facts.
- `docs/project/QA.md`: checks, viewports, interaction cases, and release gate.
- `docs/project/pages/`: one executable plan per route.
- `docs/templates/`: stable starting structure for those documents.

`AGENTS.md` is intentionally short. It routes agents to only the document required for the current task. `PROJECT_START.md` is read completely only while the project is uninitialized.

## Development commands

```bash
bun run dev
bun run check
bun run build
bun run preview
```

## Continue with an agent

```text
/plan-page
/implement-section
/visual-review
/structural-change
/aesthetic-change
/fix-responsive
/refactor-component
/run-qa
```

## QA baseline

Before delivery:

```bash
bun run check
bun run build
```

Inspect the real interface at 390 × 844, 768 × 1024, and 1440 × 1000. Check 320 px when navigation, forms, grids, or long labels are risky. Verify overflow, focus, keyboard order, headings, images, links, forms, reduced motion, metadata, sitemap, robots, and 404 behavior.

Add project-specific testing only when its maintenance cost is justified.

## MCP

`.cursor/mcp.json` and `.codex/config.toml` configure only the official Astro documentation server. They contain no secrets.

## Deployment

The default output is static and builds to `dist/`. Add an Astro adapter only when on-demand rendering is a confirmed requirement, and document that decision in `docs/project/ARCHITECTURE.md`.

## Template maintenance

Upgrade Astro, Tailwind, and their official integrations together. Read migration notes, install in a clean copy, run check and build, and confirm the template still starts with `meta.initialized: false`. Never merge project-specific branding, content, dependencies, or visual decisions back into this core.
