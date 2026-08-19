# Preparación de KingBelt para Shopify

## 1. Estado actual

La web usa SSR en Vercel. `COMMERCE_SOURCE` es obligatoria y selecciona de forma determinista `demo` o `shopify` para catálogo y carrito a la vez. Con `demo`, solo se usan los adapters demo, `localStorage` y `/cart-catalog.json`; las credenciales Shopify presentes se ignoran. Con `shopify`, el catálogo consulta Storefront por recurso con una caché breve por instancia y el carrito usa el BFF same-origin `/api/cart` y la Cart API. Una configuración Shopify incompleta no activa demo: las páginas de catálogo fallan cerrado y el BFF responde `503`. El webhook de catálogo puede reconstruir Vercel como respaldo.

La Storefront API está fijada en `2026-07` y usa exclusivamente el token privado. El runtime consulta y pagina el recurso solicitado —producto, colección o resúmenes—; el preflight descarga el catálogo completo, normaliza la respuesta al dominio neutral y falla cerrado si el catálogo es parcial. `bun run shopify:smoke` comprueba únicamente la conectividad mínima `shop { name }`. La barrera autoritativa antes de un despliegue Shopify es `bun run shopify:preflight`: valida configuración, autenticación, Storefront API, carga completa del catálogo, mapping y `assertValidCatalog()`. `bun run build` solo valida la compilación y no llama a Shopify.

`src/demo-catalog.ts` no es una plantilla de importación ni una definición del catálogo definitivo. Sus productos, nombres, precios, inventario, colecciones e imágenes son fixtures para probar contratos, rutas y estados. El catálogo sintético de tests verifica la escala prevista sin anticipar datos comerciales reales.

Los adaptadores demo y Shopify pasan por `assertValidCatalog()` antes de exponer datos. Las respuestas externas quedan confinadas a `infrastructure/shopify/`; páginas y componentes no conocen tipos de Shopify.

La consulta real del 18 de agosto de 2026 confirma `cdn.shopify.com` como host exacto de imágenes, ya autorizado en la política de imagen y la CSP. Los metafields `kingbelt.*` de copy y especificaciones pueden caer a campos nativos si aún no están visibles en Storefront. `kingbelt.color_galleries` no tiene degradación: un producto con opción Color debe exponer ese metafield con Storefront access = Read. Nunca se deben repartir imágenes por posición, filename, URL ni por huecos entre portadas. No se inventa material, ancho ni copy comercial. Un fallo de obtención o un catálogo vacío sigue fallando cerrado: sin catálogo previo la petición no se renderiza; con uno válido, se sirve el último conocido (stale-if-error).

## 2. Arquitectura objetivo

```txt
COMMERCE_SOURCE=demo
  páginas SSR → CatalogProvider demo
  navegador   → CartProvider demo → localStorage + /cart-catalog.json

COMMERCE_SOURCE=shopify
  páginas SSR → CatalogProvider Shopify con caché breve
  navegador   → CartProvider Shopify → /api/cart → servicio servidor → Storefront Cart API
                                             ↘ checkout Shopify validado por host
```

Las respuestas GraphQL se transforman al dominio neutral dentro de los adaptadores y no llegan a páginas ni componentes. El token privado y el ID remoto del carrito quedan confinados al servidor.

## 3. Proveedor de catálogo

Es responsable de colecciones, resúmenes para grids, fichas completas, handles, destacados y relacionados. Los resúmenes excluyen variantes para que una colección no serialice el catálogo completo.

## 4. Proveedor de carrito

El contrato neutral es responsable de inicializar, añadir una variante, modificar cantidades, eliminar líneas y obtener checkout. La identidad pública de entrada es `variantId`; título, precio, imagen, opciones, stock y cantidad aceptada se vuelven a resolver contra el origen autoritativo. En modo demo, el adapter resuelve desde `/cart-catalog.json` y conserva líneas en `localStorage`. En modo Shopify, el cliente solo habla con `/api/cart`; la persistencia real sigue `browser → opaque session cookie → Astro session store → Shopify cartId`, nunca `localStorage` ni el snapshot demo.

## 5. Producto y variante

`Product` diferencia ID interno, handle y referencia comercial. Cada `ProductVariant` tiene ID y SKU propios y selecciona IDs de valores de opción del producto. El precio pertenece a la variante. El stock se normaliza como conocido o desconocido, con política separada para denegar o continuar la venta sin existencias; la disponibilidad se deriva y no se almacena como otro dato contradictorio. Cada producto admite como máximo tres opciones y 2.048 variantes. Solo existen combinaciones declaradas como variantes; no se calcula el producto cartesiano de opciones.

`ProductSummary` es una proyección de lectura para grids. Deriva imagen, rango de precio, colores y disponibilidad, y nunca contiene variantes ni SKU. `Product` tampoco conserva esa proyección como una segunda fuente editable. La ficha serializa `toCompactPublicBuyBoxPayload()`: IDs públicos, selecciones ordenadas, importes, imagen, estado y regla de cantidad. No incluye SKU, inventario exacto, nombres repetidos, coste, vendor ni objetos completos.

