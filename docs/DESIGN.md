# DESIGN.md — Sistema visual de KingBelt

Fuente de verdad para UI, layout, estilos, responsive, motion y copy visual. Lee solo las secciones relevantes antes de editar.

## 1. Dirección

KingBelt debe sentirse como una ecommerce masculina moderna, limpia y editorial —con el nivel de contención de Zara, Mango o Sfera— trasladada al universo moto y leather gear.

La moto es contexto y actitud. El producto, sus materiales, su construcción y la fotografía son protagonistas.

Carácter objetivo: contemporáneo, masculino, preciso, funcional, premium accesible y orientado a producto. No debe sentirse rústico, nostálgico, agresivamente biker, delicadamente artesanal, genérico ni decorado como un moodboard.

Proporción orientativa, no fórmula mecánica:

- 45% retail masculino limpio y tipográfico.
- 25% ecommerce editorial: fotografía, grids y aire.
- 20% lifestyle moto contenido: asfalto, garaje, graphite y steel.
- 10% cuero, grano y hardware, solo ligados al producto real.

## 2. Fuentes de verdad y referencias

Orden de prioridad:

1. Tokens y primitivas vigentes en `src/styles/global.css`.
2. Componentes reutilizables existentes en `src/components/ui/` y `src/components/sections/`.
3. Composición ya aprobada en la página o flujo afectado.
4. Este documento para resolver nuevas decisiones.

Referencias especialmente útiles:

- Sistema y variantes: `FeatureCard.astro`, `Panel.astro`, `Button.astro`, `FormField.astro`, `Icon.astro`.
- Páginas y composición: `PageHeader.astro`, `faq/FAQ.astro`, `CTABox.astro`.
- Contacto: `src/pages/contacto.astro`, `src/components/sections/contact/`, `ContactMethod.astro` y `src/components/faq/`.
- Primitivas y composición: `src/components/ui/` (Button, PageHeader, Panel, FormField, etc.).

Inspecciona el componente afectado y una referencia con el mismo propósito. No copies un patrón solo porque se vea bien si su función es distinta.

## 3. Principios de composición

### Producto y contenido primero

- Fotografía grande y útil, copy limitado, jerarquía clara y espacio suficiente.
- La decoración nunca compite con producto, tarea o información.
- Cada sección debe tener un foco principal y una acción dominante como máximo.

### Originalidad con disciplina

La interfaz debe ser reconocible sin recurrir a adornos temáticos. Busca originalidad en:

- encuadres y proporciones de imagen;
- contraste entre tipografía slab y sans;
- ritmo entre superficies claras y bloques graphite/asphalt;
- composición editorial, alineaciones y escala;
- detalles funcionales inspirados en material o hardware.

Evita que todas las secciones repitan “eyebrow + título centrado + tres cards”. Alterna con intención entre media dominante, split editorial, lista técnica, bloque de lectura, grid y CTA; conserva continuidad mediante tokens, tipografía y ritmo. La variedad debe responder al contenido, no a una cuota visual.

### Ritmo de página

- Alterna densidad, escala y tono sin convertir cada sección en un concepto distinto.
- Usa separación de sección global como base; ajusta localmente solo por continuidad visual real.
- Una superficie oscura o steel debe crear pausa, jerarquía o cambio de capítulo.
- Evita encadenar varias secciones con idéntica altura, grid y alineación.
- No envuelvas cada bloque en una card. Usa el fondo de página como superficie cuando sea suficiente.

## 4. Exclusiones

No introduzcas:

- calaveras, fuego, carbono, neumáticos, cadenas o motores decorativos;
- iconografía biker genérica o estética motera de los 2000;
- exceso de negro, marrón, cognac, pergamino o dorado lujo;
- cuero/grano como fondo por defecto;
- gradientes genéricos, glassmorphism, estética SaaS o patrón WordPress;
- exceso de borders, esquineras, remaches, costuras falsas o contenedores redondeados;
- motion juguetón, continuo o sin función.

## 5. Tokens y estilos globales

`src/styles/global.css` es la única fuente para colores, tipografía, spacing compartido, radios, sombras, z-index, motion, shells, superficies y formularios.

- No hardcodees un valor si ya existe un token adecuado.
- Añade un token solo si expresa una decisión reutilizable; una excepción compositiva permanece scoped.
- No modifiques un token global para corregir un único componente.
- Usa Tailwind para layout/utilidades legibles y los globals para identidad visual.
- Antes de añadir una clase global, busca una equivalente y comprueba que el patrón se repite.

Roles principales:

- `--color-king-bg`, `--color-king-bone`, `--color-king-surface`: base clara y superficies.
- `--color-king-text`, `--color-king-muted`: jerarquía de texto.
- `--color-king-accent`, `--color-king-accent-light`, `--color-king-brass`: acción y detalle moderado.
- `--color-king-asphalt`, `--color-king-oil`, `--color-king-graphite`, `--color-king-steel`: familia industrial.

