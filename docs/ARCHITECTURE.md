# ARCHITECTURE.md — Arquitectura frontend de KingBelt

Lee este archivo para arquitectura de páginas, componentización, datos, estilos, scripts o refactors estructurales.

## Stack y criterio base

- Astro 7.2, Vite 8 y TypeScript estricto.
- Tailwind CSS 4 junto al sistema CSS propio.
- Bun como único gestor de paquetes.
- Renderizado server-side en Vercel; las páginas editoriales pueden prerenderizarse cuando no dependen de comercio.
- GSAP disponible, reservado para motion complejo que CSS no resuelva bien.
- `src/styles/global.css` como entrada global y fuente de tokens.

Usa Astro y HTML nativo para contenido y UI estática. Añade JavaScript cliente solo cuando la interacción lo necesite; añade un framework de islas solo si existe estado cliente complejo o una librería que lo justifique.

## Organización

```txt
src/
  commerce/                 # comercio neutral y sustituible
    domain/                 # entidades y reglas puras: catálogo, variantes, stock, dinero y carrito
    application/            # puertos, casos de uso, validación y checkout
    infrastructure/
      demo/                 # adaptadores locales y persistencia de demostración
      shopify/              # gateway, importador y adaptador Storefront server-side
    commerce-source.ts      # selección explícita y tipada: demo | shopify
    catalog.ts              # composición del proveedor de catálogo activo
    cart.ts                 # composición del proveedor de carrito activo
  components/
    layout/       # cabecera, pie y estructura global
    faq/          # presentación y comportamiento visual de preguntas frecuentes
    ui/           # primitivas visuales reutilizables
    blog/         # composición específica del dominio editorial
    sections/
      home/       # composición de portada
      about/      # composición corporativa
      contact/    # composición de contacto
    product/      # ficha de producto: galería y compra
    collection/   # catálogo de categoría: grid, tarjetas y filtros
    cart/         # cajón (drawer) y disparador; solo presentación
    help/         # layouts y componentes del centro de ayuda
    legal/        # layouts, avisos y formulario de desistimiento (inactivo)
  config/                   # configuración global y hechos empresariales
  content/                  # datos editoriales tipados; no contiene integración
  demo-catalog.ts           # catálogo ficticio, fuera de los contratos de producción
  layouts/
  pages/          # rutas; coordinan datos y componentes; `pages/api/` aloja los endpoints BFF same-origin (carrito y webhook de rebuild)
  scripts/                  # controladores cliente procesados por Astro
    commerce/               # store, controlador y render de carrito, producto, galería y filtros
  shared/
    browser/                # utilidades DOM sin lógica comercial
  styles/
    global.css    # tokens, base y patrones compartidos
    cart.css      # excepción de dominio del carrito
scripts/          # herramientas de build/validación, no se envían al navegador
```

La estructura es una guía, no un motivo para crear carpetas vacías. Coloca cada pieza en el nivel más pequeño que refleje su responsabilidad real.

`astro.config.mjs` mantiene `compressHTML: true` para reducir el HTML, `fetchFile: null` para no activar Advanced Routing y `devToolbar.enabled: false` para desactivar el astronauta/Dev Toolbar en desarrollo. El proyecto renderiza bajo demanda con `output: 'server'` y el adapter `@astrojs/vercel`; solo los artículos del blog se prerenderizan por ser contenido editorial del repositorio. No usa flags experimentales.

## Responsabilidades

