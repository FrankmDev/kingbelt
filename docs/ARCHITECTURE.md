# ARCHITECTURE.md — Arquitectura frontend de KingBelt

Lee este archivo para arquitectura de páginas, componentización, datos, estilos, scripts o refactors estructurales.

## Stack y criterio base

- Astro 7.1, Vite 8 y TypeScript estricto.
- Tailwind CSS 4 junto al sistema CSS propio.
- Bun como único gestor de paquetes.
- Renderizado estático por defecto.
- GSAP disponible, reservado para motion complejo que CSS no resuelva bien.
- `src/styles/global.css` como entrada global y fuente de tokens.

Usa Astro y HTML nativo para contenido y UI estática. Añade JavaScript cliente solo cuando la interacción lo necesite; añade un framework de islas solo si existe estado cliente complejo o una librería que lo justifique.

## Organización

```txt
src/
  components/
    layout/       # cabecera, pie y estructura global
    common/       # infraestructura editorial compartida; FAQ vive en common/faq
    ui/           # primitivas visuales reutilizables
    museum/       # documentación ejecutable del sistema visual
    blog/         # composición específica del dominio editorial
    sections/
      home/       # composición de portada
      about/      # composición corporativa
      contact/    # composición de contacto
    product/      # ficha de producto: galería y compra
    collection/   # catálogo de categoría: grid, tarjetas y filtros
    cart/         # cajón (drawer) y disparador del carrito local
    help/         # layouts y componentes del centro de ayuda
    legal/        # layouts, avisos y formulario de desistimiento (inactivo)
  data/           # contenido/configuración local tipada
    business.ts   # contrato BusinessFact (confirmed/pending)
    help.ts       # navegación y contenido de ayuda
    legal.ts      # documentos legales, sitemap y cookies
  lib/
    commerce/     # dominio neutral, proveedor activo y adaptador local
    dom/          # utilidades cliente compartidas (scroll y estados de botón)
  layouts/
  pages/          # rutas; coordinan datos y componentes
  scripts/        # controladores cliente procesados por Astro
  styles/
    global.css    # tokens, base y patrones compartidos
    cart.css      # excepción de dominio del carrito
```

La estructura es una guía, no un motivo para crear carpetas vacías. Coloca cada pieza en el nivel más pequeño que refleje su responsabilidad real.

`astro.config.mjs` mantiene `compressHTML: true` para conservar el tratamiento de espacios de Astro 6 y `fetchFile: null` para no activar Advanced Routing. El proyecto no usa adapter, SSR ni flags experimentales.

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

### Componentes editoriales complejos

- `common/faq/FAQ.astro` coordina layout, slots, filtros y CTA; `FAQItem.astro` posee el contrato y los estilos de cada `details/summary`. Los tipos compartidos viven junto a ambos.
- `blog/ArticleReadingSection.astro` coordina cabecera y composición; `ArticleBody.astro` renderiza capítulos y pie editorial; `ArticleIndex.astro` contiene disclosure, navegación y sticky.
- `layout/Header.astro` y `layout/FooterSection.astro` siguen siendo los layouts públicos. `MobileNavigation.astro` encapsula únicamente el panel móvil.

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

`Button.astro` mantiene una unión entre enlace y botón basada en `HTMLAttributes<'a'>` y `HTMLAttributes<'button'>`; reenvía atributos nativos y reserva `href`, `target`, `rel`, `type` y `disabled` para impedir combinaciones incoherentes. `FormField.astro` no modifica el control slotted: el consumidor debe compartir el `id` indicado por `for`, enlazar los IDs de ayuda/error mediante `aria-describedby` y añadir `aria-invalid="true"` cuando exista error.

## Datos y futura integración

Flujos previstos:

```txt
pages / components → catalog-provider.ts → local-catalog.ts ahora / adaptador Shopify después
cart-client.ts     → provider.ts         → local-provider.ts ahora / adaptador Shopify después
```

