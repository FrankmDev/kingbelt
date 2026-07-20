# {{PROJECT_NAME}} — QA

## Required commands

```bash
bun run check
bun run build
```

## Viewports

- Mobile: 390 × 844
- Tablet: 768 × 1024
- Desktop: 1440 × 1000
- Risk check: 320 px when navigation, forms, grids, or long labels change

## Functional and content checks

Navigation, links, forms, 404, one `h1`, title, description, canonical, language, structured data, sitemap, robots, broken media, and factual placeholders.

## Accessibility checks

Landmarks, heading order, keyboard operation, focus visibility, accessible names, labels and errors, targets, contrast, zoom, alt text, non-color cues, and reduced motion.

## Visual and responsive checks

No horizontal overflow, stable media, no accidental truncation, correct reading order, useful content capacity, consistent tokens, and rendered output compared with `DESIGN.md`.

## Performance checks

No unjustified hydration, correctly prioritized images, stable dimensions, restrained fonts, minimal third-party code, and no dependency used only for CSS-solvable behavior.

## Release gate

Record command results, inspected routes and viewports, remaining limitations, and owner of every unresolved issue. Add project-specific automated checks only when the project needs them.