- **Página:** obtiene/selecciona datos, define SEO y schema, decide el orden de secciones. Evita markup repetitivo o grandes bloques de estilo.
- **Layout:** estructura compartida del documento, metadata global y slots principales.
- **Section:** bloque de página con propósito propio y posible reutilización.
- **UI:** primitiva visual o interactiva independiente del contenido de una página.
- **Domain:** modelos y reglas comerciales puras; no importa aplicación, infraestructura ni presentación.
- **Application:** define puertos y coordina casos de uso; solo depende del dominio.
- **Infrastructure:** implementa puertos y traduce un origen concreto al dominio. Nunca es importada por componentes.
- **Composition root:** `commerce/catalog.ts`, `commerce/cart.ts` y `commerce/cart-server.ts` eligen adaptadores. Solo rutas y scripts de entrada consumen estas fronteras.
- **Content/config:** contenido editorial y configuración estable, separados de fixtures y transformación comercial.
- **Scripts:** comportamiento del navegador. Pueden consumir dominio, aplicación, composition roots y utilidades compartidas, no adaptadores concretos.

Extrae un componente cuando al menos una condición sea cierta:

- se usa o es probable que se use en más de un lugar;
- tiene API, estados, accesibilidad o responsive propios;
- su extracción hace que la página exprese mejor la composición;
- encapsula un patrón que debe permanecer consistente.

No extraigas wrappers triviales que solo oculten dos clases ni crees variantes casi idénticas. Prefiere props y slots pequeños, explícitos y tipados.

### Componentes editoriales complejos

- `faq/FAQ.astro` coordina layout, slots, filtros y CTA; `FAQItem.astro` posee el contrato y los estilos de cada `details/summary`. El contrato editorial vive en `content/faq.ts`.
- `blog/ArticleReadingSection.astro` coordina cabecera y composición; `ArticleBody.astro` renderiza capítulos y pie editorial; `ArticleIndex.astro` contiene disclosure, navegación y sticky.
- `layout/Header.astro` y `layout/Footer.astro` siguen siendo los layouts públicos. `MobileNavigation.astro` encapsula únicamente el panel móvil.

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

## Comercio, datos y futura integración

Flujos actuales:

```txt
COMMERCE_SOURCE=demo
  pages   → commerce/catalog.ts → CatalogProvider demo
  scripts → commerce/cart.ts    → CartProvider demo → localStorage + `/cart-catalog.json`

COMMERCE_SOURCE=shopify
  pages   → commerce/catalog.ts → CatalogProvider Shopify
  scripts → commerce/cart.ts    → CartProvider Shopify → BFF `/api/cart` → Cart API

components → commerce/domain/* (solo contratos y reglas neutrales)
```

`COMMERCE_SOURCE` es una variable pública obligatoria de `astro:env/client`; solo admite `demo` y `shopify`. `commerce/commerce-source.ts` es la única fuente tipada de esa decisión. El composition root del carrito importa en diferido el adaptador elegido para no meter el otro en el bundle del navegador. La presencia de credenciales valida la rama Shopify, pero nunca la selecciona. Una configuración Shopify incompleta falla cerrada y no conecta con demo.

Catálogo y carrito tienen puertos distintos: `CatalogProvider` para lectura en servidor y `CartProvider` para estado cliente y checkout. Los componentes importan únicamente contratos o reglas de `commerce/domain`; nunca composition roots, fixtures, respuestas ni clientes externos. `demo-catalog.ts` contiene datos ficticios y solo puede importarlo `commerce/infrastructure/demo`. En modo demo, `localStorage` conserva únicamente ID de variante y cantidad bajo un esquema versionado y limitado; nunca es autoridad para precio, disponibilidad ni checkout. En modo Shopify no se usa `localStorage`: el estado persistente depende de la cookie `HttpOnly`, `/api/cart` y Cart API.

El store cliente termina su inicialización antes de ejecutar comandos, serializa mutaciones distintas, deduplica envíos equivalentes y coalesce cambios de cantidad por línea. El adaptador demo carga el snapshot `/cart-catalog.json` —servido bajo demanda desde el catálogo vigente, sin dependencia de builds— antes de restaurar líneas, relee y reconcilia la persistencia dentro de un bloqueo compartido entre pestañas cuando el navegador ofrece Web Locks; los eventos de `storage` actualizan el mismo store consumido por drawer y página. Cada reconciliación reconstruye título, imagen, precio, disponibilidad y stock desde ese catálogo. Una excepción de almacenamiento degrada el carrito a memoria con aviso, sin reemplazar el último estado válido.

