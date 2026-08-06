# Preparación de KingBelt para Shopify

## 1. Estado actual

La web sigue siendo estática y funciona sin variables de entorno. El catálogo, las variantes y el carrito de demostración se resuelven con proveedores locales; no existe cliente HTTP, GraphQL, tienda configurada ni dependencia de Shopify.

`src/demo-catalog.ts` no es una plantilla de importación ni una definición del catálogo definitivo. Sus productos, nombres, precios, inventario, colecciones e imágenes son fixtures para probar contratos, rutas y estados. El catálogo sintético de tests verifica la escala prevista sin anticipar datos comerciales reales.

El adaptador demo pasa por `assertValidCatalog()` antes de exponer datos. El futuro adaptador deberá aplicar esa misma validación después de normalizar la respuesta externa y antes de que páginas o carrito la consuman; los fixtures solo prueban esa frontera.

## 2. Arquitectura objetivo

```txt
páginas → CatalogProvider → demo ahora / importador Shopify durante build después

navegador → cliente neutral de carrito → endpoints same-origin → servicio servidor → Storefront Cart API
                                      ↘ contratos de aplicación y dominio neutrales
```

Las respuestas GraphQL se transformarán al dominio neutral dentro de la futura infraestructura. No llegarán a páginas ni componentes. Los endpoints, el servicio servidor y el adapter de despliegue no se crean hasta activar la integración; hoy el sitio continúa completamente estático.

## 3. Proveedor de catálogo

Es responsable de colecciones, resúmenes para grids, fichas completas, handles, destacados y relacionados. Los resúmenes excluyen variantes para que una colección no serialice el catálogo completo.

## 4. Proveedor de carrito

El contrato neutral es responsable de inicializar, añadir una variante, modificar cantidades, eliminar líneas y obtener checkout. La identidad pública de entrada es `variantId`; título, precio, imagen, opciones, stock y cantidad aceptada se vuelven a resolver en el servidor. En la integración futura su implementación cliente solo hablará con endpoints same-origin, nunca con Shopify.

## 5. Producto y variante

`Product` diferencia ID interno, handle y referencia comercial. Cada `ProductVariant` tiene ID y SKU propios y selecciona IDs de valores de opción del producto. El precio pertenece a la variante. El stock se normaliza como conocido o desconocido, con política separada para denegar o continuar la venta sin existencias; la disponibilidad se deriva y no se almacena como otro dato contradictorio. Cada producto admite como máximo tres opciones y 2.048 variantes. Solo existen combinaciones declaradas como variantes; no se calcula el producto cartesiano de opciones.

`ProductSummary` es una proyección de lectura para grids. Deriva imagen, rango de precio, colores y disponibilidad, y nunca contiene variantes ni SKU. `Product` tampoco conserva esa proyección como una segunda fuente editable. La ficha serializa `toCompactPublicBuyBoxPayload()`: IDs públicos, selecciones ordenadas, importes, imagen, estado y regla de cantidad. No incluye SKU, inventario exacto, nombres repetidos, coste, vendor ni objetos completos.

Cada variante declara `quantityRule.minimum`, `increment` y `maximum?`. La política inicial de KingBelt acepta expresamente mínimo 1 e incremento 1; una regla distinta hace fallar el catálogo. El máximo opcional se respeta en selector, carrito, persistencia, reconciliación y futuro servicio servidor. Los límites técnicos de protección siguen separados de este máximo comercial y nunca se presentan como stock.

## 6. Generación estática

`getStaticPaths()` solicita únicamente handles. Cada ruta obtiene después su producto o colección por handle durante el build. El sitio continúa sin adapter y sin SSR.

## 7. Actualización futura

Los datos se obtendrán durante el build. Cuando cambie el catálogo se reconstruirá el despliegue de Vercel. Más adelante podrá conectarse un webhook de Shopify a un deploy hook de Vercel; esa automatización no está implementada.

## 8. Contrato definitivo de producto