Cada variante declara `quantityRule.minimum`, `increment` y `maximum?`. La política inicial de KingBelt acepta expresamente mínimo 1 e incremento 1; una regla distinta hace fallar el catálogo. El máximo opcional se respeta en selector, carrito, persistencia, reconciliación y futuro servicio servidor. Los límites técnicos de protección siguen separados de este máximo comercial y nunca se presentan como stock.

## 6. Renderizado server-side

Las rutas de producto y colección consultan el proveedor por handle en cada render server-side y ya no dependen de `getStaticPaths()`. La caché de 30 segundos limita la latencia y permite reflejar cambios de Shopify rápidamente. El sitemap de comercio se genera en `/sitemap-commerce.xml`.

## 7. Actualización del catálogo

Los datos se obtienen bajo demanda. Un cambio en Shopify queda disponible al expirar la caché breve de la instancia; el webhook sigue disponible para disparar un rebuild de respaldo.

En `astro dev`, el adaptador Shopify vuelve a consultar Storefront en cada petición (con coalescencia si hay varias lecturas a la vez). Recargar la ficha basta para ver descripciones nuevas.

En producción, `POST /api/shopify-catalog-rebuild` verifica la firma HMAC de Shopify y, si el topic es de producto o colección, llama al Deploy Hook de Vercel. El navegador no consulta Shopify. Sin `SHOPIFY_WEBHOOK_SECRET` y `VERCEL_DEPLOY_HOOK_URL` el endpoint responde `503`.

Para activarlo:

1. En Vercel, crear un Deploy Hook y guardar la URL en `VERCEL_DEPLOY_HOOK_URL`.
2. Copiar el secreto de firma de webhooks de Shopify en `SHOPIFY_WEBHOOK_SECRET`.
3. En Shopify Admin → Settings → Notifications → Webhooks, crear eventos `products/create`, `products/update`, `products/delete`, `collections/create`, `collections/update` y `collections/delete` hacia `https://kingbelt.com/api/shopify-catalog-rebuild`.
4. Un build que falle deja publicado el despliegue anterior.

## 8. Contrato definitivo de producto

| Dato de Shopify | Cardinalidad / regla | Destino interno |
| --- | --- | --- |
| `Product.id` | 1, obligatorio | `Product.id` |
| `Product.handle` | 1, obligatorio, único y publicable como ruta | `Product.handle` |
| `Product.vendor` | 1, obligatorio | `Product.vendor` |
| `Product.productType` | 1, obligatorio | `Product.productType` |
| categoría oficial | 1, obligatoria, ID y nombre | `Product.category` |
| colecciones publicadas | 1..n, IDs existentes; una primaria exigida por `kingbelt.primary_collection` | `collectionIds` y `primaryCollectionId` |
| estado de publicación del canal | 1, obligatorio | `publicationStatus`; lo no publicado falla el catálogo público |
| opción `Color` | 1 cuando el producto varía por color; valores únicos | `ProductOption` con `purpose: color` |
| opción `Talla` | 1 cuando el producto varía por talla; valores únicos | `ProductOption` con `purpose: size` |
| opciones restantes | hasta completar tres en total | `ProductOption`; más de tres falla |
| `ProductVariant.id` | 1 por variante, único | `ProductVariant.id` |
| `ProductVariant.sku` | 1, obligatorio y único en todo el catálogo | `ProductVariant.sku` recibido de Storefront; nunca se fabrica ni se serializa al navegador |
| opciones seleccionadas | exactamente una por opción y con valor existente | `optionValues`; no se generan combinaciones ausentes |
| `price` / `compareAtPrice` | precio obligatorio y comparado opcional, misma moneda | `price` / `compareAtPrice` en unidades mínimas |
| `quantityAvailable` | 0..1 según permisos; `null` significa desconocido | `inventory: known | unknown`; nunca público como cifra |
| `inventoryPolicy` y estados de venta | 1, obligatorios | `inventoryPolicy`, `salesStatus` y disponibilidad derivada |
| `quantityRule` | mínimo e incremento obligatorios; máximo opcional | `quantityRule`; inicialmente solo 1/1 es compatible |
| título y cuerpo | título y descripción obligatorios, texto saneado | `title` y `description` |
| SEO nativo | título/description opcionales | `seo`; fallback determinista a título y resumen, sin inventar copy |
| media de producto | con opción Color: exactamente tres `MediaImage` por color desde `kingbelt.color_galleries`; sin opción Color: `mediaGroups = []` y portada de `featuredImage` | `images`, `primaryImageId`, `mediaGroups` e `imageId` de variante |

`reference`, `summary`, `badge`, material, ancho y hebilla/acabado se resuelven con los metafields `kingbelt.*` cuando están publicados para Storefront. Si aún no lo están, el importador usa campos nativos: `handle` como referencia, `description` como resumen, título de colección si falta descripción y título de producto como `alt`. `ProductVariant.sku` no tiene fallback: Storefront debe devolver el SKU comercial no vacío; si falta, el mapping y `shopify:preflight` fallan. Para Color, `kingbelt.color_galleries` es la única fuente: si falta, está vacío, no tiene Storefront access o las relaciones son inválidas, el mapping falla. No se inventa copy comercial, material, medidas ni códigos de variante. No se importa coste, margen, tags administrativos ni HTML sin sanear.