Todo adaptador valida el catálogo normalizado antes de exponerlo. `assertValidCatalog()` falla con rutas y códigos concretos para identidades, relaciones, opciones, variantes, dinero, inventario, medios y colecciones; los adaptadores demo y Shopify ejecutan la misma frontera. El importador Shopify pagina internamente y solo corre en servidor; cada instancia conserva el catálogo en una caché breve (30 s en producción) y, si Shopify falla con un catálogo válido previo, sirve ese último catálogo (stale-if-error) en vez de convertir las páginas en errores.

`Product`, `ProductVariant`, `ProductOption`, `ProductImage`, `Collection`, `Money`, `Cart` y `CartLine` son nombres de dominio. Interfaces y tipos usan `PascalCase`; funciones, valores y archivos usan `camelCase` y `kebab-case`; una implementación externa termina en `-adapter.ts`. No se usan barrels `index.ts`: cada import declara su dependencia concreta.

`Product` es el agregado canónico y no almacena precio mínimo/máximo, disponibilidad global, colores para grid, referencias expandidas de colección ni objetos de imagen dentro de variantes. Esos datos se derivan en `ProductSummary`, carrito y ficha mediante funciones puras. La pertenencia a colecciones vive solo en `Product.collectionIds`; `Collection` no mantiene una lista inversa de productos.

Una variante selecciona IDs de valores de opción existentes. El inventario es una unión explícita `known` | `unknown`, separada de `inventoryPolicy` (`deny` | `continue`), `salesStatus` y la regla `quantityRule` (`minimum`, `increment`, `maximum?`) declarada por el origen. La disponibilidad se deriva exclusivamente con `getVariantAvailability()`: una variante agotada continúa existiendo, una combinación no declarada no produce variante, una variante eliminada deja de resolverse y la venta sin stock solo ocurre con política `continue`.

El límite efectivo de una línea conserva su motivo: inventario, máximo comercial de variante o protección técnica del carrito. `src/commerce/domain/commerce-rules.ts` contiene el umbral y la política de exposición pendientes de confirmación, además de los límites técnicos que protegen inputs y persistencia. Ningún límite técnico se presenta como stock. Con la configuración conservadora actual se muestran estados —incluido «pocas unidades»—, pero no cifras exactas de inventario.

La reconciliación vuelve a resolver cada línea desde el catálogo autoritativo. Si el stock conocido disminuye pero sigue siendo positivo, reduce la cantidad y deja un aviso no impeditivo; si llega a cero o la variante deja de estar disponible, conserva la línea con error para que la persona decida retirarla. Una variante que ya no existe se retira con aviso. Antes de checkout, el proveedor se refresca de nuevo: cualquier error de línea impide continuar, mientras que `inventoryPolicy: 'continue'` mantiene el checkout permitido.

Las imágenes viven una sola vez en `Product.images`. `primaryImageId`, `ProductVariant.imageId` y los grupos por valor de opción solo contienen referencias; los resolutores aplican fallback seguro cuando una asociación opcional no está presente. Los grids reciben `ProductSummary` y nunca el array de variantes.

### Filtros, selección y paginación de catálogo

El filtrado vive en `commerce/domain/catalog-filters.ts` y lo comparten build y navegador: la selección (`CatalogFilterSelection`), el predicado `matchesCatalogSelection` sobre el contrato mínimo `CatalogFilterable` y la serialización URL (`parse/serializeCatalogFilterParams`) para que la selección sea enlazable y sobreviva a recargas y vuelta atrás. Ni componentes ni scripts reimplementan el matching: `collection-filters.ts` construye un `CatalogFilterable` por tarjeta una sola vez al vincular el catálogo y delega el resto al dominio.

