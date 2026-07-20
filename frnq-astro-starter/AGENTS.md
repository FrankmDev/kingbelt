# Project instructions

Always read `project.config.ts` before starting.

If `projectConfig.meta.initialized` is `false`:
- Read `PROJECT_START.md` completely.
- Follow its initialization protocol.
- Do not begin page implementation until initialization is complete.

If the project is initialized, read only the context required for the task.

Context routing:
- Business and content: `docs/project/PROJECT.md`
- Visual work: `docs/project/DESIGN.md`
- Architecture and componentization: `docs/project/ARCHITECTURE.md`
- Page work: corresponding file in `docs/project/pages/`
- Validation: `docs/project/QA.md`

Always:
- Keep changes within the requested scope.
- Do not modify unrelated files.
- Do not add dependencies without justification.
- Do not modify global tokens to solve an isolated local issue.
- Use Astro by default.
- Use Tailwind utilities; keep shared tokens and base rules in `src/styles/globals.css`.
- Add client JavaScript only for real interaction.
- Run the checks defined in `docs/project/QA.md`.
