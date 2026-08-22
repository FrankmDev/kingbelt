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
  session-storage-config.ts # credenciales Upstash y política del store de sesiones
  session-driver.ts         # store de sesiones Astro: Redis/KV en Vercel, disco en local
  commerce/                 # comercio neutral y sustituible
    domain/                 # entidades y reglas puras: catálogo, variantes, stock, dinero y carrito
    application/            # puertos, casos de uso, validación y checkout
    infrastructure/
      demo/                 # adaptadores locales y persistencia de demostración
      shopify/              # gateway, importador y adaptador Storefront server-side
    commerce-source.ts      # selección explícita y tipada: demo | shopify
    commerce-navigation.ts  # /cuenta/iniciar → Customer Accounts alojadas
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
      help/       # composición del centro de ayuda
    product/      # ficha de producto: galería y compra
    collection/   # catálogo de categoría: grid, tarjetas y filtros
    cart/         # cajón (drawer) y disparador; solo presentación
    help/         # layouts y componentes del centro de ayuda
    legal/        # layouts, avisos y formulario de desistimiento (inactivo)
  config/                   # configuración global, hechos empresariales y legal readiness
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
- **Composition root:** `commerce/catalog.ts`, `commerce/cart.ts`, `commerce/cart-server.ts` y `commerce/commerce-navigation.ts` eligen adaptadores o resuelven superficies alojadas. Solo rutas y scripts de entrada consumen estas fronteras.
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
  pages   → getCatalogProvider() → CatalogProvider demo
  scripts → commerce/cart.ts    → CartProvider demo → localStorage + `/cart-catalog.json`

COMMERCE_SOURCE=shopify
  pages   → getCatalogProvider(Astro.clientAddress) → CatalogProvider Shopify
  scripts → commerce/cart.ts    → CartProvider Shopify → BFF `/api/cart` → Cart API