### 8.1 Metafields y metaobject de galería

| Propietario | Namespace / key | Tipo Shopify | Cardinalidad | Obligatorio | Fallback | Destino interno |
| --- | --- | --- | --- | --- | --- | --- |
| Product | `kingbelt.model_reference` | `single_line_text_field` | exactamente 1 | si está publicado | `handle` del producto | `Product.reference` |
| Product | `kingbelt.summary` | `multi_line_text_field` | exactamente 1 | si está publicado | `description` nativa | `Product.summary` |
| Product | `kingbelt.material` | `single_line_text_field` | exactamente 1 | si está publicado | se omite la especificación | `specifications[Material]` |
| Product | `kingbelt.width_mm` | `number_integer` | exactamente 1, positivo | si está publicado | se omite la especificación | `specifications[Ancho]` |
| Product | `kingbelt.buckle_finish` | `single_line_text_field` | exactamente 1 | si está publicado | se omite la especificación | `specifications[Hebilla/acabado]` |
| Product | `kingbelt.badge` | `single_line_text_field` | 0..1 | no | se omite | `Product.badge` |
| Product | `kingbelt.primary_collection` | `collection_reference` | exactamente 1 | sí, si el producto está en más de una colección | la única colección publicada, si hay exactamente una | `Product.primaryCollectionId` |
| Product | `kingbelt.color_galleries` | `list.metaobject_reference` | exactamente una referencia por valor de Color | products with Color option | no hay fallback | `Product.mediaGroups` |
| Metaobject referenciado | `color_value` | `single_line_text_field` | exactamente 1 | con galería estructurada | no aplica | relación con `optionValueId` de Color |
| Metaobject referenciado | `images` | `list.file_reference` | exactamente 3, ordenadas | con galería estructurada | no aplica | IDs de `Product.images` del grupo |

Todos los metafields `kingbelt.*` se consultan juntos en la ficha completa. Copy, especificaciones y distintivo pueden caer a campos nativos de §8 si aún no están visibles en Storefront. `kingbelt.primary_collection` es autoridad cuando existe: debe ser una referencia Storefront a Collection, pertenecer a `product.collections` y no depende del orden en que Shopify las devuelva. Si el metafield no llega y el producto tiene exactamente una colección publicada, esa colección es la primaria. Si pertenece a varias, el mapping falla. `kingbelt.color_galleries` tampoco tiene fallback: un producto con opción Color debe exponer exactamente una galería por valor, con Storefront access = Read y el scope `unauthenticated_read_metaobjects`. Si el metafield no llega, llega vacío, tiene tipo incorrecto o las referencias no se resuelven, el mapping falla. Un producto sin opción Color conserva `mediaGroups = []` y no exige este metafield. Las queries de `ProductSummary` no descargan las tres imágenes de cada color.

Definición esperada de la galería por color (no se crea ni se rellena desde el frontend ni con Admin API):

```txt
Product metafield
namespace: kingbelt
key: color_galleries
type: list.metaobject_reference
required: products with Color option
Storefront access: Read

Metaobject fields
color_value
→ single_line_text_field
→ debe coincidir con un valor de la opción Color

images
→ list.file_reference
→ exactamente 3 MediaImage
→ orden: portada, detalle, contexto

variant.image
→ debe ser images[0] de su color
```

Definición esperada de la colección principal (no se crea desde el frontend ni con Admin API):

```txt
Owner: Product
Namespace: kingbelt
Key: primary_collection
Type: Collection reference
Cardinality: single
Required for published KingBelt products: yes
Storefront access: read
```

## 9. Decisiones empresariales pendientes

Faltan confirmar catálogo definitivo, precios, reglas de stock, taxonomía de colecciones, categoría oficial, materiales, anchos, hebillas, textos SEO, política de imágenes, checkout y credenciales autorizadas. El mercado operativo actual es España (`ES` / `ES` / `EUR`); multi-market y multi-currency siguen fuera de alcance. El coste nunca formará parte del dominio público.

En particular, siguen pendientes el umbral de «pocas unidades» y si se expondrán cifras exactas de inventario. Sus defaults de demo están aislados en `src/commerce/domain/commerce-rules.ts`; no se convertirán en configuración de Shopify ni en copy público definitivo sin confirmación.

## 9.1. Autoridad de disponibilidad al conectar Shopify

La autoridad depende del momento del flujo:

