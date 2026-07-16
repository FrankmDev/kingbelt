# AGENTS.md — KingBelt

Lee este archivo antes de modificar código, estilos, copy, componentes o estructura de páginas.

KingBelt ya tiene una dirección visual y técnica definida. No rediseñes áreas que funcionan ni amplíes el alcance sin una petición explícita.

## Carga de contexto

Lee solo el contexto necesario para la tarea:

- Siempre: `AGENTS.md`.
- UI, estilos, layout, copy o responsive: `docs/DESIGN.md`.
- Arquitectura de página, componentes, datos o scripts: `docs/ARCHITECTURE.md`.
- Producto, negocio, contenidos o alcance: `docs/PROJECT.md`.

Antes de cualquier tarea visual, lee y aplica además:

- `.skills/kingbelt-visual-task/SKILL.md`

`kingbelt-visual-task` es autosuficiente e incorpora el criterio creativo, visual y técnico necesario para este proyecto. No necesita combinarse con `$frontend-design`; si ambas se invocan explícitamente, prevalece KingBelt en dirección estética, tipografía, paleta, superficies, componentes, motion y alcance.

No empieces la implementación visual hasta revisar sus reglas relevantes. En tareas puramente técnicas y sin impacto visual, `docs/DESIGN.md` y la skill son opcionales.

## Inicio de una tarea visual

Antes de editar, indica brevemente:

1. las reglas visuales relevantes;
2. los archivos que esperas modificar;
3. cualquier conflicto con el sistema de diseño.

No resumas documentos completos. Si no existe conflicto, indícalo en una frase y continúa.

## Responsabilidad de cada documento

- `docs/DESIGN.md`: cómo debe verse, sentirse y comportarse la interfaz.
- `docs/ARCHITECTURE.md`: cómo se organiza e implementa con Astro.
- `docs/PROJECT.md`: qué es el producto, su alcance y sus fases.
- `.skills/kingbelt-visual-task/SKILL.md`: proceso creativo y operativo completo para interfaces KingBelt.

No dupliques su contenido aquí. Este archivo solo decide qué contexto cargar y fija las reglas generales de trabajo.

## Reglas generales

- Inspecciona los archivos afectados y conserva cambios ajenos a la tarea.
- Reutiliza tokens, utilidades y componentes antes de crear variantes nuevas.
- Crea un componente nuevo cuando represente una unidad reutilizable o reduzca complejidad real; no para fragmentos triviales de una sola página.
- Usa Astro y HTML semántico por defecto. Añade JavaScript cliente o frameworks solo cuando exista una necesidad de interacción o estado.
- Mantén props tipadas, datos separados de la presentación y nombres de dominio genéricos.
- No implementes funcionalidades de fases futuras, Shopify ni dependencias nuevas sin petición explícita.
- Haz cambios proporcionados al alcance y valida según el riesgo. Para UI, comprueba al menos móvil y escritorio cuando sea viable.