components → commerce/domain/* (solo contratos y reglas neutrales)
```

`COMMERCE_SOURCE` es una variable pública obligatoria de `astro:env/client`; solo admite `demo` y `shopify`. Se declara en las variables de entorno de cada deployment (local, Preview, staging o Production), no en `vercel.json`. `commerce/commerce-source.ts` es la única fuente tipada de esa decisión: el resto de la aplicación consulta `commerceSource`, `isDemoCommerce()` e `isShopifyCommerce()`. El composition root del catálogo y del carrito importa en diferido el adaptador elegido para no meter el otro en el bundle ni validar credenciales Shopify en modo demo. La presencia de credenciales valida la rama Shopify, pero nunca la selecciona. Una configuración Shopify incompleta no conecta con demo: el catálogo SSR falla cerrado y el BFF de carrito responde 503.

Catálogo y carrito tienen puertos distintos: `CatalogProvider` para lectura en servidor y `CartProvider` para estado cliente y checkout. Los componentes importan únicamente contratos o reglas de `commerce/domain`; nunca composition roots, fixtures, respuestas ni clientes externos. `demo-catalog.ts` contiene datos ficticios y solo puede importarlo `commerce/infrastructure/demo`. En modo demo, `localStorage` conserva únicamente ID de variante y cantidad bajo un esquema versionado y limitado; nunca es autoridad para precio, disponibilidad ni checkout. En modo Shopify no se usa `localStorage`: el estado persistente sigue `browser → opaque session cookie → Astro session store → Shopify cartId`. El navegador no recibe el Cart ID.

El store cliente termina su inicialización antes de ejecutar comandos, serializa mutaciones distintas, deduplica envíos equivalentes y coalesce cambios de cantidad por línea. El adaptador demo carga el snapshot `/cart-catalog.json` —servido bajo demanda desde el catálogo vigente, sin dependencia de builds— antes de restaurar líneas, relee y reconcilia la persistencia dentro de un bloqueo compartido entre pestañas cuando el navegador ofrece Web Locks; los eventos de `storage` actualizan el mismo store consumido por drawer y página. Cada reconciliación reconstruye título, imagen, precio, disponibilidad y stock desde ese catálogo. Una excepción de almacenamiento degrada el carrito a memoria con aviso, sin reemplazar el último estado válido.

Todo adaptador valida el catálogo normalizado antes de exponerlo. `assertValidCatalog()` falla con rutas y códigos concretos para identidades, relaciones, opciones, variantes, dinero, inventario, medios y colecciones; el adaptador demo y el preflight Shopify ejecutan esa frontera sobre el catálogo completo. El runtime Shopify consulta por recurso (producto, colección, resúmenes) y valida cada `ProductSummary` antes de exponerlo: un producto que Shopify devuelve y no cumple el contrato hace fallar esa operación; nunca se omite del listado. Los providers request-scoped comparten una caché breve de datos anónimos (30 s en producción); la IP del comprador no forma parte de esa caché. La caché queda acotada a 512 recursos por instancia para que handles dinámicos no provoquen crecimiento de memoria sin límite. Un fallo transitorio del proveedor (red, timeout, 5xx, 429) puede servir la última respuesta válida del mismo recurso (stale-if-error) durante un máximo de 15 minutos; un error de mapping, validación o configuración falla cerrado y no reutiliza stale. El catálogo completo y el preflight exigen el SKU comercial. La ficha runtime puede usar `shopify-variant-<id>` como identificador técnico estable si falta, sin presentarlo, incluirlo en JSON-LD ni certificarlo como SKU comercial; ese prefijo queda reservado.

`Product`, `ProductVariant`, `ProductOption`, `ProductImage`, `Collection`, `Money`, `Cart` y `CartLine` son nombres de dominio. Interfaces y tipos usan `PascalCase`; funciones, valores y archivos usan `camelCase` y `kebab-case`; una implementación externa termina en `-adapter.ts`. No se usan barrels `index.ts`: cada import declara su dependencia concreta.

`Product` es el agregado canónico y no almacena precio mínimo/máximo, disponibilidad global, colores para grid, referencias expandidas de colección ni objetos de imagen dentro de variantes. Esos datos se derivan en `ProductSummary`, carrito y ficha mediante funciones puras. La pertenencia a colecciones vive solo en `Product.collectionIds`; `Collection` no mantiene una lista inversa de productos. `Product.primaryCollectionId` es un atributo comercial explícito: en Shopify proviene de `custom.kingbelt_primary_collection`. Preflight y runtime lo exigen siempre. No hay fallback a la única colección asignada ni a `collections[0]`. El orden de las colecciones del producto no es autoridad. `Product.images` es la única autoridad de galerías: por cada valor de Color, la familia `MODELO_COLOR_01/02/03` define el orden y la primera imagen es la portada. Preflight y runtime exigen esa familia inequívoca y completa. Nunca se reparten imágenes por posición ni se consultan metaobjects de galería. `ProductVariant.image` de todas las tallas de un Color debe corresponder a esa portada; el mapper no sustituye discrepancias y un mismatch falla cerrado.

Una variante selecciona IDs de valores de opción existentes. El inventario es una unión explícita `known` | `unknown`, separada de `inventoryPolicy` (`deny` | `continue`), `salesStatus` y la regla `quantityRule` (`minimum`, `increment`, `maximum?`) declarada por el origen. La disponibilidad se deriva exclusivamente con `getVariantAvailability()`: una variante agotada continúa existiendo, una combinación no declarada no produce variante, una variante eliminada deja de resolverse y la venta sin stock solo ocurre con política `continue`.

El límite efectivo de una línea conserva su motivo: inventario, máximo comercial de variante o protección técnica del carrito. `src/commerce/domain/commerce-rules.ts` contiene el umbral y la política de exposición pendientes de confirmación, además de los límites técnicos que protegen inputs y persistencia. Ningún límite técnico se presenta como stock. Con la configuración conservadora actual se muestran estados —incluido «pocas unidades»—, pero no cifras exactas de inventario.

La reconciliación vuelve a resolver cada línea desde el catálogo autoritativo. Si el stock conocido disminuye pero sigue siendo positivo, reduce la cantidad y deja un aviso no impeditivo; si llega a cero o la variante deja de estar disponible, conserva la línea con error para que la persona decida retirarla. Una variante que ya no existe se retira con aviso. Al pulsar checkout, el proveedor remoto reconcilia el Cart autoritativo en esa misma operación: cualquier error de línea impide continuar, mientras que `inventoryPolicy: 'continue'` mantiene el checkout permitido.

Las imágenes viven una sola vez en `Product.images`. `primaryImageId`, `ProductVariant.imageId` y los grupos por valor de opción solo contienen referencias. Con Color, `ProductVariant.imageId` es la imagen real del proveedor ya validada contra la portada; sin Color, se usa `ProductVariant.image` si existe. Los grids reciben `ProductSummary` y nunca el array de variantes.

### Filtros, selección y paginación de catálogo

El filtrado vive en `commerce/domain/catalog-filters.ts` y lo comparten build y navegador: la selección (`CatalogFilterSelection`), el predicado `matchesCatalogSelection` sobre el contrato mínimo `CatalogFilterable` y la serialización URL (`parse/serializeCatalogFilterParams`) para que la selección sea enlazable y sobreviva a recargas y vuelta atrás. Ni componentes ni scripts reimplementan el matching: `collection-filters.ts` construye un `CatalogFilterable` por tarjeta una sola vez al vincular el catálogo y delega el resto al dominio.

Los rangos de precio son declarativos y disjuntos (`COLLECTION_PRICE_RANGES`), con límite inferior incluido y superior excluido, y se evalúan sobre el precio de entrada (`priceRange.min`), el mismo que muestra la tarjeta. Por eso cada producto pertenece a un único rango y los contadores de las facets —calculados con ese mismo predicado— suman el total de la colección. El contador de una facet es potencial: los resultados de aplicar solo ese valor dentro de la colección, no el cruce con la selección activa.

El controlador revela la primera página (por defecto 24) con «Mostrar más» y mantiene ocultas las tarjetas fuera de la ventana para aligerar el coste de render. El grid SSR conserva todas las tarjetas para SEO y funcionamiento sin JavaScript, con `content-visibility` para colecciones grandes. Al conectar Shopify, el adaptador traducirá `CatalogFilterSelection` a sus filtros y devolverá `CollectionPage` (productos y facets) ya filtrado y paginado; los componentes y su contrato no cambian.

Los importes usan unidades mínimas y un código ISO 4217; las conversiones respetan la precisión de la moneda. `Money` admite 0; KingBelt no admite ese 0 como precio comercial de variante. Full Product, ProductSummary y Shopify Cart fallan cerrado, y `shopify:preflight` bloquea ese catálogo. El despliegue actual valida exclusivamente `EUR`. En Shopify, país, idioma y moneda operativos (`ES` / `ES` / `EUR`) viven en `SHOPIFY_MARKET_CONTEXT`: el catálogo consulta Storefront con `@inContext` y el carrito crea con `buyerIdentity.countryCode`. No se infieren de hostname, `Accept-Language` ni geolocalización IP.

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
- el BFF lee el Cart ID completo desde la sesión server-side de Astro (`session.get("shopifyCartId")`) y es autoridad para precios, cantidades aceptadas, stock, identidad del comprador, checkout, errores y avisos;
- la persistencia de esa sesión es `browser → cookie opaca __Host-kingbelt-session → Astro Session → Unstorage Upstash → shopifyCartId`. Las credenciales `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` se resuelven en runtime desde el entrypoint `src/session-driver.ts`, no se serializan en `astro.config`. En Vercel no hay fallback a disco, memoria ni cookie; si Upstash falta o `session.get` falla, `/api/cart` responde 503. En local, sin ambas variables, el store es `.astro/session`. `bun run session:preflight` comprueba PING/SET/GET/TTL/DELETE contra una clave efímera. `bun run shopify:cart-smoke` observa la misma persistencia desde HTTP contra un deployment real y no lee Redis. Ninguno forma parte de `validate` ni del CI de PRs;
- la identidad anónima del comprador Shopify es solo `buyerIdentity.countryCode` del contexto de mercado servidor (`ES`); el navegador no puede enviarla ni arbitrarla;
- devuelve la URL de checkout junto con una lista exacta de hosts permitidos; la UI exige HTTPS, sin credenciales embebidas ni hosts por sufijo;
- considera todo precio, stock y cantidad enviados por el navegador datos no confiables y vuelve a validarlos antes de crear o actualizar el carrito remoto.
  - trata como autoridad final la respuesta actual del carrito remoto —líneas, cantidades aceptadas, errores, avisos y URL de checkout—, no el snapshot de ficha, el estado cliente ni `localStorage`.

Las fronteras por capacidad quedan así; el detalle de integración vive en `docs/SHOPIFY_READINESS.md` §17 y el checklist Admin de lanzamiento en `docs/SHOPIFY_LAUNCH_OPERATIONS.md`:

| Capacidad | Puerta |
| --- | --- |
| Catálogo, colecciones, producto por handle, destacados, relacionados | `CatalogProvider` (build) |
| Resolución de variantes | dentro del adaptador; mappers a `ProductVariant` |
| Crear/recuperar carrito, mutar líneas, checkout | `CartProvider` (tiempo real) |
| Acceso a cuenta (alojado) | `commerce-navigation` + `/cuenta/iniciar` → `SHOPIFY_CUSTOMER_ACCOUNT_URL` |
| Cuenta de cliente (API, perfil, pedidos) | puerto futuro; no implementado |

El runtime consulta Storefront por recurso —producto, colección o resúmenes— con paginación interna por cursor. La descarga completa del catálogo queda reservada a `shopify:preflight`. En tiempo real, el navegador opera el cliente neutral de carrito, que llama a endpoints same-origin; esos endpoints delegan en un servicio servidor que consulta y muta Shopify. El adaptador remoto normaliza dentro de `infrastructure/`, valida la proyección de dominio antes de exponer y nunca deja que una respuesta parcial o una caída del catálogo genere páginas corruptas: un producto inválido no desaparece del listado, un error de configuración Shopify (`SHOPIFY_STORE_DOMAIN` ausente o inválido, token ausente) falla cerrado, registra un diagnóstico sin secretos y no sirve un catálogo vacío. Mapping, validación y configuración no usan stale; un fallo transitorio del proveedor sin respuesta válida previa del mismo recurso sigue fallando cerrado, y con una válida sirve la última conocida (stale-if-error).

La política de referrer se define en `BaseLayout.astro`; las cabeceras HTTP de Vercel viven en `vercel.json`: CSP, HSTS, `X-Content-Type-Options`, `Permissions-Policy` y política de framing. El build no incrusta módulos ejecutables para ser compatible con `script-src 'self'`. Cualquier servicio o CDN nuevo debe actualizar a la vez la allowlist pública, la directiva CSP mínima y las pruebas descritas en `docs/SECURITY.md`.

Los scripts interactivos dentro de `src/` deben mantenerse procesados por Astro para obtener bundling, TypeScript y deduplicación. No uses `define:vars` en un script que importe módulos: pasa únicamente identificadores públicos mediante el HTML y resuélvelos contra el proveedor.

Mantén datos editoriales en `src/content/`, configuración en `src/config/` y datos ficticios en `src/demo-catalog.ts`. Ninguno sustituye contratos de producción ni debe contener transformación propia de un adaptador.

No se crea una carpeta de autenticación hasta que exista un caso de uso real. Cuando se implemente, tendrá contratos propios en aplicación y adaptadores en infraestructura; los componentes consumirán un estado neutral, nunca SDKs del proveedor. El checkout ya tiene contrato y validación en `commerce/application/checkout.ts`, pero el adaptador demo continúa devolviendo `unavailable` y no simula pagos. KingBelt inicia Shopify Checkout con `Cart.checkoutUrl`. Una compra real se confirma únicamente en Shopify Thank You y posteriormente en Shopify Order Status. Astro no renderiza una confirmación post-pago. El gate Admin es `docs/SHOPIFY_LAUNCH_OPERATIONS.md`.

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
- Sitemap: `@astrojs/sitemap` con filtro en `isSitemapExcluded()` (`src/config/sitemap.ts`). Excluye `/carrito`, `/cart-catalog.json` y `/cuenta/iniciar`.
- `robots.txt`: endpoint en `src/pages/robots.txt.ts`; `Disallow` del snapshot de catálogo del carrito y de `/api/`.
- Documentos legales en `draft` o `inactive` usan `noindex` y quedan fuera del sitemap y del footer hasta `published`.
- `bun run legal:preflight` es el gate fail-closed de hechos y documentos legales. No forma parte de `bun run validate`; `validate` sí ejecuta los tests del gate.
- No añadas dependencias, hydration o JavaScript para resolver algo que Astro/CSS/HTML ya cubre.
- Evita trabajo duplicado en cliente y assets desproporcionados para su tamaño visible.

## Validación

Según el cambio, `bun run validate` agrupa sin duplicar:

1. `bun run check` para tipos y diagnósticos Astro.
2. `bun run test` para contratos de comercio, persistencia y límites entre capas.
3. `bun run build` para cambios estructurales, rutas, datos o integración. El build valida compilación y no llama a Shopify.
4. `bun run check:links` para comprobar enlaces internos contra el `dist` generado.
5. Inspección visual de móvil y escritorio para UI.
6. Comprobación de overflow, focus, reduced motion, estados hover/active/disabled y contenido largo cuando apliquen.

Un catálogo Shopify inválido no hace fallar `bun run build`. La barrera autenticada contra Storefront es `bun run shopify:preflight`, exclusiva de entornos confiables con `COMMERCE_SOURCE=shopify`. El preflight mapea todos los productos y agrupa hasta diez diagnósticos antes de fallar, de modo que una ejecución permita corregir varios registros; después mantiene la validación global para detectar colisiones entre productos. No forma parte del job `quality` de Pull Requests. El smoke autenticado de carrito es `bun run shopify:cart-smoke`: llama al BFF `/api/cart` de un deployment real hasta `checkoutUrl` y tampoco forma parte de `validate`. El orquestador pre-pagos es `bun run shopify:release-gate`: reutiliza `validate` (en demo), `legal:preflight`, `session:preflight`, `shopify:preflight` y `shopify:cart-smoke`, y añade comprobaciones HTTP del deployment. No promueve, no paga y no crea un Order. `legal:preflight` FAIL por datos pendientes es un blocker real: no se desactiva el gate.

No declares completada una tarea si el check relevante falla por tus cambios. Distingue claramente errores previos del proyecto.

Antes de integrar cambios, ejecuta `bun run validate` con `COMMERCE_SOURCE=demo` y la versión de Bun fijada en `packageManager`. Es la misma suite que el job `quality` de GitHub Actions en Pull Requests. Un despliegue Shopify de staging o Production añade, con credenciales de ese entorno:

```sh
COMMERCE_SOURCE=shopify bun run shopify:preflight
bun run build
```

Tras desplegar el candidato, el cart smoke usa una base URL HTTPS explícita. El gate pre-pagos reutiliza la misma URL:

```sh
COMMERCE_SOURCE=shopify \
SHOPIFY_SMOKE_BASE_URL=https://your-deployment.example \
SHOPIFY_SMOKE_PRODUCT_HANDLE=your-pilot-handle \
bun run shopify:release-gate
```
