# Preparación de KingBelt para Shopify

## 1. Estado actual

La web sigue siendo estática y funciona sin variables de entorno. El catálogo, las variantes y el carrito de demostración se resuelven con proveedores locales; no existe cliente HTTP, GraphQL, tienda configurada ni dependencia de Shopify.

`src/demo-catalog.ts` no es una plantilla de importación ni una definición del catálogo definitivo. Sus productos, nombres, precios, inventario, colecciones e imágenes son fixtures para probar contratos, rutas y estados. El catálogo sintético de tests verifica la escala prevista sin anticipar datos comerciales reales.

El adaptador demo pasa por `assertValidCatalog()` antes de exponer datos. El futuro adaptador deberá aplicar esa misma validación después de normalizar la respuesta externa y antes de que páginas o carrito la consuman; los fixtures solo prueban esa frontera.

## 2. Arquitectura objetivo

```txt
páginas            → CatalogProvider → adaptador demo ahora / Shopify después
scripts de carrito → CartProvider    → adaptador demo ahora / Shopify después
                                  ↘ dominio neutral compartido
```

Las respuestas GraphQL se transformarán al dominio neutral dentro del futuro adaptador. No llegarán a páginas ni componentes.

## 3. Proveedor de catálogo

Es responsable de colecciones, resúmenes para grids, fichas completas, handles, destacados y relacionados. Los resúmenes excluyen variantes para que una colección no serialice el catálogo completo.

## 4. Proveedor de carrito

Es responsable de inicializar, añadir una variante, modificar cantidades, eliminar líneas y obtener checkout. La identidad autoritativa es `variantId`; título, precio, imagen, opciones y stock se vuelven a resolver en el proveedor.

## 5. Producto y variante

`Product` diferencia ID interno, handle y referencia comercial. Cada `ProductVariant` tiene ID y SKU propios y selecciona IDs de valores de opción del producto. El precio pertenece a la variante. El stock se normaliza como conocido o desconocido, con política separada para denegar o continuar la venta sin existencias; la disponibilidad se deriva y no se almacena como otro dato contradictorio. Solo existen combinaciones declaradas como variantes; no se calcula el producto cartesiano de opciones.

`ProductSummary` es una proyección de lectura para grids. Deriva imagen, rango de precio, colores y disponibilidad, y nunca contiene variantes ni SKU. `Product` tampoco conserva esa proyección como una segunda fuente editable. La ficha serializa una proyección pública de variante (`toPublicBuyBoxVariant`) con disponibilidad derivada; con `exposeExactInventory: false` no incluye cantidades exactas de inventario ni un `maxQuantity` igual al stock (el tope visible usa límite comercial o técnico; el carrito sigue siendo autoridad).

## 6. Generación estática

`getStaticPaths()` solicita únicamente handles. Cada ruta obtiene después su producto o colección por handle durante el build. El sitio continúa sin adapter y sin SSR.

## 7. Actualización futura

Los datos se obtendrán durante el build. Cuando cambie el catálogo se reconstruirá el despliegue de Vercel. Más adelante podrá conectarse un webhook de Shopify a un deploy hook de Vercel; esa automatización no está implementada.

## 8. Mapeo previsto

| Origen | Dominio / Shopify |
| --- | --- |
| Código de modelo | `Product.reference` |
| Handle | handle de Shopify |
| Color | opción `Color` |
| Talla | opción `Talla` |
| SKU | SKU de variante |
| Precio | precio de variante, convertido a unidades mínimas |
| Coste | dato administrativo; nunca público |
| Stock | `ProductVariant.inventory` (`known` o `unknown`) |
| Continuar vendiendo sin stock | `ProductVariant.inventoryPolicy` |
| Máximo de compra por variante | `ProductVariant.purchaseLimit` cuando el origen lo declare |
| Categoría interna | colección |
| Product category | categoría oficial de Shopify |
| Material | especificación y futuro metafield |
| Ancho | especificación y futuro metafield |
| Hebilla | especificación y futuro metafield |
| Tres imágenes | media de producto y, cuando proceda, imagen principal de variante/color |

## 9. Decisiones empresariales pendientes