- En ficha y selección de variante, el adaptador normalizará la variante publicada para el canal a partir de `availableForSale`, `currentlyNotInStock`, `quantityAvailable` cuando esté accesible y `quantityRule { minimum, increment, maximum }`. `quantityAvailable: null`, no solicitado o no autorizado se normaliza como inventario `unknown`; nunca como una cifra ficticia. `currentlyNotInStock` permite representar una variante comprable sin stock. Consulta el contrato vigente de [`ProductVariant`](https://shopify.dev/docs/api/storefront/latest/objects/productvariant) y [`QuantityRule`](https://shopify.dev/docs/api/storefront/latest/objects/quantityrule) de la versión fijada al implementar.
- Después de crear, añadir, actualizar o eliminar líneas, el `Cart` retornado por Shopify es la autoridad absoluta: KingBelt no reconstruye cantidades pedidas por el navegador ni el estado local previo. Las mutaciones consultan `cart`, `userErrors { field message code }` y `warnings { code message target }`. `CartUserError.code` (`CartErrorCode`) bloquea la operación correspondiente; `CartWarning.code` (`CartWarningCode`) representa un ajuste automático o una incidencia no bloqueante y no convierte `success` en `false`. El estado adoptado es siempre `payload.cart`. `cart = null` en una mutación sin error explícito es un error de proveedor, no un carrito vacío exitoso. Consulta [`cartLinesAdd`](https://shopify.dev/docs/api/storefront/latest/mutations/cartLinesAdd) y [`CartWarning`](https://shopify.dev/docs/api/storefront/latest/objects/CartWarning).
- La disponibilidad de cada línea del carrito se deriva del `ProductVariant` embebido (`availableForSale`, `currentlyNotInStock`, `quantityRule { minimum, increment, maximum }`), no de valores fijos. No se inventa `inventoryPolicy` ni stock exacto en Cart: `quantityKnown` permanece `false` hasta conceder e importar `quantityAvailable`. `currentlyNotInStock` con `availableForSale` permite comprar en backorder. Una línea no comprable o una cantidad fuera de `quantityRule` bloquea `canCheckout`; un `severity: notice` no lo hace.
- Inmediatamente antes de checkout, el servicio vuelve a leer el carrito remoto. Solo un carrito con líneas comprables, cantidades válidas, sin errores bloqueantes y con `Cart.checkoutUrl` válida (host y HTTPS) habilita la redirección. Consulta el contrato de [`Cart`](https://shopify.dev/docs/api/storefront/latest/objects/cart).
- Solo el carrito demo guarda IDs y cantidades solicitadas en `localStorage`. En Shopify, el DOM, cualquier snapshot y cualquier cantidad enviada por el navegador son datos no confiables; el carrito remoto y la sesión server-side de Astro son autoritativos (`browser → opaque session cookie → Astro session store → Shopify cartId`).

Una variante «eliminada» significa que el origen autoritativo ya no puede resolver su identidad y Shopify no devuelve una línea válida para ella; se retira del carrito con aviso. Una variante que todavía se resuelve pero no puede venderse se conserva como no disponible y bloquea checkout. Si la Storefront API elegida no permite distinguir ambos casos para una variante no publicada, el adaptador no inventará la causa: usará el estado seguro no comprable y la respuesta del carrito remoto como decisión final.

## 10. Categorías y colecciones

Las categorías públicas se modelan como colecciones. Una colección destacada ordena la portada, pero el layout acepta entre tres y seis sin asumir dos secundarias exactas. Debe decidirse qué colecciones son manuales o automáticas antes de importar.

## 11. Estrategia inequívoca de imágenes

`kingbelt.color_galleries` es la única fuente autoritativa para relacionar colores con imágenes. Cada valor de `Color` tiene exactamente un metaobject y tres `MediaImage` ordenadas: posición 1, portada; posición 2, detalle; posición 3, contexto. El orden de `images` en el metaobject es el que configura la persona en Shopify Admin; no se reordena por filename, ID, URL, alt ni posición global en `product.images`. La imagen principal del producto es la posición 1 del primer color según el orden de la opción Color, no el orden accidental del metafield. `variant.image` debe ser `images[0]` de su color; si falta o apunta a otra imagen, el mapping falla. `Product.mediaGroups` conserva las tres referencias sin copiar objetos. Las imágenes referenciadas que no vengan en `product.images` se incorporan al producto y se deduplican por `image.id`.

Si el metafield no llega por Storefront, está vacío, tiene un color de más o de menos, no es `MediaImage`, no tiene dimensiones o repite una imagen, el mapping falla. No hay inferencia por filename, URL, alt text, posición ni orden de variantes. Nunca se deben repartir imágenes por posición, orden de `Product.images` ni por huecos entre portadas. Un producto sin opción Color no exige el metafield y conserva `mediaGroups = []`; su imagen principal sale de `featuredImage`. Cada archivo debe tener ID y URL únicos, `alt` no vacío y contextual, y dimensiones positivas conocidas.

## 12. Filtros

La selección, el predicado y la serialización URL viven en `commerce/domain/catalog-filters.ts` y los comparten build, navegador y adaptadores. La selección (`CatalogFilterSelection`) usa tipo, colores normalizados, un rango de precio declarativo y disjunto sobre el precio de entrada, y disponibilidad. La URL transporta esa selección (`tipo`, `color`, `precio`, `disponible`) para enlazar estados y conservarlos al volver atrás o recargar.

El controlador cliente aplica el mismo predicado del dominio y revela la colección por páginas con «Mostrar más». El adaptador Shopify consulta la colección y sus resúmenes de producto (caché breve por instancia) y devuelve `CollectionPage`; los componentes no cambian. Traducir filtros a Search & Discovery remoto queda fuera de esta activación.

## 13. SEO

El SEO consume el dominio neutral. La ficha genera `Product`, marca, imágenes, referencia comercial como `mpn`, canonical, disponibilidad derivada y una sola oferta o `AggregateOffer`; no confunde la referencia de producto con un SKU de variante ni genera un `Offer` por variante.

## 14. Pasos exactos para activar Shopify

1. Declarar `COMMERCE_SOURCE=shopify` explícitamente en el entorno correspondiente.
2. Completar las descripciones de `casual`, `sport` y `vestir`.
3. Crear, rellenar y habilitar visibilidad Storefront de los metafields/metaobjects de §8.1 para cada producto publicado en Headless.
4. Añadir alt contextual a todas las imágenes, completar imágenes/SKU pendientes y corregir cualquier relación variante-color. Mientras un producto no esté listo, retirarlo del canal Headless en vez de depender de un filtro local.
5. Mantener activos `unauthenticated_read_product_listings` y `unauthenticated_read_metaobjects`. Habilitar `unauthenticated_read_product_inventory` si se quiere importar `quantityAvailable`; mientras no esté autorizado, el adaptador conserva inventario `unknown` sin inventar cifras. Los scopes futuros de carrito siguen siendo `unauthenticated_read_checkouts` y `unauthenticated_write_checkouts`.
6. En entornos confiables con `COMMERCE_SOURCE=shopify`, ejecutar `COMMERCE_SOURCE=shopify bun run shopify:preflight` y después `bun run build`. El preflight valida configuración y contrato real contra Storefront; el build solo compila. No usar el job `quality` de Pull Requests ni `COMMERCE_SOURCE=demo` como demostración de que Shopify está listo.

Secuencia operativa de un deployment Shopify:

```sh
bun install --frozen-lockfile
COMMERCE_SOURCE=shopify bun run shopify:preflight
bun run build
```

`shopify:preflight` es read-only: no crea carritos, no llama Admin API y no dispara deploy hooks. Si `SHOPIFY_PREFLIGHT_REQUIRED_PRODUCT_HANDLES` está definida (`handle-1,handle-2`), esos handles deben existir y resolverse. `shopify:smoke` sigue siendo solo conectividad `shop { name }`.
7. Mantener desplegado el adapter de Vercel, el BFF same-origin para carrito y Redis/KV persistente (Upstash) para el store de sesiones de Astro.
8. Configurar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Vercel. El navegador solo recibe una cookie de sesión opaca; el Cart ID completo vive en el session store.
9. Ejecutar pruebas de variantes, carrito, checkout, seguridad y validación visual.
10. Configurar `SHOPIFY_WEBHOOK_SECRET`, `VERCEL_DEPLOY_HOOK_URL` y los webhooks de catálogo hacia `/api/shopify-catalog-rebuild` como respaldo opcional (el catálogo ya se actualiza solo vía SSR).
11. Verificar checkout, secretos, CSP/cabeceras y rollback explícito antes de publicar.

El flujo de carrito queda fijado: BFF same-origin. Ningún token Storefront se expone al navegador. La versión API debe fijarse explícitamente y nunca ser `latest`.

`COMMERCE_SOURCE` se configura en las variables de entorno de cada deployment, no en `vercel.json`. Local y Preview de PR no conectados a staging usan `COMMERCE_SOURCE=demo` sin credenciales de producción. Staging y Production usan `COMMERCE_SOURCE=shopify` con secretos exclusivos de cada tienda. El valor no se deriva de `VERCEL_ENV`, hostname, rama ni credenciales.

## 15. Vuelta temporal al adaptador demo

Mantener `src/demo-catalog.ts` y `commerce/infrastructure/demo/` mientras dure la transición. Ante una incidencia, declarar `COMMERCE_SOURCE=demo` y hacer redeploy/restart; para volver a Shopify, declarar `COMMERCE_SOURCE=shopify` y repetir el despliegue. La reversión es auditable y no exige cambiar código, páginas ni componentes.

## 16. Cuentas de cliente

Login, registro y cuenta se delegan temporalmente a Shopify Customer Accounts. KingBelt no implementa autenticación propia, Customer Account API, OAuth, perfil, pedidos ni direcciones.

`SHOPIFY_CUSTOMER_ACCOUNT_URL` es la URL base alojada configurada en Shopify Customer Accounts. Es `astro:env` de servidor público (`context: server`, `access: public`). No se construye concatenando `SHOPIFY_STORE_DOMAIN` + `/account`. El preflight exige que esté presente y sea HTTPS válido; no hace peticiones autenticadas contra la cuenta.

El CTA «Iniciar sesión» del header y del menú móvil, y la ruta de compatibilidad `/cuenta/iniciar`, resuelven esa única URL. En modo Shopify, `/cuenta/iniciar` redirige 307 al portal alojado y no renderiza el panel visual. El panel de `/cuenta/iniciar` solo existe en `COMMERCE_SOURCE=demo` y no autentica.

Checkout, revisión, thank-you y estado del pedido los gestiona Shopify Checkout a partir de `checkoutUrl` del carrito. No hay `SHOPIFY_CHECKOUT_URL` ni páginas Astro de gracias, revisión o estado de pedido.

La arquitectura de Customer Account API con BFF y sesión propia sigue documentada en [`plans/2026-08-06-shopify-customer-accounts-design.md`](plans/2026-08-06-shopify-customer-accounts-design.md) y no forma parte de este enlace a superficies alojadas.

## 17. Decisiones de arquitectura de la integración

Este apartado fija las decisiones de la integración. La lectura de catálogo, el carrito BFF, el runtime SSR y el enlace a Customer Accounts alojadas están implementados; Customer Account API, perfil y pedidos propios siguen pendientes (§16).

### 17.1 Fronteras por capacidad

| Capacidad | Puerto / contrato | Implementación prevista |
| --- | --- | --- |
| Lectura de catálogo | `CatalogProvider` (§3) | `infrastructure/shopify/catalog-adapter.ts` |
| Lectura de colecciones | `CatalogProvider.getCollections` / `getCollectionByHandle` | idem |
| Producto por handle | `CatalogProvider.getProductByHandle` / `getProductHandles` | idem |
| Destacados | `CatalogProvider.getFeaturedProducts` | idem |
| Relacionados | `CatalogProvider.getRelatedProducts` | idem, derivado desde el dominio |
| Resolución de variantes | dentro del adaptador (identidad `gid` de variante) y mappers a `ProductVariant` | `catalog-mappers.ts` |
| Crear/recuperar carrito | `CartProvider.initialize` / `refresh` | cliente neutral → `src/pages/api/cart.ts` → `shopify-cart.ts` (BFF same-origin implementado) |
| Modificar líneas | `CartProvider.addItem` / `updateItem` / `removeItem` | comandos cerrados al mismo BFF |
| Checkout | `CartProvider.checkout` + `CheckoutResult` / `getSafeCheckoutUrl` | BFF autoritativo + `checkout-redirect` |
| Acceso a cuenta (alojado) | `commerce-navigation` + `SHOPIFY_CUSTOMER_ACCOUNT_URL` | Header, menú móvil y `/cuenta/iniciar` → Customer Accounts |
| Cuenta de cliente (API) | puerto `CustomerAccountProvider` futuro en `application/` | §16 y plan en `plans/`; no implementado |

Regla general: las respuestas GraphQL y los tipos de Shopify viven exclusivamente en `infrastructure/shopify/`. La carpeta contiene configuración, gateway genérico, frontera `astro:env`, query paginada, mapper y adapter de catálogo. Páginas, componentes y scripts consumen solo los composition roots `@commerce/catalog`, `@commerce/cart` y `@commerce/commerce-navigation` o contratos de `application`/`domain`. Todo el árbol Shopify es ahora alcanzable desde el composition root real, por lo que `tests/architecture.test.mjs` ya no necesita una excepción temporal de reachability.

### 17.2 Datos de build y datos en tiempo real

Durante cada ciclo de caché SSR se obtiene todo el catálogo: colecciones, productos completos (opciones, variantes, imágenes, grupos de medios, especificaciones, SEO y pertenencia a colecciones) y las proyecciones de grid `ProductSummary`. Destacados y relacionados se derivan desde el dominio en servidor; el sitio no consulta Shopify desde el navegador.

En tiempo real el navegador solo envía al BFF identificadores públicos, cantidades y comandos permitidos. El flujo de persistencia es `browser → opaque session cookie → Astro session store → Shopify cartId`. La cookie `HttpOnly` contiene únicamente un identificador de sesión aleatorio; la parte secreta del identificador de carrito Shopify no entra en HTML, JavaScript, almacenamiento, JSON público ni cookies decodificables. El servicio servidor crea o recupera el carrito, muta líneas y obtiene checkout. Después de cada operación devuelve una proyección neutral reconstruida desde la respuesta remota (§9.1), nunca desde `localStorage` ni desde el snapshot de ficha. La tienda no muta el catálogo desde el cliente.

El servidor es autoridad para carrito remoto, precios, cantidades aceptadas, stock, identidad del comprador, checkout, `userErrors` y `warnings`. No devuelve credenciales, respuesta GraphQL completa, identidad sensible ni campos administrativos.

### 17.3 Paginación de productos, variantes e imágenes

La paginación es una preocupación interna del adaptador de importación, no del contrato público: `CatalogProvider` devuelve conjuntos completos y las páginas no pagan.

- Productos y colecciones: connections con `first: 250` y cursor (`pageInfo.hasNextPage` / `endCursor`) en bucle hasta agotar; el Storefront API no admite más de 250 por página.
- Pertenencia producto → colección: `Product.collections(first: 250)` por producto, paginado si excede; rellena `Product.collectionIds`.
- Variantes e imágenes de cada producto: `Product.variants(first: 250)` y `Product.images(first: 250)` con su propio cursor si el producto los supera.
- El recorrido guarda cada producto por handle/id una sola vez; no se reconsulta un nodo ya leído. Si el coste de query del store exigiera bajar `first`, se ajusta en la constante del adaptador, no con un valor distinto por request.

### 17.4 Transformación al dominio interno

La normalización vive en `catalog-mappers.ts` y no conoce página ni componente:

- `MoneyV2 { amount, currencyCode }` → `moneyFromDecimal(amount, currencyCode)`; nunca aritmética de coma flotante.
- IDs opacos `gid://shopify/...` → `productId()` / `variantId()` tal cual.
- `options` → `ProductOption`; `purpose` solo cuando el nombre coincide con los conocidos (Color→color, Talla/Tamaño→size). `swatch` solo si el origen lo expone.
- `selectedOptions` de variante → `OptionSelection[]` contra valores existentes; las combinaciones no declaradas no producen variante (§5).
- Inventario y política según §9.1: `availableForSale`, `currentlyNotInStock`, `quantityAvailable` (cuando esté autorizado) y `quantityRule { minimum, increment, maximum }` → `inventory`, `inventoryPolicy`, `salesStatus` y `quantityRule`. Un mínimo/incremento distinto de 1/1 falla explícitamente hasta que todas las capas amplíen su política.
- Imágenes: una sola vez en `Product.images`. Con opción Color, `kingbelt.color_galleries` es obligatorio: cada color exige un metaobject y tres `MediaImage` ordenadas. El `id` del grupo es el del metaobject. `primaryImageId` es la portada del primer color y `variant.imageId` coincide con la portada de su color (§11). Sin opción Color, `mediaGroups = []` y la imagen principal sale de `featuredImage`. El host real `cdn.shopify.com` está autorizado de forma exacta en `imagePolicy.transformableHosts`, `publicSecurityConfig.remoteImageHosts` y CSP; no se usan comodines. El render aplica `width`/`height`, `srcset`, `sizes` y `loading`/`fetchpriority` sin JavaScript de cliente.
- `descriptionHtml` se sanea a texto plano antes de usarse en ficha y meta.

### 17.5 Validación antes del uso

Tras normalizar el catálogo completo, el adaptador ejecuta `assertValidCatalog()` con las monedas de `SHOPIFY_MARKET_CONTEXT` (`EUR`): la misma frontera que ya ejecuta la demo. Un `CatalogValidationError` no hace fallar `bun run build`: el build es una compilación reproducible y no consulta Shopify. En runtime, un catálogo inválido sin uno válido previo hace fallar la petición SSR; con uno válido se sirve el último conocido (stale-if-error). La barrera previa al deploy es `bun run shopify:preflight`, que carga el catálogo real bajo el mismo `@inContext(country: ES, language: ES)`, lo mapea y exige que `assertValidCatalog()` pase. En carrito, `CartErrorCode` de `userErrors` se traduce a `CartOperationErrorCode` y `CartWarningCode` a avisos de dominio; nunca se clasifican errores o warnings buscando palabras en `message` (§9.1).

### 17.6 Respuestas parciales

- Import: una respuesta incompleta (nodos ausentes, campos nulos) se normaliza y después se valida. Si un dato obligatorio no puede resolverse, el preflight y el runtime fallan en vez de adivinar; un catálogo parcial nunca se publica. `bun run build` no es esa barrera.
- Carrito: las mutaciones adoptan el `Cart` remoto aunque vengan `userErrors` o `warnings`. Un error de una línea no vacía el resto. `warnings` de inventario (`MERCHANDISE_NOT_ENOUGH_STOCK`, `MERCHANDISE_OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE_IN_BUYER_LOCATION`) se traducen al dominio; un código desconocido genera un aviso genérico y conserva el carrito. El store cliente no reemplaza el carrito por uno vacío ante una respuesta parcial.

### 17.7 Límites, errores y reintentos

- Límites: `first ≤ 250` (§17.3), máximo tres opciones y 2.048 variantes por producto; los límites técnicos de línea y carrito siguen aplicándose a lo que envía el navegador, y las reglas comerciales normalizadas y el carrito remoto son autoridad de cantidades (§9.1).
- Throttling: Storefront aplica coste de query. El importador actual usa el timeout de 15 s del gateway y no reintenta. Una política acotada de `429`/`Retry-After` para lecturas idempotentes queda pendiente hasta observar una necesidad real; las mutaciones nunca compartirán esa política de forma automática.
- Mutaciones de carrito: no se reintentan sin confirmación (evita duplicar líneas); solo se reintentan lecturas idempotentes. Los fallos de red se traducen a `provider_error`.
- Errores de negocio (stock, límites) no se reintentan: se devuelven como `CartOperationResult`.

### 17.8 Versión de la API

La versión Storefront está fijada en `2026-07` mediante una constante compartida y `SHOPIFY_API_VERSION`, validada por `astro:env` y por la frontera de inicialización. No acepta `latest` ni otra versión. Cambiarla exige una modificación deliberada, revisión y reconstrucción.

### 17.9 Actualización del sitio al cambiar el catálogo

El catálogo se lee bajo demanda con una caché breve por instancia (§7): un cambio en Shopify queda visible al expirar la caché, sin necesidad de rebuild. El webhook `POST /api/shopify-catalog-rebuild` (endpoint Astro dentro de `src/pages/api/`) dispara el Deploy Hook de Vercel como respaldo opcional —por ejemplo, para forzar un redeploy que purgue la caché CDN—. El contenido editorial no participa.

### 17.10 Vuelta temporal al proveedor local

Se conservan `src/demo-catalog.ts` y `commerce/infrastructure/demo/`. La reversión es declarar `COMMERCE_SOURCE=demo` y redesplegar (§15). No existe fallback de runtime entre proveedores; páginas y componentes no cambian porque ambos comparten el dominio neutral.

### 17.11 Evitar páginas corruptas por caída del catálogo

- Fail-closed en runtime: si la obtención o la validación de un recurso de catálogo falla sin una respuesta válida previa de ese mismo recurso, la petición falla y la página no se renderiza vacía ni corrupta; el despliegue anterior de Vercel sigue publicando el sitio. Los errores de configuración (`ShopifyConfigurationError`: faltan o son inválidos `SHOPIFY_STORE_DOMAIN` o `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`) también fallan cerrado, registran un diagnóstico sin secretos y no sirven un catálogo vacío.
- Stale-if-error: con una respuesta válida en memoria para el mismo recurso, una caída puntual de Shopify sirve esa versión y la siguiente petición reintenta la carga; el sitio no se apaga por una incidencia ajena. No se reutiliza la caché de otro handle ni se ocultan errores de autenticación, configuración, esquema o mapping.
- El adaptador no degrada a un «catálogo vacío» silencioso por una respuesta parcial de Storefront ni por configuración inválida: un producto o colección inexistente (`null`) se traduce a `undefined`; un fallo de API o de configuración se propaga.
- En el navegador, un fallo del carrito Shopify conserva el último estado válido o expone un error temporal; nunca activa el adapter demo, `localStorage`, `/cart-catalog.json` ni un checkout ficticio.
- El rollback al adaptador demo (§17.10) es la vía operativa rápida y no exige cambios de UI.

### 17.12 Gateway GraphQL servidor ligero (sin SDK)

Existe un gateway propio exclusivamente servidor en `infrastructure/shopify/` con `fetch`, versión `2026-07`, autenticación privada, timeout y una función `graphql()` genérica y tipada. Distingue fallos HTTP, JSON inválido y errores GraphQL sin devolver respuestas parciales ni registrar cuerpos o credenciales. No usa Hydrogen ni SDK adicional y no conoce el dominio; las queries de catálogo viven separadas en `catalog-query.ts`.

`COMMERCE_SOURCE` es `client/public` y selecciona el proveedor sin contener secretos. `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_API_VERSION` y `SHOPIFY_CUSTOMER_ACCOUNT_URL` son variables `server/public`; `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` y `VERCEL_DEPLOY_HOOK_URL` son `server/secret`. El store de sesiones usa `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en runtime, fuera de `astro:env`. Con `COMMERCE_SOURCE=shopify`, un dominio o token ausente/inválido no degrada a demo: el catálogo SSR falla cerrado y el carrito responde 503; con `COMMERCE_SOURCE=demo`, las credenciales presentes no cambian el proveedor ni se validan al arrancar. Catálogo y carrito nunca degradan automáticamente entre ramas. `SHOPIFY_STORE_DOMAIN` debe ser el hostname `tu-tienda.myshopify.com`; el Storefront API rechaza el dominio público del sitio, `admin.shopify.com` y URLs con protocolo o ruta. `SHOPIFY_CUSTOMER_ACCOUNT_URL` es la URL alojada de Customer Accounts; no se concatena desde el dominio de la tienda y no se usa como checkout.

El gateway acepta `buyerIp` opcional y, si existe, envía `Shopify-Storefront-Buyer-IP` con una IPv4/IPv6 validada. El smoke, el preflight y las lecturas de catálogo no corresponden a tráfico de comprador y no deben inventar esa IP. Cuando una petición server-side nazca de tráfico real —carrito, checkout u otra operación dinámica— el BFF deberá pasarla. Las peticiones autenticadas no siguen redirects y no reutilizan caché HTTP. Esa IP no decide país, idioma ni moneda.

### 17.13 Contexto de mercado (España)

El mercado operativo está fijado en servidor en `SHOPIFY_MARKET_CONTEXT`: `country: ES`, `language: ES`, `currency: EUR`. No es secreto ni variable de entorno. Catálogo y carrito leen esa única definición.

Las queries Storefront de catálogo —página completa, variantes, imágenes y colecciones paginadas— se ejecutan con `@inContext(country: $country, language: $language)`. Las variables salen de la configuración; no se concatenan valores del navegador en el documento GraphQL. Un producto o colección no publicado para España no se recupera con una segunda query sin contexto: `product(handle)` nulo o ausente del catálogo contextualizado equivale a recurso inexistente (`undefined` / 404).

El mercado del carrito se fija con `buyerIdentity`, no con `@inContext` como sustituto. `cartCreate` envía `buyerIdentity: { countryCode: ES }` y, si un carrito existente tiene otro país, `cartBuyerIdentityUpdate` lo alinea. Las mutaciones comerciales también reciben el `@inContext` del mismo contexto para contenido localizado; la query técnica de cantidades de línea no lo necesita. No se envían email, `customerAccessToken` ni datos personales. El BFF `/api/cart` no admite país, idioma ni moneda en el body. El checkout usa el `checkoutUrl` del carrito remoto, sin añadir `country`, `currency` ni `language` a la URL.

`shopify:preflight` valida el catálogo bajo el mismo contexto y resume `Market: ES`, `Language: ES`, `Currency: EUR`. Un precio que no sea `EUR` hace fallar la validación. No hay selector de país, moneda o idioma, ni hreflang, ni URLs regionales mientras exista un único mercado.
