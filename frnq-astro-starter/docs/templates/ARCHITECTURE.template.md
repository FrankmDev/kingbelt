# {{PROJECT_NAME}} — Architecture

## Stack

Astro, TypeScript strictest, static output, Tailwind 4, semantic HTML, `astro:assets`, and sitemap. List only integrations required by this project.

## Routes

{{PAGES}}

## Responsibility boundaries

- Pages coordinate data, SEO, and section order.
- Layouts own shared document structure.
- Sections own meaningful page blocks.
- Primitives solve narrow reusable UI contracts.
- `data/` stores typed local content; `lib/` stores transformations and integrations.

## Component map

Document shared components, project-specific components, section ownership, props, slots, states, and direct consumers. Avoid speculative abstractions.

## Data and content

Define data sources, schemas, ownership, validation, and mapping boundaries. Visual components do not call external services directly.

## Islands and client code

List every hydrated island or client script, why native HTML/CSS is insufficient, its fallback, and its bundle boundary.

## SEO and images

Define metadata ownership, canonical rules, structured data, sitemap exclusions, robots, local/remote image policy, widths, sizes, priority, and alt responsibilities.

## Functionality and dependencies

{{FUNCTIONALITY}}

For every non-core dependency, state purpose, client impact, and removal path.

## Responsive and performance contracts

Define breakpoints by content capacity, stability, loading priorities, and budgets.