Faltan confirmar catálogo definitivo, precios, moneda/mercados, reglas de stock, taxonomía de colecciones, categoría oficial, materiales, anchos, hebillas, textos SEO, política de imágenes, checkout y credenciales autorizadas. El coste nunca formará parte del dominio público.

En particular, siguen pendientes el umbral de «pocas unidades» y si se expondrán cifras exactas de inventario. Sus defaults de demo están aislados en `src/commerce/domain/commerce-rules.ts`; no se convertirán en configuración de Shopify ni en copy público definitivo sin confirmación.

## 9.1. Autoridad de disponibilidad al conectar Shopify

La autoridad depende del momento del flujo:

- En ficha y selección de variante, el adaptador normalizará la variante publicada para el canal a partir de `availableForSale`, `currentlyNotInStock`, `quantityAvailable` cuando esté accesible y `quantityRule.maximum`. `quantityAvailable: null`, no solicitado o no autorizado se normaliza como inventario `unknown`; nunca como una cifra ficticia. `currentlyNotInStock` permite representar una variante comprable sin stock. Consulta el contrato vigente de [`ProductVariant`](https://shopify.dev/docs/api/storefront/latest/objects/productvariant) y [`QuantityRule`](https://shopify.dev/docs/api/storefront/latest/objects/quantityrule) de la versión fijada al implementar.
- Después de cualquier alta o cambio de cantidad, son autoritativos el `Cart` devuelto por Shopify, sus líneas y cantidades, junto con `userErrors` y `warnings` de la mutación. El adaptador reconstruirá el carrito local desde esa respuesta; no asumirá que Shopify aceptó la cantidad solicitada. Las mutaciones de líneas documentan esa respuesta en [`cartLinesAdd`](https://shopify.dev/docs/api/storefront/latest/mutations/cartLinesAdd).
- Inmediatamente antes de checkout, el adaptador consultará o mutará de nuevo el carrito remoto. Solo una respuesta sin errores impeditivos y con líneas válidas habilita la redirección; la URL autoritativa será `Cart.checkoutUrl`, validada además por host y HTTPS. Consulta el contrato de [`Cart`](https://shopify.dev/docs/api/storefront/latest/objects/cart).
- `localStorage` continuará guardando solo IDs y cantidades solicitadas. El DOM, el snapshot generado durante build y cualquier cantidad enviada por el navegador son datos no confiables.

Una variante «eliminada» significa que el origen autoritativo ya no puede resolver su identidad y Shopify no devuelve una línea válida para ella; se retira del carrito con aviso. Una variante que todavía se resuelve pero no puede venderse se conserva como no disponible y bloquea checkout. Si la Storefront API elegida no permite distinguir ambos casos para una variante no publicada, el adaptador no inventará la causa: usará el estado seguro no comprable y la respuesta del carrito remoto como decisión final.

## 10. Categorías y colecciones

Las categorías públicas se modelan como colecciones. Una colección destacada ordena la portada, pero el layout acepta entre tres y seis sin asumir dos secundarias exactas. Debe decidirse qué colecciones son manuales o automáticas antes de importar.

## 11. Imágenes

El dominio guarda cada imagen una sola vez en `Product.images`. La imagen principal, la de variante y los grupos por valor de opción referencian IDs de ese registro canónico; así puede mantener las tres imágenes habituales por producto/color sin copiar objetos dentro de cada talla. Tres imágenes es el caso habitual probado, no una cardinalidad obligatoria. Una imagen específica de variante puede ser independiente del grupo de color. Si falta una asociación opcional, los resolutores usan la imagen principal o la galería general. Cuando se conozca el CDN definitivo habrá que autorizarlo con `image.domains` o `image.remotePatterns` de Astro si se usa optimización remota. No se configuran aún metaobjects ni metafields.

## 12. Filtros

La selección, el predicado y la serialización URL viven en `commerce/domain/catalog-filters.ts` y los comparten build, navegador y futuro adaptador. La selección (`CatalogFilterSelection`) usa tipo, colores normalizados, un rango de precio declarativo y disjunto sobre el precio de entrada, y disponibilidad. La URL transporta esa selección (`tipo`, `color`, `precio`, `disponible`) para enlazar estados y conservarlos al volver atrás o recargar.

El controlador cliente aplica el mismo predicado del dominio y revela la colección por páginas con «Mostrar más». Cuando exista Shopify, el adaptador traducirá `CatalogFilterSelection` a sus filtros disponibles y devolverá `CollectionPage` (productos y facets) ya filtrado y paginado; los componentes no cambian. No se ha configurado Search & Discovery ni consultas remotas.

## 13. SEO

El SEO consume el dominio neutral. La ficha genera `Product`, marca, imágenes, referencia comercial como `mpn`, canonical, disponibilidad derivada y una sola oferta o `AggregateOffer`; no confunde la referencia de producto con un SKU de variante ni genera un `Offer` por variante.

## 14. Pasos exactos para activar Shopify

1. Confirmar campos pendientes, colecciones, mercados, inventario y política de imágenes.
2. Crear y validar la tienda y el catálogo fuera de este repositorio.
3. Elegir el flujo de carrito: cliente con token público o frontera servidor para credenciales privadas.
4. Fijar `SHOPIFY_API_VERSION` y configurar dominio y token apropiado en el entorno de despliegue.
5. Implementar el cliente Storefront mínimo en la frontera elegida.
6. Implementar adaptadores separados para `CatalogProvider` y `CartProvider` dentro de `commerce/infrastructure/shopify/`.
7. Mapear respuestas GraphQL al dominio neutral y ejecutar el validador antes de renderizar.
8. Autorizar el dominio CDN de imágenes solo cuando sea conocido.
9. Ejecutar pruebas de catálogo, variantes, carrito, rutas, SEO y validación visual.
10. Cambiar los composition roots `commerce/catalog.ts` y `commerce/cart.ts` a los adaptadores Shopify.
11. Configurar reconstrucciones de Vercel; valorar después webhook/deploy hook.
12. Verificar checkout, secretos, CSP/cabeceras y vuelta al adaptador demo antes de publicar.

Un token público de Storefront puede exponerse al cliente; un token privado es exclusivamente de servidor. La decisión final del cliente de carrito se tomará al conectar la tienda. La versión API debe fijarse explícitamente y nunca ser `latest`.

## 15. Vuelta temporal al adaptador demo

Mantener `src/demo-catalog.ts` y `commerce/infrastructure/demo/` mientras dure la transición. Ante una incidencia, hacer que `commerce/catalog.ts` y `commerce/cart.ts` vuelvan a esos adaptadores, reconstruir el sitio y comprobar catálogo/carrito. La reversión no exige cambiar páginas ni componentes porque ambos proveedores comparten el dominio neutral.

## 16. Cuentas de cliente

La arquitectura aprobada para login, registro y cuenta utiliza Customer accounts y Customer Account API con autenticación alojada por Shopify. Los contratos, límites de sesión, privacidad, carrito y activación están definidos en [`plans/2026-08-06-shopify-customer-accounts-design.md`](plans/2026-08-06-shopify-customer-accounts-design.md). Esta referencia no activa la funcionalidad: sigue bloqueada hasta configurar tienda, cliente confidencial, permisos, runtime SSR y almacenamiento servidor.

## 17. Decisiones de arquitectura de la integración

Este apartado fija las decisiones que se ejecutarán al activar la tienda. Las secciones 1–16 definen contexto, mapeo y pasos; aquí se decide la frontera de datos y los comportamientos de fallo. Nada de este apartado exige llamadas reales ni credenciales hoy, y ninguna decisión sustituye el paso §14 de implementar, validar y cablear los adaptadores antes de activarlos.

### 17.1 Fronteras por capacidad

| Capacidad | Puerto / contrato | Implementación prevista |
| --- | --- | --- |
| Lectura de catálogo | `CatalogProvider` (§3) | `infrastructure/shopify/catalog-adapter.ts` (aún no creado) |
| Lectura de colecciones | `CatalogProvider.getCollections` / `getCollectionByHandle` | idem |
| Producto por handle | `CatalogProvider.getProductByHandle` / `getProductHandles` | idem |
| Destacados | `CatalogProvider.getFeaturedProducts` | idem |
| Relacionados | `CatalogProvider.getRelatedProducts` | idem, derivado desde el dominio |
| Resolución de variantes | dentro del adaptador (identidad `gid` de variante) y mappers a `ProductVariant` | `mappers.ts` (aún no creado) |
| Crear/recuperar carrito | `CartProvider.initialize` / `refresh` | `infrastructure/shopify/cart-adapter.ts` (aún no creado) |
| Modificar líneas | `CartProvider.addItem` / `updateItem` / `removeItem` | idem |
| Checkout | `CartProvider.checkout` + `CheckoutResult` / `getSafeCheckoutUrl` | idem, con `checkout-redirect` |
| Cuenta de cliente futura | puerto `CustomerAccountProvider` nuevo en `application/` | §16 y plan en `plans/` |

Regla general: las respuestas GraphQL y los tipos de Shopify vivirán exclusivamente en `infrastructure/shopify/` cuando se implemente. Hoy esa carpeta no existe: no hay adaptadores incompletos en el repositorio. Páginas, componentes y scripts consumen solo los composition roots `@commerce/catalog` y `@commerce/cart` o contratos de `application`/`domain`. `tests/architecture.test.mjs` ejecuta esta frontera (rutas por composition root y solo los roots eligen infraestructura).

### 17.2 Datos de build y datos en tiempo real

Durante el build se obtiene todo el catálogo: colecciones, productos completos (opciones, variantes, imágenes, grupos de medios, especificaciones, SEO y pertenencia a colecciones) y las proyecciones de grid `ProductSummary`. Destacados y relacionados se derivan desde el dominio durante el build; el sitio no consulta el catálogo en el navegador.

En tiempo real (navegador) se consulta únicamente el carrito y su checkout: crear o recuperar el carrito, mutar líneas y obtener la URL de checkout. Después de cada operación el carrito se reconstruye desde la respuesta remota (§9.1); nunca desde `localStorage` ni desde el snapshot de ficha. La tienda no muta el catálogo desde el cliente.

### 17.3 Paginación de productos, variantes e imágenes

La paginación es una preocupación interna del adaptador de importación, no del contrato público: `CatalogProvider` devuelve conjuntos completos y las páginas no pagan.

- Productos y colecciones: connections con `first: 250` y cursor (`pageInfo.hasNextPage` / `endCursor`) en bucle hasta agotar; el Storefront API no admite más de 250 por página.
- Pertenencia producto → colección: `Product.collections(first: 250)` por producto, paginado si excede; rellena `Product.collectionIds`.
- Variantes e imágenes de cada producto: `Product.variants(first: 250)` y `Product.images(first: 250)` con su propio cursor si el producto los supera.
- El recorrido guarda cada producto por handle/id una sola vez; no se reconsulta un nodo ya leído. Si el coste de query del store exigiera bajar `first`, se ajusta en la constante del adaptador, no con un valor distinto por request.

### 17.4 Transformación al dominio interno

La normalización vive en `mappers.ts` y no conoce página ni componente:

- `MoneyV2 { amount, currencyCode }` → `moneyFromDecimal(amount, currencyCode)`; nunca aritmética de coma flotante.
- IDs opacos `gid://shopify/...` → `productId()` / `variantId()` tal cual.
- `options` → `ProductOption`; `purpose` solo cuando el nombre coincide con los conocidos (Color→color, Talla/Tamaño→size). `swatch` solo si el origen lo expone.
- `selectedOptions` de variante → `OptionSelection[]` contra valores existentes; las combinaciones no declaradas no producen variante (§5).
- Inventario y política según §9.1: `availableForSale`, `currentlyNotInStock`, `quantityAvailable` (cuando el scope `unauthenticated_read_product_inventory` lo permita) y `quantityRule.maximum` → `purchaseLimit`.
- Imágenes: una sola vez en `Product.images`; `featuredImage` → `primaryImageId`; imagen de variante y `mediaGroups` por valor de opción se agrupan desde `variant.image` (§11). Para activar el srcset y el recorte 4:5 ya preparados, autorizar el host exacto del CDN de Shopify (p. ej. `cdn.shopify.com`) en `imagePolicy.transformableHosts` (`src/config/images.ts`) y, a la vez, en `publicSecurityConfig.remoteImageHosts` (`src/config/security.ts`); sin eso, las URLs se sirven tal cual llegan. El render ya aplica `width`/`height`, `sizes` y `loading`/`fetchpriority` sin JavaScript de cliente.
- `descriptionHtml` se sanea a texto plano antes de usarse en ficha y meta.

### 17.5 Validación antes del uso

Tras normalizar el catálogo completo, el adaptador ejecuta `assertValidCatalog()` con las monedas soportadas por el despliegue: la misma frontera que ya ejecuta la demo. Un `CatalogValidationError` falla el build con rutas y códigos concretos; ninguna página se renderiza con un catálogo inválido. En carrito, `userErrors` y `warnings` de cada mutación se mapean a `CartOperationErrorCode` antes de exponerlos (§9.1).

### 17.6 Respuestas parciales

- Import: una respuesta incompleta (nodos ausentes, campos nulos) se normaliza y después se valida. Si un dato obligatorio no puede resolverse, el build falla en vez de adivinar; un catálogo parcial nunca se publica.
- Carrito: las mutaciones devuelven el carrito completo; errores y avisos por línea se traducen a `CartOperationResult`. El store cliente conserva el último estado válido y muestra mensajes; no reemplaza el carrito por uno vacío ante una respuesta parcial.

### 17.7 Límites, errores y reintentos

- Límites: `first ≤ 250` (§17.3); `MAX_CART_LINES` y `MAX_CART_QUANTITY` del dominio siguen aplicándose a lo que envía el navegador; el carrito remoto es autoridad de cantidades (§9.1).
- Throttling: Storefront aplica coste de query. El gateway respeta `429`/límite esperando `Retry-After`, con backoff exponencial y jitter, máximo 3 reintentos y un timeout por request (~15 s). Agotados los reintentos, el import falla con error claro; no se publica catálogo parcial.
- Mutaciones de carrito: no se reintentan sin confirmación (evita duplicar líneas); solo se reintentan lecturas idempotentes. Los fallos de red se traducen a `provider_error`.
- Errores de negocio (stock, límites) no se reintentan: se devuelven como `CartOperationResult`.

### 17.8 Versión de la API

La versión Storefront se fija explícitamente —como constante de módulo en el gateway o como variable de entorno consumida por él— y nunca como `latest`; es una decisión deliberada que implica revisión y reconstrucción. No se añade ninguna variable de entorno mientras no exista un consumidor real que la lea (§14).

### 17.9 Actualización del sitio al cambiar el catálogo

El catálogo se lee en cada build (§7). Un cambio en la tienda provoca reconstrucción del despliegue: primero rebuild manual o deploy; después, si se desea automatizar, un webhook de Shopify a un deploy hook de Vercel (no implementado). El contenido editorial no participa.

### 17.10 Vuelta temporal al proveedor local

Se conservan `src/demo-catalog.ts` y `commerce/infrastructure/demo/`. La reversión es cambiar `commerce/catalog.ts` y `commerce/cart.ts` a los adaptadores demo y reconstruir (§15). Páginas y componentes no cambian porque ambos proveedores comparten el dominio neutral.

### 17.11 Evitar páginas corruptas por caída del catálogo

- Fail-closed: si la obtención o la validación del catálogo falla, el build lanza y no se emite la ruta; el despliegue anterior de Vercel sigue sirviendo el último build válido.
- El adaptador no degrada a un «catálogo vacío» silencioso: un resultado vacío o parcial se trata como anomalía del import y se resuelve antes de publicar.
- En el navegador, un fallo del carrito degrada el estado (error o último estado válido), nunca la página.
- El rollback al adaptador demo (§17.10) es la vía operativa rápida y no exige cambios de UI.

### 17.12 Cliente GraphQL ligero (sin SDK)

No se usará `@shopify/hydrogen-react` ni otro SDK: un gateway propio en `infrastructure/shopify/` con `fetch`, la versión fijada (§17.8), el token y una función `graphql()` tipada con queries/fragments escritos a mano cubre las tres fronteras —catálogo, carrito y cuenta futura— sin dependencia nueva. La carpeta `infrastructure/shopify/` se crea al implementar; no se conserva ningún adaptador incompleto en el repositorio. Los roots siguen usando los adaptadores demo hasta que los Shopify implementen sus puertos por completo, pasen validación y se prueben (§14).