| Dato de Shopify | Cardinalidad / regla | Destino interno |
| --- | --- | --- |
| `Product.id` | 1, obligatorio | `Product.id` |
| `Product.handle` | 1, obligatorio, único y publicable como ruta | `Product.handle` |
| `Product.vendor` | 1, obligatorio | `Product.vendor` |
| `Product.productType` | 1, obligatorio | `Product.productType` |
| categoría oficial | 1, obligatoria, ID y nombre | `Product.category` |
| colecciones publicadas | 1..n, IDs existentes; una primaria decidida por la importación | `collectionIds` y `primaryCollectionId` |
| estado de publicación del canal | 1, obligatorio | `publicationStatus`; lo no publicado falla el catálogo público |
| opción `Color` | 1 cuando el producto varía por color; valores únicos | `ProductOption` con `purpose: color` |
| opción `Talla` | 1 cuando el producto varía por talla; valores únicos | `ProductOption` con `purpose: size` |
| opciones restantes | hasta completar tres en total | `ProductOption`; más de tres falla |
| `ProductVariant.id` | 1 por variante, único | `ProductVariant.id` |
| `ProductVariant.sku` | 1, obligatorio y único en todo el catálogo | `ProductVariant.sku`; nunca se serializa al navegador |
| opciones seleccionadas | exactamente una por opción y con valor existente | `optionValues`; no se generan combinaciones ausentes |
| `price` / `compareAtPrice` | precio obligatorio y comparado opcional, misma moneda | `price` / `compareAtPrice` en unidades mínimas |
| `quantityAvailable` | 0..1 según permisos; `null` significa desconocido | `inventory: known | unknown`; nunca público como cifra |
| `inventoryPolicy` y estados de venta | 1, obligatorios | `inventoryPolicy`, `salesStatus` y disponibilidad derivada |
| `quantityRule` | mínimo e incremento obligatorios; máximo opcional | `quantityRule`; inicialmente solo 1/1 es compatible |
| título y cuerpo | título y descripción obligatorios, texto saneado | `title` y `description` |
| SEO nativo | título/description opcionales | `seo`; fallback determinista a título y resumen, sin inventar copy |
| media de producto | tres imágenes válidas por valor de `Color` | `images`, `primaryImageId`, `mediaGroups` e `imageId` de variante |

`reference`, `summary`, `badge`, material, ancho y hebilla/acabado se resuelven mediante el contrato de metafields siguiente. No se importa coste, margen, tags administrativos ni HTML sin sanear.

### 8.1 Metafields y metaobject de galería

| Propietario | Namespace / key | Tipo Shopify | Cardinalidad | Obligatorio | Fallback | Destino interno |
| --- | --- | --- | --- | --- | --- | --- |
| Product | `kingbelt.model_reference` | `single_line_text_field` | exactamente 1 | sí | ninguno; falla import | `Product.reference` |
| Product | `kingbelt.summary` | `multi_line_text_field` | exactamente 1 | sí | ninguno; falla import | `Product.summary` |
| Product | `kingbelt.material` | `single_line_text_field` | exactamente 1 | sí | ninguno; falla import | `specifications[Material]` |
| Product | `kingbelt.width_mm` | `number_integer` | exactamente 1, positivo | sí | ninguno; falla import | `specifications[Ancho]` |
| Product | `kingbelt.buckle_finish` | `single_line_text_field` | exactamente 1 | sí | ninguno; falla import | `specifications[Hebilla/acabado]` |
| Product | `kingbelt.badge` | `single_line_text_field` | 0..1 | no | se omite | `Product.badge` |
| Product | `kingbelt.color_galleries` | `list.metaobject_reference<kingbelt.color_gallery>` | exactamente una referencia por valor de Color | sí si existe Color | ninguno; falla import | `Product.mediaGroups` |
| Metaobject `kingbelt.color_gallery` | `color_value` | `single_line_text_field` | exactamente 1 | sí | ninguno; falla import | relación con `optionValueId` de Color |
| Metaobject `kingbelt.color_gallery` | `images` | `list.file_reference` | exactamente 3, ordenadas | sí | ninguno; falla import | IDs de `Product.images` del grupo |