Superficies:

- `kb-card` / `kb-panel`: default claro y neutro.
- `kb-card-steel` / `kb-panel-steel`: contraste graphite autocontenido.
- `kb-card-dark`: contenido dentro de una sección ya oscura.
- `kb-leather`: modificador exclusivo de producto/material de cuero real.

No fuerces una variante steel en cada grid. Úsala cuando destaque una prioridad o mejore el ritmo sin romper la lectura del conjunto.

## 6. Tipografía y copy visual

- Bitter: H1, H2 y momentos editoriales de marca.
- Satoshi: navegación, cuerpo, botones, formularios, precio, filtros, specs y metadata.
- Un único H1; jerarquía semántica sin saltos motivados solo por tamaño.
- H1 con autoridad y H2 claramente estructural; títulos de card contenidos.
- Mayúsculas y tracking amplio solo en labels breves o eyebrows.
- Longitud de línea cómoda y titulares balanceados sin provocar seis líneas estrechas.

El copy debe ser conciso, concreto y útil. Prioriza producto, material, ajuste, proceso, atención y acción. Evita clichés de rebeldía, lujo vacío, urgencia falsa y promesas no confirmadas.

## 7. Componentes y patrones

### Hero y `PageHeader`

Imagen atmosférica dominante, overlay suficiente para contraste, breadcrumbs discretos, un H1 y descripción breve. No añadas capas decorativas si la fotografía ya sostiene el carácter.

### Cards y panels

Usa `FeatureCard`, `ContactMethod` y `Panel` según su propósito antes de aplicar primitivas a mano. Mantén una sola superficie perceptible: evita card dentro de card salvo relación funcional clara. La variante, padding y radio deben proceder de la API o de tokens.

### Split y secciones editoriales

Usa una composición scoped cuando texto y media tengan relación directa. En móvil conserva un orden semántico útil: contexto, evidencia/media y acción. La asimetría es una herramienta, no una obligación.

### Formularios

Usa `FormField`, `kb-input`, `kb-label`, `kb-select-wrap`, `kb-select-icon` y los tokens `--kb-form-*`. Mantén formularios compactos, labels persistentes, ayudas asociadas y estados claros. Corrige primero ritmo/padding antes de alterar la estética para igualar columnas.

### Iconos

Usa `Icon.astro` y el set existente. En cards informativas son secundarios, pequeños o medios y con contenedor sutil. No añadas librerías, emojis ni SVG duplicados sin comprobar antes el catálogo.

### CTA y navegación

Una acción primaria clara. Usa `Button.astro` y sus estados; enlaces para navegación, botones para acciones. Evita grupos de CTAs equivalentes y collages decorativos.

## 8. Responsive y estados

Diseña mobile-first manteniendo la misma intención editorial:

- `min-width: 0` en hijos flex/grid con texto;
- medios fluidos, dimensiones estables y `max-width: 100%`;
- grids que colapsen según contenido, no solo según dispositivo;
- sin overflow horizontal, copy cortado ni controles fuera de pantalla;
- orden semántico válido y sin duplicar contenido móvil/escritorio;
- targets táctiles cómodos y ninguna información exclusiva de hover.

Todo componente interactivo debe considerar los estados que le correspondan: default, hover, focus-visible, active, disabled, loading, error, success y empty. No inventes estados irrelevantes.

Hover y motion deben aportar respuesta o jerarquía: cambios sutiles de color, borde, sombra u offset. Usa tokens `--kb-dur-*` y `--kb-ease-*`, anima preferentemente `transform`/`opacity` y respeta `prefers-reduced-motion`. Evita efectos que desplacen layout, dificulten lectura o se ejecuten de forma perpetua.

## 9. Accesibilidad y rendimiento visual

- Contraste legible en superficies claras, steel y oscuras.
- Focus visible y coherente con el sistema.
- Alt descriptivo cuando la imagen comunica; `alt=""` cuando es puramente decorativa.
- Dimensiones/aspect ratio de medios para evitar saltos de layout.
- No sacrifiques legibilidad por una composición editorial.
- Reduce overlays, filtros, blur, sombras y assets cuando su coste no aporta una diferencia perceptible.

## 10. Definition of done visual

- Reutiliza componentes, tokens y utilidades existentes o justifica el patrón nuevo.
- El componente nuevo tiene propósito, API tipada y estilos scoped; lo compartido vive en globals.
- Producto/contenido pesa más que decoración y no aparece ninguna exclusión del §4.
- Superficies, radios, iconos y tipografía siguen el sistema.
- Estados, semántica, foco, contraste y motion reducido están cubiertos cuando aplican.
- No hay overflow ni roturas con texto largo en móvil, intermedio y escritorio.
- La página mantiene un H1, metadata y estructura SEO correctos cuando el cambio afecta una ruta.
- `bun run check` pasa y se inspecciona visualmente el alcance modificado.
