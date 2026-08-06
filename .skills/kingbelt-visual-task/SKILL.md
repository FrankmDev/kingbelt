---
name: kingbelt-visual-task
description: "Crear, diseñar, implementar, ampliar, refactorizar y auditar interfaces de KingBelt. Usar en páginas, secciones, componentes, layouts, navegación, ecommerce, formularios, responsive, estilos, estados, interacción y motion del proyecto Astro, incluidos ajustes locales y flujos visuales completos."
---

# KingBelt visual task

Producir interfaces KingBelt distintivas, coherentes y listas para producción. Aplicar ambición creativa, criterio editorial y rigor técnico sin crear un sistema paralelo ni convertir cada tarea en una ceremonia.

## 1. Seguir las fuentes de verdad

Resolver primero la raíz del repositorio y aplicar, en este orden:

1. La petición actual del usuario y sus límites.
2. El `AGENTS.md` aplicable al archivo afectado.
3. La documentación vigente del proyecto.
4. Los contratos, estilos globales y convenciones que realmente usa el código.
5. Esta skill como proceso de trabajo visual.

Leer siempre `AGENTS.md` y las secciones relevantes de `docs/DESIGN.md`. Leer `docs/ARCHITECTURE.md` cuando el cambio altere o dependa de contratos de componentes, composición de páginas, datos, scripts o estructura; leer `docs/PROJECT.md` cuando intervengan copy público, ecommerce, negocio, alcance, fases o rutas futuras. Consultar otros documentos solo si gobiernan el área afectada.

No duplicar mentalmente decisiones de marca que ya tengan una fuente más específica. Ante discrepancias, priorizar la fuente más específica y actual, confirmar su uso en el código cuando sea posible y señalar únicamente conflictos que afecten materialmente al resultado. Tratar esta skill como guía operativa, no como inventario fijo de tokens, fuentes, clases, comandos o librerías.

## 2. Ajustar el proceso al alcance y al riesgo

Clasificar internamente la tarea para decidir cuánto inspeccionar, comunicar y validar:

- **Local:** corrección aislada de estilos, contenido visual, estado o responsive con contrato estable. Inspeccionar el objetivo, su padre, los consumidores directamente afectados y la referencia equivalente más cercana solo si hace falta resolver una decisión visual. Comunicar solo lo mínimo exigido por `AGENTS.md` y ejecutar.
- **Compartida:** cambio en una primitiva, sección reutilizable, navegación, formulario, token o comportamiento consumido en varios lugares. Inspeccionar contrato, consumidores representativos, cascade y referencia funcional equivalente; comunicar brevemente enfoque y archivos previstos.
- **Alta incidencia:** página nueva, flujo ecommerce, navegación global, layout, sistema de formularios, motion complejo o refactor transversal. Inspeccionar el recorrido completo, referencias aprobadas y patrones equivalentes; definir jerarquía, composición, contratos, responsive, estados y validación antes de editar.

Leer archivos completos cuando sea necesario para entender un contrato, la cascade, scripts o consumidores y evitar regresiones. Para búsquedas iniciales, localizar primero símbolos y patrones relevantes con las herramientas disponibles.

Usar Contacto u otra página aprobada, junto con las primitivas en `src/components/ui/`, para descubrir APIs y variantes existentes; nunca como plantilla compositiva a clonar. En páginas y flujos importantes, contrastar más de una referencia si ayuda a distinguir sistema compartido de decisiones locales.

## 3. Actuar con autonomía responsable

Tomar decisiones visuales y técnicas locales, reversibles y consistentes sin pedir confirmación. Elegir la opción que mejor preserve intención, contratos y alcance; documentar al finalizar cualquier decisión no obvia.

Detenerse y pedir dirección solo si la ambigüedad cambia materialmente alguno de estos puntos:

- arquitectura compartida o modelo de datos;
- comportamiento comercial, información empresarial o copy que no pueda inventarse;
- rutas públicas, dependencias o integración externa;
- identidad de marca;
- operación irreversible o ampliación significativa del alcance.

Si una fuente parece obsoleta pero el código permite una solución segura, seguir la evidencia más actual y mencionar la discrepancia. No bloquear una mejora local por una duda que pueda resolverse inspeccionando el repositorio o escogiendo una alternativa reversible.

## 4. Diseñar con originalidad KingBelt

Mantener la identidad definida en `docs/DESIGN.md`: ecommerce masculina limpia y editorial, carácter industrial/moto contenido y producto, fotografía y contenido por delante de la decoración. No reinterpretar la marca en cada página ni aplicar creatividad arbitraria.

Para páginas, flujos o secciones de alto impacto, evaluar internamente varias composiciones viables y elegir la más clara, propia y eficiente, no la más efectista. Para ajustes locales, reforzar la composición existente sin inventar un concepto nuevo.

Exigir siempre:

- un foco y una acción dominantes acordes al contenido;
- jerarquía tipográfica y semántica clara;
- composición reconocible, ritmo entre secciones y espacio útil;
- fotografía o producto con peso visual cuando existan;
- contraste y densidad controlados;
- responsive rediseñado por capacidad del contenido, no solo reducido;
- estados y motion con función real;
- rechazo de plantillas intercambiables, grids monótonos, cardificación sistemática y recursos genéricos de IA.

Buscar originalidad en encuadre, escala, proporción, alineación, ritmo, contraste de superficies y detalles funcionales vinculados al producto. Variar siluetas cuando el recorrido lo necesite, manteniendo continuidad mediante el sistema vigente. Aplicar las exclusiones y el criterio de copy de `docs/DESIGN.md` y el alcance confirmado en `docs/PROJECT.md`.

## 5. Trabajar dentro del sistema

