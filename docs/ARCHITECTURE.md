# ARCHITECTURE.md — Arquitectura frontend de KingBelt

Lee este archivo para arquitectura de páginas, componentización, datos, estilos, scripts o refactors estructurales.

## Stack y criterio base

- Astro 6 y TypeScript estricto.
- Tailwind CSS 4 junto al sistema CSS propio.
- Renderizado estático por defecto.
- GSAP disponible, reservado para motion complejo que CSS no resuelva bien.
- `src/styles/global.css` como entrada global y fuente de tokens.

Usa Astro y HTML nativo para contenido y UI estática. Añade JavaScript cliente solo cuando la interacción lo necesite; añade un framework de islas solo si existe estado cliente complejo o una librería que lo justifique.

## Organización

```txt
src/
  components/
    layout/       # cabecera, pie y estructura global
    ui/           # primitivas visuales reutilizables
    sections/     # secciones reutilizables de página
    blog/         # composición específica del dominio editorial
    contact/      # composición específica de contacto, si crece
    product/      # futuro
    collection/   # futuro
    cart/         # futuro
  data/           # contenido/configuración local tipada
  lib/
    commerce/     # tipos, adaptadores y mappers de comercio
    seo.ts
    utils.ts
  layouts/
  pages/          # rutas; coordinan datos y componentes
  styles/global.css
```

La estructura es una guía, no un motivo para crear carpetas vacías. Coloca cada pieza en el nivel más pequeño que refleje su responsabilidad real.

## Responsabilidades

- **Página:** obtiene/selecciona datos, define SEO y schema, decide el orden de secciones. Evita markup repetitivo o grandes bloques de estilo.
- **Layout:** estructura compartida del documento, metadata global y slots principales.
- **Section:** bloque de página con propósito propio y posible reutilización.
- **UI:** primitiva visual o interactiva independiente del contenido de una página.
- **Data/lib:** contenido estable, tipos, transformaciones e integración externa.

Extrae un componente cuando al menos una condición sea cierta:

- se usa o es probable que se use en más de un lugar;
- tiene API, estados, accesibilidad o responsive propios;
- su extracción hace que la página exprese mejor la composición;
- encapsula un patrón que debe permanecer consistente.

No extraigas wrappers triviales que solo oculten dos clases ni crees variantes casi idénticas. Prefiere props y slots pequeños, explícitos y tipados.

## Patrones Astro

- Define `interface Props` y usa `Astro.props`; evita `any` y casts amplios.
- Extiende `HTMLAttributes<'element'>` cuando un componente debe aceptar atributos HTML válidos.
- Separa el frontmatter de la presentación y deriva constantes una sola vez.
- Usa `class:list` para variantes; evita concatenación frágil de clases.
- Usa slots para composición y props para datos/variantes con contrato claro.
- Mantén las páginas delgadas: datos y orden arriba, composición declarativa abajo.
- Usa bucles para estructuras realmente repetidas y con claves/contenido homogéneo; no fuerces abstracciones que hagan ilegible una composición editorial singular.
- Importa recursos procesables desde `src/` cuando necesiten optimización. Reserva `public/` para archivos que deban servirse sin transformación.
- Conserva HTML semántico, una jerarquía de headings correcta y comportamiento nativo antes de recrearlo con scripts.

## Datos y futura integración

Flujo previsto:

```txt
pages / components
  → src/lib/commerce/
  → implementación local o Shopify Storefront API
```

Los componentes no llaman a Shopify. La capa de comercio normaliza respuestas externas al modelo genérico del proyecto. Mantén contenido/configuración global en `src/data/` cuando evite duplicación y no mezcles transformación de datos con presentación.

## CSS y sistema global

`src/styles/global.css` contiene:

- tokens de color, tipo, espacio, radio, sombra, z-index y motion;
- reset y estilos base;
- shells, ritmos de sección y utilidades compartidas;
- superficies, botones, formularios y patrones reutilizados.

El `<style>` de un componente contiene únicamente:

- layout y apariencia propios del componente;
- estados/variantes de su API;
- responsive específico;
- ajustes de elementos slotted mediante `:global()` cuando sean necesarios.

Usa Tailwind para layout y utilidades sencillas cuando mantenga el markup legible. Usa variables globales dentro de CSS o clases arbitrarias para respetar tokens. No dupliques una primitiva global en estilos locales ni conviertas una composición única en utilidad global prematuramente.

Promueve un patrón a global o a componente cuando se repita con la misma intención. No cambies un token global para arreglar una excepción local.

## Responsive

- Diseña mobile-first y añade complejidad solo cuando haya espacio.
- Evita breakpoints para corregir dimensiones rígidas que no deberían existir.
- Usa `min-width: 0` en hijos flex/grid con texto, medios fluidos y tamaños con `clamp()` cuando proceda.
- Verifica 320–390 px, un ancho intermedio y escritorio; revisa también zoom y textos largos cuando el riesgo lo justifique.
- Mantén el orden semántico útil sin CSS y no dupliques contenido para crear la versión móvil.
- Evita overflow horizontal, targets táctiles pequeños y hover como único medio para acceder a información.

## Interacción y motion

- CSS para hover, focus, transiciones y revelados simples.
- Reutiliza el patrón compartido de reveal antes de crear otro `IntersectionObserver`.
- Si un script es local, limítalo mediante un `data-*` raíz y evita consultas globales que dupliquen listeners al reutilizar componentes.
- Usa GSAP solo para secuencias, timelines o coordinación avanzada; registra y limpia instancias cuando el ciclo de navegación lo requiera.
- Todo efecto debe tener estado inicial seguro, fallback sin JavaScript y soporte para `prefers-reduced-motion`.
- Anima `transform` y `opacity` siempre que sea posible; evita animar propiedades que provoquen layout continuo.

## Accesibilidad, SEO y rendimiento

- HTML semántico, foco visible, labels, nombres accesibles y contraste suficiente.
- Botón para acciones; enlace para navegación. No simules interacción con `div`.
- Imágenes con dimensiones para evitar CLS, `alt` contextual y lazy loading salvo contenido crítico/hero.
- Un H1 por página, `title`, description, canonical y schema cuando corresponda.
- No añadas dependencias, hydration o JavaScript para resolver algo que Astro/CSS/HTML ya cubre.
- Evita trabajo duplicado en cliente y assets desproporcionados para su tamaño visible.

## Validación

Según el cambio:

1. `npm run check` para tipos y diagnósticos Astro.
2. `npm run build` para cambios estructurales, rutas, datos o integración.
3. Inspección visual de móvil y escritorio para UI.
4. Comprobación de overflow, focus, reduced motion, estados hover/active/disabled y contenido largo cuando apliquen.

No declares completada una tarea si el check relevante falla por tus cambios. Distingue claramente errores previos del proyecto.