Los rangos de precio son declarativos y disjuntos (`COLLECTION_PRICE_RANGES`), con límite inferior incluido y superior excluido, y se evalúan sobre el precio de entrada (`priceRange.min`), el mismo que muestra la tarjeta. Por eso cada producto pertenece a un único rango y los contadores de las facets —calculados con ese mismo predicado— suman el total de la colección. El contador de una facet es potencial: los resultados de aplicar solo ese valor dentro de la colección, no el cruce con la selección activa.

El controlador revela la primera página (por defecto 24) con «Mostrar más» y mantiene ocultas las tarjetas fuera de la ventana para aligerar el coste de render. El grid SSR conserva todas las tarjetas para SEO y funcionamiento sin JavaScript, con `content-visibility` para colecciones grandes. Al conectar Shopify, el adaptador traducirá `CatalogFilterSelection` a sus filtros y devolverá `CollectionPage` (productos y facets) ya filtrado y paginado; los componentes y su contrato no cambian.

Los importes usan unidades mínimas y un código ISO 4217; las conversiones respetan la precisión de la moneda. El despliegue decide mediante validación qué monedas acepta (EUR en la demo), sin cerrar el contrato de dominio a esa moneda.

Dirección permitida:

```txt
presentation (pages/components/scripts) → application → domain
composition roots                       → infrastructure → application/domain
infrastructure/demo                     → demo-catalog.ts
```

Dominio y aplicación nunca importan infraestructura. Componentes y scripts nunca importan un adaptador ni el catálogo demo. `tests/architecture.test.mjs` hace ejecutables estos límites.

Al conectar Shopify:

- normaliza `Money`, producto, variante y líneas dentro del adaptador;
- conserva las credenciales privadas y tokens no públicos exclusivamente en código servidor mediante `astro:env/server`;
- no pases secretos por `PUBLIC_*`, `define:vars`, HTML, atributos `data-*`, eventos DOM ni almacenamiento del navegador;
- con `COMMERCE_SOURCE=shopify`, toda operación de carrito pasa por la frontera servidor/BFF same-origin `src/pages/api/cart.ts`; una configuración incompleta devuelve un error cerrado y nunca activa demo;
- el navegador envía únicamente identificadores públicos de variante, cantidades y comandos cerrados; nunca recibe la parte secreta del ID de carrito, tokens, credenciales, respuestas administrativas ni identidad sensible del comprador;
- el servicio servidor conserva el carrito remoto y es autoridad para precios, cantidades aceptadas, stock, identidad del comprador, checkout, errores y avisos;
- devuelve la URL de checkout junto con una lista exacta de hosts permitidos; la UI exige HTTPS, sin credenciales embebidas ni hosts por sufijo;
- considera todo precio, stock y cantidad enviados por el navegador datos no confiables y vuelve a validarlos antes de crear o actualizar el carrito remoto.
  - trata como autoridad final la respuesta actual del carrito remoto —líneas, cantidades aceptadas, errores, avisos y URL de checkout—, no el snapshot de ficha, el estado cliente ni `localStorage`.

Las fronteras por capacidad quedan así; el detalle operativo vive en `docs/SHOPIFY_READINESS.md` §17:

| Capacidad | Puerta |
| --- | --- |
| Catálogo, colecciones, producto por handle, destacados, relacionados | `CatalogProvider` (build) |
| Resolución de variantes | dentro del adaptador; mappers a `ProductVariant` |
| Crear/recuperar carrito, mutar líneas, checkout | `CartProvider` (tiempo real) |
| Cuenta de cliente futura | puerto propio en `application/`; sin implementar hasta que exista caso de uso real |