Buscar antes de crear y seguir este orden:

1. Reutilizar una solución y su API existentes.
2. Extender una variante compatible con el mismo propósito.
3. Componer primitivas existentes para una necesidad singular.
4. Crear un componente nuevo con responsabilidad, contrato, estados o reutilización reales.
5. Crear un token o utilidad global solo para una decisión compartida y repetible.

Usar los estilos globales vigentes como fuente de tokens y primitivas. No hardcodear una decisión ya tokenizada, duplicar una utilidad global en CSS local, modificar tokens compartidos para resolver una excepción ni promover prematuramente una composición única. Mantener en CSS scoped la composición o excepción local; mantener en el componente reutilizable sus variantes, estados y responsive. Usar las utilidades del stack solo cuando conserven legibilidad y coherencia con el repositorio.

No extraer wrappers triviales, crear variantes casi idénticas, diseñar abstracciones especulativas ni introducir props que mezclen responsabilidades. No construir card dentro de card sin una relación funcional clara. Si el patrón nuevo solo resuelve una página, mantenerlo local hasta demostrar repetición.

## 6. Implementar Astro de producción

- Preferir Astro y HTML semántico; no hidratar contenido estático.
- Añadir JavaScript solo para comportamiento real y limitar scripts reutilizables a una raíz segura para evitar listeners u observers duplicados.
- Tipar props y datos sin `any`; reenviar `class` y atributos HTML válidos cuando el contrato lo requiera.
- Usar `class:list`, slots y variantes pequeñas para evitar markup duplicado sin ocultar una composición editorial singular.
- Garantizar IDs únicos o suministrables en relaciones ARIA, formularios y componentes repetibles.
- Mantener páginas declarativas: ruta para datos, SEO y orden; componentes para presentación; datos e integración separados de la UI.
- No llamar a Shopify directamente desde componentes visuales; respetar la capa de comercio definida por la arquitectura.
- Usar correctamente `astro:assets` para medios procesables y reservar recursos públicos para los casos previstos por Astro y el repositorio; proporcionar dimensiones o proporción estables.
- Preferir comportamiento nativo antes de recrearlo con scripts.
- No añadir frameworks, dependencias, hidratación ni assets decorativos sin una necesidad demostrable y autorización cuando corresponda.

Detectar versiones, integraciones y capacidades desde la configuración actual; no asumir que una librería continúa disponible. Para motion, usar CSS para feedback y transiciones simples; usar una librería existente solo si el efecto complejo aporta valor y CSS no lo resuelve razonablemente.

## 7. Integrar calidad visual, accesibilidad y rendimiento

Diseñar los requisitos aplicables desde el contrato, no como parche final:

- landmarks, headings, enlaces y botones semánticos;
- foco visible, teclado, nombre accesible y estado comunicado;
- labels, ayuda, errores y relaciones ARIA correctas en formularios;
- contraste suficiente y significado no dependiente solo de color, icono, hover o motion;
- `alt` contextual o vacío según la función de la imagen;
- targets táctiles cómodos, orden de lectura estable y ninguna información esencial exclusiva de hover;
- medios estables, sin CLS evitable, y carga apropiada a su prioridad;
- fallback útil sin JavaScript cuando sea viable y `prefers-reduced-motion` para movimiento no esencial;
- ausencia de overflow, truncado accidental o ruptura con texto largo, zoom y contenido real.

Diseñar desde móvil y ampliar según el contenido. Revisar un rango intermedio cuando cambien grids, navegación, sticky, formularios, media o reordenación. Probar solo los estados que el componente realmente tenga. Evitar optimizaciones CSS o efectos costosos sin beneficio observable.

## 8. Controlar el alcance

Modificar únicamente lo necesario para lograr la petición y proteger sus consumidores directos. No aprovechar una tarea local para refactorizar el design system, modernizar áreas vecinas o adelantar fases del producto.

Corregir un problema lateral solo si bloquea la implementación o si el cambio actual causaría una regresión directa. En los demás casos, conservarlo y mencionarlo brevemente como observación pendiente. Preservar cambios ajenos y revisar el diff para detectar expansión accidental.

## 9. Validar según evidencia y riesgo

Descubrir el gestor de paquetes, scripts y herramientas desde locks, `package.json`, configuración y `AGENTS.md`; no fijar un comando por costumbre.

- En cambios de código, ejecutar el script disponible de check o typecheck.
- Ejecutar build cuando cambien rutas, renderizado, datos, assets, scripts, integración o estructura con riesgo de compilación.
- Ejecutar lint y tests cuando existan y sean aplicables al alcance.
- Inspeccionar el resultado renderizado de toda modificación visual cuando sea viable. Para un ajuste mínimo sin impacto de layout, bastan el contexto y estado afectados; para cambios compartidos o de alta incidencia, revisar móvil, rango intermedio si aplica y escritorio.
- Comprobar estados, teclado, foco, contraste, reduced motion, contenido largo, zoom, overflow y CLS únicamente en la medida en que el cambio los pueda afectar.
- Revisar consumidores representativos de cualquier componente o token compartido.

Revisar el diff antes y después de los checks. No declarar éxito solo porque compile: contrastar también intención visual, resultado renderizado y ausencia de regresiones. Separar claramente fallos previos de fallos introducidos y repetir únicamente las validaciones afectadas por una corrección.

## 10. Entregar con concisión

Informar de:

- resultado y decisiones relevantes;
- archivos modificados;
- componentes o tokens reutilizados, extendidos o creados;
- checks, viewports y estados revisados cuando correspondan;
- límites reales o problemas pendientes.

No narrar razonamiento interno ni resumir toda la documentación leída.