Catálogo y carrito tienen fronteras distintas y reducidas. Las páginas consumen `CatalogProvider`; el estado cliente consume `CommerceProvider`. Los componentes importan únicamente el dominio neutral de `types.ts`, nunca fixtures, respuestas ni clientes de Shopify. El proveedor local resuelve producto, variante, precio, URL, imagen y stock desde el catálogo tipado. `localStorage` conserva solo ID de variante y cantidad bajo un esquema versionado y limitado; nunca es autoridad para precio, disponibilidad ni checkout.

Al conectar Shopify:

- normaliza `Money`, producto, variante y líneas dentro del adaptador;
- conserva las credenciales privadas y tokens no públicos exclusivamente en código servidor mediante `astro:env/server`;
- no pases secretos por `PUBLIC_*`, `define:vars`, HTML, atributos `data-*`, eventos DOM ni almacenamiento del navegador;
- si la operación requiere un secreto, añade primero un adapter de despliegue y una frontera servidor; el build estático actual no puede custodiarlo;
- devuelve la URL de checkout junto con una lista exacta de hosts permitidos; la UI exige HTTPS, sin credenciales embebidas ni hosts por sufijo;
- considera todo precio, stock y cantidad enviados por el navegador datos no confiables y vuelve a validarlos antes de crear o actualizar el carrito remoto.

La política de referrer se define en `BaseLayout.astro`. Cuando se conozca el hosting, configura allí —como cabeceras HTTP y no como una falsa garantía dentro del cliente— CSP, HSTS, `X-Content-Type-Options`, `Permissions-Policy` y la política de framing. La CSP debe inventariar primero los scripts y las fuentes externas reales del proyecto.

Los scripts interactivos dentro de `src/` deben mantenerse procesados por Astro para obtener bundling, TypeScript y deduplicación. No uses `define:vars` en un script que importe módulos: pasa únicamente identificadores públicos mediante el HTML y resuélvelos contra el proveedor.

Mantén contenido/configuración global en `src/data/` cuando evite duplicación y no mezcles transformación de datos con presentación.

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
- Los controladores `faq.ts`, `article-index.ts`, `header.ts` y `footer.ts` exportan una inicialización idempotente por raíz. Los componentes los importan desde scripts Astro procesados; cada controlador devuelve su limpieza.
- Usa GSAP solo para secuencias, timelines o coordinación avanzada; registra y limpia instancias cuando el ciclo de navegación lo requiera.
- Todo efecto debe tener estado inicial seguro, fallback sin JavaScript y soporte para `prefers-reduced-motion`.
- Anima `transform` y `opacity` siempre que sea posible; evita animar propiedades que provoquen layout continuo.

## Accesibilidad, SEO y rendimiento

- HTML semántico, foco visible, labels, nombres accesibles y contraste suficiente.
- Botón para acciones; enlace para navegación. No simules interacción con `div`.
- Imágenes con dimensiones para evitar CLS, `alt` contextual y lazy loading salvo contenido crítico/hero.
- Un H1 por página, `title`, description, canonical y schema cuando corresponda.
- `BaseLayout` acepta `robots`, `ogImageAlt` (vía `imageAlt`), `publishedAt` y `updatedAt`.
- Sitemap: `@astrojs/sitemap` con filtro en `isSitemapExcluded()` (`src/data/legal.ts`).
- `robots.txt`: endpoint estático en `src/pages/robots.txt.ts`.
- Documentos legales en `draft` usan `noindex,follow` y quedan fuera del sitemap hasta publicación.
- No añadas dependencias, hydration o JavaScript para resolver algo que Astro/CSS/HTML ya cubre.
- Evita trabajo duplicado en cliente y assets desproporcionados para su tamaño visible.

## Validación

Según el cambio, `bun run validate` agrupa sin duplicar:

1. `bun run check` para tipos y diagnósticos Astro.
2. `bun run test` para contratos de comercio y persistencia.
3. `bun run build` para cambios estructurales, rutas, datos o integración.
4. Inspección visual de móvil y escritorio para UI.
5. Comprobación de overflow, focus, reduced motion, estados hover/active/disabled y contenido largo cuando apliquen.

No declares completada una tarea si el check relevante falla por tus cambios. Distingue claramente errores previos del proyecto.

`.github/workflows/quality.yml` ejecuta esos tres pasos con Bun fijado en cada push a `main` y pull request.