Todos los metafields obligatorios se consultan juntos. Un nodo, campo o relación ausente convierte la respuesta en parcial y detiene el build. No se usan valores ficticios ni se reinterpreta un metafield desconocido.

## 9. Decisiones empresariales pendientes

Faltan confirmar catálogo definitivo, precios, moneda/mercados, reglas de stock, taxonomía de colecciones, categoría oficial, materiales, anchos, hebillas, textos SEO, política de imágenes, checkout y credenciales autorizadas. El coste nunca formará parte del dominio público.

En particular, siguen pendientes el umbral de «pocas unidades» y si se expondrán cifras exactas de inventario. Sus defaults de demo están aislados en `src/commerce/domain/commerce-rules.ts`; no se convertirán en configuración de Shopify ni en copy público definitivo sin confirmación.

## 9.1. Autoridad de disponibilidad al conectar Shopify

La autoridad depende del momento del flujo:

- En ficha y selección de variante, el adaptador normalizará la variante publicada para el canal a partir de `availableForSale`, `currentlyNotInStock`, `quantityAvailable` cuando esté accesible y `quantityRule { minimum, increment, maximum }`. `quantityAvailable: null`, no solicitado o no autorizado se normaliza como inventario `unknown`; nunca como una cifra ficticia. `currentlyNotInStock` permite representar una variante comprable sin stock. Consulta el contrato vigente de [`ProductVariant`](https://shopify.dev/docs/api/storefront/latest/objects/productvariant) y [`QuantityRule`](https://shopify.dev/docs/api/storefront/latest/objects/quantityrule) de la versión fijada al implementar.
- Después de cualquier alta o cambio de cantidad, son autoritativos el `Cart` devuelto por Shopify, sus líneas y cantidades, junto con `userErrors` y `warnings` de la mutación. El adaptador reconstruirá el carrito local desde esa respuesta; no asumirá que Shopify aceptó la cantidad solicitada. Las mutaciones de líneas documentan esa respuesta en [`cartLinesAdd`](https://shopify.dev/docs/api/storefront/latest/mutations/cartLinesAdd).
- Inmediatamente antes de checkout, el adaptador consultará o mutará de nuevo el carrito remoto. Solo una respuesta sin errores impeditivos y con líneas válidas habilita la redirección; la URL autoritativa será `Cart.checkoutUrl`, validada además por host y HTTPS. Consulta el contrato de [`Cart`](https://shopify.dev/docs/api/storefront/latest/objects/cart).
- `localStorage` continuará guardando solo IDs y cantidades solicitadas. El DOM, el snapshot generado durante build y cualquier cantidad enviada por el navegador son datos no confiables.

Una variante «eliminada» significa que el origen autoritativo ya no puede resolver su identidad y Shopify no devuelve una línea válida para ella; se retira del carrito con aviso. Una variante que todavía se resuelve pero no puede venderse se conserva como no disponible y bloquea checkout. Si la Storefront API elegida no permite distinguir ambos casos para una variante no publicada, el adaptador no inventará la causa: usará el estado seguro no comprable y la respuesta del carrito remoto como decisión final.

## 10. Categorías y colecciones

Las categorías públicas se modelan como colecciones. Una colección destacada ordena la portada, pero el layout acepta entre tres y seis sin asumir dos secundarias exactas. Debe decidirse qué colecciones son manuales o automáticas antes de importar.

## 11. Estrategia inequívoca de imágenes

Cada valor de `Color` tiene exactamente un metaobject `kingbelt.color_gallery` y exactamente tres archivos ordenados: posición 1, imagen principal del color; posición 2, detalle; posición 3, contexto. La imagen principal del producto es la posición 1 del primer color publicado según el orden de la opción. Cada variante referencia la posición 1 de su color; todas las tallas del mismo color reutilizan ese ID. `Product.mediaGroups` conserva el orden de las tres referencias sin copiar objetos.

Cada archivo debe pertenecer a la media del producto, tener ID y URL únicos, `alt` no vacío y contextual, y dimensiones positivas conocidas. No se inventan dimensiones. Faltan tres imágenes, sobra una, se repite una relación, el color no existe o una variante apunta a otro color: la importación falla. No hay fallback visual entre colores; el único fallback de presentación, después de que el catálogo ya sea válido, es `primaryImageId` para un uso no asociado a color. El host de imagen se añade simultáneamente a las allowlists de imagen y CSP solo cuando se conozca el dominio real.

## 12. Filtros

La selección, el predicado y la serialización URL viven en `commerce/domain/catalog-filters.ts` y los comparten build, navegador y futuro adaptador. La selección (`CatalogFilterSelection`) usa tipo, colores normalizados, un rango de precio declarativo y disjunto sobre el precio de entrada, y disponibilidad. La URL transporta esa selección (`tipo`, `color`, `precio`, `disponible`) para enlazar estados y conservarlos al volver atrás o recargar.

El controlador cliente aplica el mismo predicado del dominio y revela la colección por páginas con «Mostrar más». Cuando exista Shopify, el adaptador traducirá `CatalogFilterSelection` a sus filtros disponibles y devolverá `CollectionPage` (productos y facets) ya filtrado y paginado; los componentes no cambian. No se ha configurado Search & Discovery ni consultas remotas.

## 13. SEO

El SEO consume el dominio neutral. La ficha genera `Product`, marca, imágenes, referencia comercial como `mpn`, canonical, disponibilidad derivada y una sola oferta o `AggregateOffer`; no confunde la referencia de producto con un SKU de variante ni genera un `Offer` por variante.

## 14. Pasos exactos para activar Shopify

1. Confirmar campos pendientes, colecciones, mercados, inventario y política de imágenes.
2. Crear y validar la tienda y el catálogo fuera de este repositorio.
3. Añadir el adapter de despliegue y el BFF same-origin; no cambiar las páginas ni el store.
4. Fijar `SHOPIFY_API_VERSION` y configurar dominio y credenciales privadas solo en el entorno servidor.
5. Implementar endpoints de comandos cerrados y el cliente Storefront mínimo dentro del servidor.
6. Implementar adaptadores separados para `CatalogProvider` y el servicio servidor de carrito dentro de `commerce/infrastructure/shopify/`.
7. Mapear respuestas GraphQL al dominio neutral y ejecutar el validador antes de renderizar.
8. Autorizar el dominio CDN de imágenes solo cuando sea conocido.
9. Ejecutar pruebas de catálogo, variantes, carrito, rutas, SEO y validación visual.
10. Cambiar los composition roots `commerce/catalog.ts` y `commerce/cart.ts` a los adaptadores Shopify.
11. Configurar reconstrucciones de Vercel; valorar después webhook/deploy hook.
12. Verificar checkout, secretos, CSP/cabeceras y vuelta al adaptador demo antes de publicar.

El flujo de carrito queda fijado: BFF same-origin. Ningún token Storefront se expone al navegador. La versión API debe fijarse explícitamente y nunca ser `latest`.

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
| Crear/recuperar carrito | `CartProvider.initialize` / `refresh` | cliente neutral → endpoint same-origin → servicio servidor (aún no creados) |
| Modificar líneas | `CartProvider.addItem` / `updateItem` / `removeItem` | comandos cerrados al mismo BFF |
| Checkout | `CartProvider.checkout` + `CheckoutResult` / `getSafeCheckoutUrl` | BFF autoritativo + `checkout-redirect` |
| Cuenta de cliente futura | puerto `CustomerAccountProvider` nuevo en `application/` | §16 y plan en `plans/` |

Regla general: las respuestas GraphQL y los tipos de Shopify vivirán exclusivamente en `infrastructure/shopify/` cuando se implemente. Hoy esa carpeta no existe: no hay adaptadores incompletos en el repositorio. Páginas, componentes y scripts consumen solo los composition roots `@commerce/catalog` y `@commerce/cart` o contratos de `application`/`domain`. `tests/architecture.test.mjs` ejecuta esta frontera (rutas por composition root y solo los roots eligen infraestructura).

### 17.2 Datos de build y datos en tiempo real

Durante el build se obtiene todo el catálogo: colecciones, productos completos (opciones, variantes, imágenes, grupos de medios, especificaciones, SEO y pertenencia a colecciones) y las proyecciones de grid `ProductSummary`. Destacados y relacionados se derivan desde el dominio durante el build; el sitio no consulta el catálogo en el navegador.

En tiempo real el navegador solo envía al BFF identificadores públicos, cantidades y comandos permitidos. Un identificador opaco de sesión same-origin puede ir en cookie `HttpOnly`; la parte secreta del identificador de carrito Shopify no entra en HTML, JavaScript, almacenamiento ni respuestas públicas. El servicio servidor crea o recupera el carrito, muta líneas y obtiene checkout. Después de cada operación devuelve una proyección neutral reconstruida desde la respuesta remota (§9.1), nunca desde `localStorage` ni desde el snapshot de ficha. La tienda no muta el catálogo desde el cliente.

El servidor es autoridad para carrito remoto, precios, cantidades aceptadas, stock, identidad del comprador, checkout, `userErrors` y `warnings`. No devuelve credenciales, respuesta GraphQL completa, identidad sensible ni campos administrativos.

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
- Inventario y política según §9.1: `availableForSale`, `currentlyNotInStock`, `quantityAvailable` (cuando esté autorizado) y `quantityRule { minimum, increment, maximum }` → `inventory`, `inventoryPolicy`, `salesStatus` y `quantityRule`. Un mínimo/incremento distinto de 1/1 falla explícitamente hasta que todas las capas amplíen su política.
- Imágenes: una sola vez en `Product.images`; `featuredImage` → `primaryImageId`; imagen de variante y `mediaGroups` por valor de opción se agrupan desde `variant.image` (§11). Para activar el srcset y el recorte 4:5 ya preparados, autorizar el host exacto del CDN de Shopify (p. ej. `cdn.shopify.com`) en `imagePolicy.transformableHosts` (`src/config/images.ts`) y, a la vez, en `publicSecurityConfig.remoteImageHosts` (`src/config/security.ts`); sin eso, las URLs se sirven tal cual llegan. El render ya aplica `width`/`height`, `sizes` y `loading`/`fetchpriority` sin JavaScript de cliente.
- `descriptionHtml` se sanea a texto plano antes de usarse en ficha y meta.

### 17.5 Validación antes del uso

Tras normalizar el catálogo completo, el adaptador ejecuta `assertValidCatalog()` con las monedas soportadas por el despliegue: la misma frontera que ya ejecuta la demo. Un `CatalogValidationError` falla el build con rutas y códigos concretos; ninguna página se renderiza con un catálogo inválido. En carrito, `userErrors` y `warnings` de cada mutación se mapean a `CartOperationErrorCode` antes de exponerlos (§9.1).

### 17.6 Respuestas parciales

- Import: una respuesta incompleta (nodos ausentes, campos nulos) se normaliza y después se valida. Si un dato obligatorio no puede resolverse, el build falla en vez de adivinar; un catálogo parcial nunca se publica.
- Carrito: las mutaciones devuelven el carrito completo; errores y avisos por línea se traducen a `CartOperationResult`. El store cliente conserva el último estado válido y muestra mensajes; no reemplaza el carrito por uno vacío ante una respuesta parcial.

### 17.7 Límites, errores y reintentos

- Límites: `first ≤ 250` (§17.3), máximo tres opciones y 2.048 variantes por producto; los límites técnicos de línea y carrito siguen aplicándose a lo que envía el navegador, y las reglas comerciales normalizadas y el carrito remoto son autoridad de cantidades (§9.1).
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

### 17.12 Gateway GraphQL servidor ligero (sin SDK)

No se usará `@shopify/hydrogen-react` ni otro SDK cliente: un gateway propio exclusivamente servidor en `infrastructure/shopify/` con `fetch`, la versión fijada, las credenciales privadas y una función `graphql()` tipada cubre catálogo, carrito y cuenta futura sin dependencia nueva. La carpeta se crea al implementar; no se conserva ningún adaptador, endpoint ni variable incompletos en el repositorio. Los roots siguen usando demo hasta que la infraestructura real implemente sus contratos, pase validación y se pruebe (§14).