El catálogo se lee entero bajo demanda con paginación interna por cursor (productos, variantes e imágenes). En tiempo real, el navegador opera el cliente neutral de carrito, que llama a endpoints same-origin; esos endpoints delegan en un servicio servidor que consulta y muta Shopify. El adaptador remoto normaliza dentro de `infrastructure/`, valida con `assertValidCatalog()` antes de exponer y nunca deja que una respuesta parcial o una caída del catálogo genere páginas corruptas: sin catálogo previo la petición falla cerrada y con uno válido sirve el último conocido (stale-if-error).

La política de referrer se define en `BaseLayout.astro`; las cabeceras HTTP de Vercel viven en `vercel.json`: CSP, HSTS, `X-Content-Type-Options`, `Permissions-Policy` y política de framing. El build no incrusta módulos ejecutables para ser compatible con `script-src 'self'`. Cualquier servicio o CDN nuevo debe actualizar a la vez la allowlist pública, la directiva CSP mínima y las pruebas descritas en `docs/SECURITY.md`.

Los scripts interactivos dentro de `src/` deben mantenerse procesados por Astro para obtener bundling, TypeScript y deduplicación. No uses `define:vars` en un script que importe módulos: pasa únicamente identificadores públicos mediante el HTML y resuélvelos contra el proveedor.

Mantén datos editoriales en `src/content/`, configuración en `src/config/` y datos ficticios en `src/demo-catalog.ts`. Ninguno sustituye contratos de producción ni debe contener transformación propia de un adaptador.

No se crea una carpeta de autenticación hasta que exista un caso de uso real. Cuando se implemente, tendrá contratos propios en aplicación y adaptadores en infraestructura; los componentes consumirán un estado neutral, nunca SDKs del proveedor. El checkout ya tiene contrato y validación en `commerce/application/checkout.ts`, pero el adaptador demo continúa devolviendo `unavailable` y no simula pagos.

## CSS y sistema global

`src/styles/global.css` contiene:

- tokens de color, tipo, espacio, radio, sombra, z-index y motion;
- reset y estilos base;
- shells, ritmos de sección y utilidades compartidas;
- superficies, botones, formularios y patrones reutilizados.

El build conserva `build.inlineStylesheets: 'never'`. En la comparación de la auditoría de 2026-08-06, `never` y `auto` produjeron el mismo resultado (5.009.619 B de HTML + CSS únicos sobre 63 rutas), mientras que `always` elevó esa base a 13.848.512 B al repetir CSS en cada HTML. El CSS externo permite caché entre páginas, reduce el HTML y mantiene las hojas bajo la política de assets propios; se vuelve a medir si cambia materialmente la estructura de estilos.

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
- Sitemap: `@astrojs/sitemap` con filtro en `isSitemapExcluded()` (`src/config/sitemap.ts`). Excluye `/carrito` y `/cart-catalog.json`.
- `robots.txt`: endpoint en `src/pages/robots.txt.ts`; `Disallow` del snapshot de catálogo del carrito y de `/api/`.
- Documentos legales en `draft` usan `noindex,follow` y quedan fuera del sitemap hasta publicación.
- No añadas dependencias, hydration o JavaScript para resolver algo que Astro/CSS/HTML ya cubre.
- Evita trabajo duplicado en cliente y assets desproporcionados para su tamaño visible.

## Validación

Según el cambio, `bun run validate` agrupa sin duplicar:

1. `bun run check` para tipos y diagnósticos Astro.
2. `bun run test` para contratos de comercio, persistencia y límites entre capas.
3. `bun run build` para cambios estructurales, rutas, datos o integración.
4. `bun run check:links` para comprobar enlaces internos contra el `dist` generado.
5. Inspección visual de móvil y escritorio para UI.
6. Comprobación de overflow, focus, reduced motion, estados hover/active/disabled y contenido largo cuando apliquen.

No declares completada una tarea si el check relevante falla por tus cambios. Distingue claramente errores previos del proyecto.

Antes de integrar cambios, ejecuta `bun run validate` localmente con la versión de Bun fijada en `packageManager`.
