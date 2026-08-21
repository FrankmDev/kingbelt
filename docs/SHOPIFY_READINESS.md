# Preparación de KingBelt para Shopify

## 1. Estado actual

La web usa SSR en Vercel. `COMMERCE_SOURCE` es obligatoria y selecciona de forma determinista `demo` o `shopify` para catálogo y carrito a la vez. Con `demo`, solo se usan los adapters demo, `localStorage` y `/cart-catalog.json`; las credenciales Shopify presentes se ignoran. Con `shopify`, el catálogo consulta Storefront por recurso con una caché breve por instancia, acotada a 512 recursos y 15 minutos máximos de stale-if-error, y el carrito usa el BFF same-origin `/api/cart` y la Cart API. Una configuración Shopify incompleta no activa demo: las páginas de catálogo fallan cerrado y el BFF responde `503`. El webhook de catálogo puede reconstruir Vercel como respaldo.

La Storefront API está fijada en `2026-07` y usa exclusivamente el token privado. El runtime consulta y pagina el recurso solicitado —producto, colección o resúmenes—; el preflight descarga el catálogo completo, normaliza la respuesta al dominio neutral y falla cerrado si el catálogo es parcial. `bun run shopify:smoke` comprueba únicamente la conectividad mínima `shop { name }`. La barrera autoritativa antes de un despliegue Shopify es `bun run shopify:preflight`: valida configuración, autenticación, la localización Storefront activa (ES / ES / EUR), que el conjunto exacto de productos y colecciones visibles en Storefront para España coincida con el manifiesto de lanzamiento, mapping, `assertValidCatalog()` y las superficies Astro. `bun run build` solo valida la compilación: no llama a Shopify ni certifica el catálogo real.

`src/demo-catalog.ts` no es una plantilla de importación ni una definición del catálogo definitivo. Sus productos, nombres, precios, inventario, colecciones e imágenes son fixtures para probar contratos, rutas y estados. El catálogo sintético de tests verifica la escala prevista sin anticipar datos comerciales reales.

Los adaptadores demo y Shopify pasan por `assertValidCatalog()` antes de exponer datos. Las respuestas externas quedan confinadas a `infrastructure/shopify/`; páginas y componentes no conocen tipos de Shopify.

La auditoría real del 21 de agosto de 2026 confirma `cdn.shopify.com` como host exacto de imágenes y que `Product.images` ya contiene una familia propia por color con la convención `MODELO_COLOR_01/02/03`. Esa media nativa es la única autoridad de galerías. El preflight exige una sola familia y exactamente tres imágenes únicas numeradas por cada valor de Color. El runtime puede servir temporalmente una familia incompleta o, si el nombre no es resoluble, una imagen de variante que pertenezca exactamente a `Product.images`; nunca incorpora archivos externos ni reparte imágenes por posición. `ProductVariant.image` es opcional para construir la galería y no necesita coincidir con su portada. Los metafields `kingbelt.*` de copy y especificaciones pueden caer a campos nativos si aún no están visibles en Storefront. No se inventa material, ancho ni copy comercial. Un fallo transitorio de obtención sin catálogo previo no se renderiza; con uno válido, se sirve el último conocido (stale-if-error). Un error de mapping o validación falla cerrado, no usa stale y no omite el producto del listado.

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
| colecciones publicadas | 1..n, IDs existentes; una primaria exigida por `custom.kingbelt_primary_collection` | `collectionIds` y `primaryCollectionId` |
| estado de publicación del canal | 1, obligatorio | `publicationStatus`; lo no publicado falla el catálogo público |
| opción `Color` | 1 cuando el producto varía por color; valores únicos | `ProductOption` con `purpose: color` |
| opción `Talla` | 1 cuando el producto varía por talla; valores únicos | `ProductOption` con `purpose: size` |
| opciones restantes | hasta completar tres en total | `ProductOption`; más de tres falla |
| `ProductVariant.id` | 1 por variante, único | `ProductVariant.id` |
| `ProductVariant.sku` | preflight: 1 comercial, obligatorio y único; runtime: opcional | SKU de Storefront o identificador técnico estable `shopify-variant-<id>` solo para mantener operativa la ficha |
| opciones seleccionadas | exactamente una por opción y con valor existente | `optionValues`; no se generan combinaciones ausentes |
| `price` / `compareAtPrice` | precio obligatorio y comparado opcional, misma moneda | `price` / `compareAtPrice` en unidades mínimas |
| `quantityAvailable` | 0..1 según permisos; `null` significa desconocido | `inventory: known | unknown`; nunca público como cifra |
| `inventoryPolicy` y estados de venta | 1, obligatorios | `inventoryPolicy`, `salesStatus` y disponibilidad derivada |
| `quantityRule` | mínimo e incremento obligatorios; máximo opcional | `quantityRule`; inicialmente solo 1/1 es compatible |
| título y cuerpo | título y descripción obligatorios, texto saneado | `title` y `description` |
| SEO nativo | título/description opcionales | `seo`; fallback determinista a título y resumen, sin inventar copy |
| `Product.images` | con Color: una familia nativa `MODELO_COLOR_01/02/03` por valor; preflight exige exactamente tres imágenes únicas; sin Color: `mediaGroups = []` y portada de `featuredImage` | `images`, `primaryImageId`, `mediaGroups` e `imageId` de variante |

`reference`, `summary`, `badge`, material, ancho y hebilla/acabado se resuelven con los metafields `kingbelt.*` cuando están publicados para Storefront. Si aún no lo están, el importador usa campos nativos: `handle` como referencia, `description` nativa, título de colección si falta descripción y título de producto como `alt`. El catálogo completo y `shopify:preflight` exigen `ProductVariant.sku` comercial no vacío. La ficha runtime usa un identificador técnico estable derivado del GID de variante cuando falta; no se presenta como SKU comercial, se omite de JSON-LD y no hace pasar el preflight. El prefijo `shopify-variant-` está reservado para evitar colisiones con SKU comerciales. Para Color, el preflight valida las familias de filename de `Product.images`; el runtime usa exclusivamente media del mismo producto. No se inventa copy comercial, material ni medidas. No se importa coste, margen, tags administrativos ni HTML sin sanear.

### 8.1 Metafields y galerías nativas

| Propietario | Namespace / key | Tipo Shopify | Cardinalidad | Obligatorio | Fallback | Destino interno |
| --- | --- | --- | --- | --- | --- | --- |
| Product | `kingbelt.model_reference` | `single_line_text_field` | exactamente 1 | si está publicado | `handle` del producto | `Product.reference` |
| Product | `kingbelt.summary` | `multi_line_text_field` | exactamente 1 | si está publicado | `description` nativa | `Product.summary` |
| Product | `kingbelt.material` | `single_line_text_field` | exactamente 1 | si está publicado | se omite la especificación | `specifications[Material]` |
| Product | `kingbelt.width_mm` | `number_integer` | exactamente 1, positivo | si está publicado | se omite la especificación | `specifications[Ancho]` |
| Product | `kingbelt.buckle_finish` | `single_line_text_field` | exactamente 1 | si está publicado | se omite la especificación | `specifications[Hebilla/acabado]` |
| Product | `kingbelt.badge` | `single_line_text_field` | 0..1 | no | se omite | `Product.badge` |
| Product | `custom.kingbelt_primary_collection` | `collection_reference` | exactamente 1 | sí | ninguno | `Product.primaryCollectionId` |

Los metafields de producto se consultan juntos en la ficha completa: `kingbelt.*` más `custom.kingbelt_primary_collection`. Copy, especificaciones y distintivo pueden caer a campos nativos de §8 si aún no están visibles en Storefront. `custom.kingbelt_primary_collection` es la autoridad de colección principal: debe ser una referencia Storefront a Collection, pertenecer a `product.collections` y no depende del orden en que Shopify las devuelva. Preflight y runtime fallan si no llega; no hay fallback a una colección asignada. Las galerías no consultan metafields ni metaobjects y, por tanto, no necesitan el scope `unauthenticated_read_metaobjects`. Un producto sin opción Color conserva `mediaGroups = []`. Las queries de `ProductSummary` no descargan las tres imágenes de cada color.

Convención de archivos para un producto con Color:

```txt
MODELO_COLOR_01.jpg  → portada
MODELO_COLOR_02.jpg  → detalle
MODELO_COLOR_03.jpg  → contexto
```

La extensión puede ser JPG, PNG, WebP, AVIF o GIF y Shopify puede añadir un UUID después del número. El nombre se normaliza sin tildes, mayúsculas ni separadores; el color debe ocupar el sufijo completo de la familia para que `Cuero` no coincida con `Cuero oscuro`. El preflight rechaza familias ausentes, duplicadas, ambiguas, incompletas o con una secuencia distinta de `01/02/03`.

Definición esperada de la colección principal (no se crea desde el frontend ni con Admin API):

```txt
Owner: Product
Namespace: custom
Key: kingbelt_primary_collection
Type: collection_reference
Cardinality: single
Required: yes for every published KingBelt product
Storefront access: Read / PUBLIC_READ
Fallback: none
```

## 9. Decisiones empresariales pendientes

Faltan confirmar catálogo definitivo, precios, reglas de stock, taxonomía de colecciones, categoría oficial, materiales, anchos, hebillas, textos SEO, política de imágenes y credenciales autorizadas. Checkout, envío, impuestos, pagos y notificaciones los configura Shopify Admin; el código no los simula. El mercado operativo actual es España (`ES` / `ES` / `EUR`); multi-market y multi-currency siguen fuera de alcance. El coste nunca formará parte del dominio público.

En particular, siguen pendientes el umbral de «pocas unidades» y si se expondrán cifras exactas de inventario. Sus defaults de demo están aislados en `src/commerce/domain/commerce-rules.ts`; no se convertirán en configuración de Shopify ni en copy público definitivo sin confirmación.

## 9.1. Autoridad de disponibilidad al conectar Shopify

La autoridad depende del momento del flujo:

- En ficha y selección de variante, el adaptador normalizará la variante publicada para el canal a partir de `availableForSale`, `currentlyNotInStock`, `quantityAvailable` cuando esté accesible y `quantityRule { minimum, increment, maximum }`. `quantityAvailable: null`, no solicitado o no autorizado se normaliza como inventario `unknown`; nunca como una cifra ficticia. `currentlyNotInStock` permite representar una variante comprable sin stock. Consulta el contrato vigente de [`ProductVariant`](https://shopify.dev/docs/api/storefront/latest/objects/productvariant) y [`QuantityRule`](https://shopify.dev/docs/api/storefront/latest/objects/quantityrule) de la versión fijada al implementar.
- Después de crear, añadir, actualizar o eliminar líneas, el `Cart` retornado por Shopify es la autoridad absoluta: KingBelt no reconstruye cantidades pedidas por el navegador ni el estado local previo. Las mutaciones consultan `cart`, `userErrors { field message code }` y `warnings { code message target }`. `CartUserError.code` (`CartErrorCode`) bloquea la operación correspondiente; `CartWarning.code` (`CartWarningCode`) representa un ajuste automático o una incidencia no bloqueante y no convierte `success` en `false`. El estado adoptado es siempre `payload.cart`. `cart = null` en una mutación sin error explícito es un error de proveedor, no un carrito vacío exitoso. Consulta [`cartLinesAdd`](https://shopify.dev/docs/api/storefront/latest/mutations/cartLinesAdd) y [`CartWarning`](https://shopify.dev/docs/api/storefront/latest/objects/CartWarning).
- La disponibilidad de cada línea del carrito se deriva del `ProductVariant` embebido (`availableForSale`, `currentlyNotInStock`, `quantityRule { minimum, increment, maximum }`), no de valores fijos. No se inventa `inventoryPolicy` ni stock exacto en Cart: `quantityKnown` permanece `false` hasta conceder e importar `quantityAvailable`. `currentlyNotInStock` con `availableForSale` permite comprar en backorder. Una línea no comprable o una cantidad fuera de `quantityRule` bloquea `canCheckout`; un `severity: notice` no lo hace.
- El click de checkout realiza una única lectura autoritativa del Cart remoto en el servidor. Solo un carrito con líneas comprables, cantidades válidas, sin errores bloqueantes y con `Cart.checkoutUrl` válida (host y HTTPS) habilita la redirección. Consulta el contrato de [`Cart`](https://shopify.dev/docs/api/storefront/latest/objects/cart).
- Solo el carrito demo guarda IDs y cantidades solicitadas en `localStorage`. En Shopify, el DOM, cualquier snapshot y cualquier cantidad enviada por el navegador son datos no confiables; el carrito remoto y la sesión server-side de Astro son autoritativos (`browser → opaque session cookie → Astro session store → Shopify cartId`).

Una variante «eliminada» se representa como no disponible y bloquea checkout mientras Shopify conserve la línea; el comprador puede retirarla. Si Shopify ya la ha quitado, el Cart retornado es la autoridad. Una variante que todavía se resuelve pero no puede venderse se conserva igual y bloquea checkout. Si la Storefront API elegida no permite distinguir ambos casos para una variante no publicada, el adaptador no inventará la causa: usará el estado seguro no comprable y la respuesta del carrito remoto como decisión final.

Cart recovery policy:

- missing remote Cart during add → create a new Cart for the newly requested item;
- missing remote Cart during refresh/update/remove/checkout → clear stale session as appropriate;
- transient network/provider failures never clear the session;
- unavailable lines remain visible and block checkout until removed;
- Shopify warnings use the returned Cart as authority.

## 10. Categorías y colecciones

Las categorías públicas se modelan como colecciones. Una colección destacada ordena la portada, pero el layout acepta entre tres y seis sin asumir dos secundarias exactas. Debe decidirse qué colecciones son manuales o automáticas antes de importar.

## 11. Estrategia inequívoca de imágenes

`Product.images` es la única fuente autoritativa. Para cada valor de `Color`, el mapper busca exactamente una familia cuyo nombre termine en el color normalizado y la ordena por sufijo numérico. El preflight exige exactamente tres imágenes únicas `01`, `02` y `03`; `01` se convierte en la portada interna del color. `ProductVariant.image` no necesita coincidir con esa portada y puede estar ausente: Shopify la define como una asociación de variante, no como autoridad de nuestra galería personalizada. El mapper conserva el ID de imagen legítimo si llega, pero proyecta `ProductVariant.imageId` a la portada resuelta de su color para mantener un dominio interno coherente.

La ficha no reparte `Product.images` por posición, orden global ni huecos entre portadas y nunca copia media de otro producto. En runtime, una familia inequívoca puede mostrarse aunque esté temporalmente incompleta; si no existe una familia nombrada, solo puede usarse la imagen de variante cuando coincide por ID o URL absoluta con una imagen del mismo producto. Si no hay relación segura, falla cerrado. Un producto sin opción Color conserva `mediaGroups = []` y su imagen principal sale de `featuredImage`. Cada archivo debe tener un GID Shopify de imagen estructuralmente válido, URL permitida, `alt` no vacío y dimensiones positivas conocidas. Los metaobjects heredados de galería no se consultan y nunca pueden incorporar media de otro producto.

## 12. Filtros

La selección, el predicado y la serialización URL viven en `commerce/domain/catalog-filters.ts` y los comparten build, navegador y adaptadores. La selección (`CatalogFilterSelection`) usa tipo, colores normalizados, un rango de precio declarativo y disjunto sobre el precio de entrada, y disponibilidad. La URL transporta esa selección (`tipo`, `color`, `precio`, `disponible`) para enlazar estados y conservarlos al volver atrás o recargar.

El controlador cliente aplica el mismo predicado del dominio y revela la colección por páginas con «Mostrar más». El adaptador Shopify consulta la colección y sus resúmenes de producto (caché breve por instancia) y devuelve `CollectionPage`; los componentes no cambian. Traducir filtros a Search & Discovery remoto queda fuera de esta activación.

## 13. SEO

El SEO consume el dominio neutral. La ficha genera `Product`, marca, imágenes, referencia comercial como `mpn`, canonical, disponibilidad derivada y una sola oferta o `AggregateOffer`; no confunde la referencia de producto con un SKU de variante ni genera un `Offer` por variante.

## 14. Pasos exactos para activar Shopify

1. Declarar `COMMERCE_SOURCE=shopify` explícitamente en el entorno correspondiente.
2. Completar las descripciones de `casual`, `sport` y `vestir`.
3. Configurar `custom.kingbelt_primary_collection` en cada producto publicado y habilitar su lectura Storefront.
4. Añadir alt contextual y mantener en `Product.images` una familia `MODELO_COLOR_01/02/03` por cada valor de Color; completar también los SKU comerciales pendientes. Mientras un producto no esté listo, retirarlo del canal Headless en vez de depender de un filtro local.
5. En Shopify Admin → Sales channels → Headless, abrir el storefront usado por producción. Ese canal debe tener como mínimo `unauthenticated_read_product_listings`, `unauthenticated_read_checkouts` y `unauthenticated_write_checkouts`. `unauthenticated_read_product_inventory` solo es necesario si se activa inventario exacto en Storefront (`quantityAvailable`); el código actual no lo consulta y conserva inventario `unknown`. Los productos y colecciones del manifiesto de preflight deben estar publicados en ese Headless storefront y disponibles en el mercado España.
6. En entornos confiables con `COMMERCE_SOURCE=shopify`, definir el conjunto exacto esperado (`SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES` y `SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES`, CSV de handles, ambas obligatorias) y ejecutar `bun run launch:preflight` (o `bun run session:preflight` y después `COMMERCE_SOURCE=shopify bun run shopify:preflight`) y luego `bun run build`. El preflight de sesión valida PING/SET/GET/TTL/DELETE contra una clave efímera propia. El preflight Shopify valida configuración, el manifiesto exacto contra Storefront ES y el contrato de dominio. El build solo compila. No usar el job `quality` de Pull Requests ni `COMMERCE_SOURCE=demo` como demostración de que Shopify o Upstash están listos. Storefront no informa de productos invisibles para ese canal o mercado: el manifiesto es el contrato externo del preflight y no hace falta Admin API. Si falta un handle esperado, comprobar Shopify Admin → Products → Publishing / Sales channels → Headless, y Markets → España. Estas variables no se leen en runtime, no filtran el catálogo y no entran en `astro:env`.

Secuencia operativa de un deployment Shopify:

```sh
bun install --frozen-lockfile
COMMERCE_SOURCE=shopify bun run launch:preflight
bun run build
```

`shopify:preflight` es read-only: no crea carritos, no llama Admin API y no dispara deploy hooks. Exige el conjunto exacto de `SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES` y `SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES` frente a lo que Storefront devuelve para España; un producto o colección de más o de menos hace fallar el comando. Mapea todos los productos antes de detenerse y reporta hasta diez fallos por ejecución; si el mapping individual pasa, conserva la validación global de relaciones y unicidad. `shopify:smoke` sigue siendo solo conectividad `shop { name }`. `shopify:cart-smoke` es un segundo comando explícito contra un deployment real y sí muta un Cart piloto hasta `checkoutUrl`, sin pagar ni crear un Order. `session:preflight` no inspecciona sesiones de clientes ni usa `SCAN`/`KEYS`/`FLUSHDB`.

Checklist operativo por cada producto del manifiesto:

- [ ] Status activo/publicable.
- [ ] Publicado en el Headless storefront correcto.
- [ ] Disponible en mercado España.
- [ ] Title configurado.
- [ ] Description configurada.
- [ ] Vendor configurado.
- [ ] Product type configurado.
- [ ] Shopify Product Category configurada.
- [ ] Pertenece al menos a una Collection.
- [ ] `custom.kingbelt_primary_collection` configurada.
- [ ] Todas las variantes tienen SKU único.
- [ ] Precio correcto.
- [ ] Opciones Color/Talla correctas.
- [ ] Si tiene Color: una única familia nativa `MODELO_COLOR_01/02/03` por valor.
- [ ] `Variant image` opcionalmente configurada para Shopify; no necesita coincidir con la portada interna.
- [ ] Galerías contienen exactamente 3 MediaImage.
- [ ] Producto puede resolverse mediante su handle.

Checklist operativo por cada Collection esperada:

- [ ] Publicada/visible para el storefront correspondiente.
- [ ] Handle definitivo.
- [ ] Title.
- [ ] Description.
- [ ] Image si se pretende mostrar visualmente.
7. Mantener desplegado el adapter de Vercel, el BFF same-origin para carrito y Redis/KV persistente (Upstash) para el store de sesiones de Astro. En Vercel no hay fallback a filesystem ni memoria.
8. Configurar **ambas** `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en Production y Preview. El session driver las lee en runtime; un cambio exige nuevo deployment. Preferible bases Upstash distintas. El navegador solo recibe la cookie opaca `__Host-kingbelt-session`; el Cart ID completo vive en el session store.
9. Ejecutar pruebas de variantes, carrito, checkout, seguridad y validación visual.
10. Configurar `SHOPIFY_WEBHOOK_SECRET`, `VERCEL_DEPLOY_HOOK_URL` y los webhooks de catálogo hacia `/api/shopify-catalog-rebuild` como respaldo opcional (el catálogo ya se actualiza solo vía SSR).
11. Verificar checkout, secretos, CSP/cabeceras y rollback explícito antes de publicar.

El flujo de carrito queda fijado: BFF same-origin. Ningún token Storefront se expone al navegador. La versión API debe fijarse explícitamente y nunca ser `latest`.

`COMMERCE_SOURCE` se configura en las variables de entorno de cada deployment, no en `vercel.json`. Local y Preview de PR no conectados a staging usan `COMMERCE_SOURCE=demo` sin credenciales de producción. Staging y Production usan `COMMERCE_SOURCE=shopify` con secretos exclusivos de cada tienda. El valor no se deriva de `VERCEL_ENV`, hostname, rama ni credenciales.

## 15. Vuelta temporal al adaptador demo

Mantener `src/demo-catalog.ts` y `commerce/infrastructure/demo/` mientras dure la transición. Ante una incidencia, declarar `COMMERCE_SOURCE=demo` y hacer redeploy/restart; para volver a Shopify, declarar `COMMERCE_SOURCE=shopify` y repetir el despliegue. La reversión es auditable y no exige cambiar código, páginas ni componentes.

## 16. Cuentas de cliente

La integración de lanzamiento es **Shopify-hosted Customer Accounts**. KingBelt no implementa autenticación propia, Customer Account API, OAuth, perfil, pedidos ni direcciones. No hay passwords propios, registro propio, tabla de usuarios, sesiones de usuario, JWT, ni Storefront `customerCreate` / `customerAccessToken*`.

Con las Customer Accounts actuales no hay un paso separado obligatorio de «crear cuenta». El comprador introduce email, Shopify envía un código, y:

- si el Customer existe, entra en esa cuenta;
- si no existe, Shopify crea el perfil automáticamente.

El CTA público es **Mi cuenta**. Desktop y móvil apuntan a la ruta estable `/cuenta/iniciar`. En Shopify esa ruta hace redirect server-side **307** a `SHOPIFY_CUSTOMER_ACCOUNT_URL`; en demo renderiza un panel visual que no autentica. Si la URL falta o es inválida: el CTA se desactiva y `/cuenta/iniciar` responde 503 `no-store`. No hay fallback silencioso al panel demo.

`SHOPIFY_CUSTOMER_ACCOUNT_URL` es `astro:env` de servidor público (`context: server`, `access: public`). No es un secreto y no se marca `PUBLIC_*`. No se construye concatenando `SHOPIFY_STORE_DOMAIN` + `/account`. El valor identificado de esta tienda (`https://shopify.com/106425811284/account`) se verifica a mano; la autoridad en runtime es la env. El preflight exige que esté presente y sea HTTPS válido; no hace login, OTP ni Admin API. Obligatoria en Production y en Preview cuando `COMMERCE_SOURCE=shopify`. No va en `vercel.json`. Tras cambiarla: nuevo deployment.

KingBelt no inspecciona si el usuario está autenticado en Customer Accounts (`isLoggedIn`, cookies cruzadas, `localStorage`). El CTA sigue siendo «Mi cuenta» conectado o no. Logout, pedidos, perfil, direcciones y métodos guardados los sirve el portal alojado. No hay `/cuenta/perfil`, `/addresses` ni `/orders` en Astro.

`locale` / `region_country` de la documentación headless aplican al authorization endpoint de Customer Account API. El enfoque hosted no los añade; España/Español se configuran en Admin. Autofill de checkout para un comprador ya autenticado no está cableado: el Cart no lleva `customerAccessToken`. Se verifica en el bloque de checkout.

Customer Account es opcional: el frontend no exige login para añadir al carrito, ver el carrito ni ir a checkout.

Checkout, Thank You y Order Status los sirve Shopify desde `checkoutUrl`. No hay `SHOPIFY_CHECKOUT_URL` ni páginas Astro equivalentes. El gate Admin —incluidas Thank You / Order Status no-legacy— está en [`SHOPIFY_LAUNCH_OPERATIONS.md`](SHOPIFY_LAUNCH_OPERATIONS.md).

La arquitectura de Customer Account API con BFF y sesión propia sigue documentada en [`plans/2026-08-06-shopify-customer-accounts-design.md`](plans/2026-08-06-shopify-customer-accounts-design.md) como opción **post-lanzamiento**, no como requisito de esta integración hosted.

## 17. Decisiones de arquitectura de la integración

Este apartado fija las decisiones de la integración. La lectura de catálogo, el carrito BFF, el runtime SSR y el enlace a Customer Accounts alojadas están implementados; Customer Account API, perfil y pedidos propios quedan post-lanzamiento (§16).

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
| Acceso a cuenta (alojado) | `commerce-navigation` + `SHOPIFY_CUSTOMER_ACCOUNT_URL` | Header y menú móvil → `/cuenta/iniciar` → Customer Accounts |
| Cuenta de cliente (API) | puerto `CustomerAccountProvider` futuro en `application/` | §16 y plan en `plans/`; no implementado |

Regla general: las respuestas GraphQL y los tipos de Shopify viven exclusivamente en `infrastructure/shopify/`. La carpeta contiene configuración, gateway genérico, frontera `astro:env`, query paginada, mapper y adapter de catálogo. Páginas, componentes y scripts consumen solo los composition roots `@commerce/catalog`, `@commerce/cart` y `@commerce/commerce-navigation` o contratos de `application`/`domain`. Todo el árbol Shopify es ahora alcanzable desde el composition root real, por lo que `tests/architecture.test.mjs` ya no necesita una excepción temporal de reachability.

### 17.2 Datos de build y datos en tiempo real

El runtime SSR consulta únicamente el recurso necesario —producto, colección, handles o resúmenes— y comparte una caché breve por clave. La descarga completa del catálogo, con variantes, imágenes, grupos de medios, especificaciones, SEO y pertenencias, queda reservada al preflight. El sitio no consulta Shopify desde el navegador.

En tiempo real el navegador solo envía al BFF identificadores públicos, cantidades y comandos permitidos. El flujo de persistencia es `browser → opaque session cookie → Astro session store → Shopify cartId`. La cookie `HttpOnly` contiene únicamente un identificador de sesión aleatorio; la parte secreta del identificador de carrito Shopify no entra en HTML, JavaScript, almacenamiento, JSON público ni cookies decodificables. El servicio servidor crea o recupera el carrito, muta líneas y obtiene checkout. Después de cada operación devuelve una proyección neutral reconstruida desde la respuesta remota (§9.1), nunca desde `localStorage` ni desde el snapshot de ficha. La tienda no muta el catálogo desde el cliente.

Checklist de persistencia en staging: ventana normal → añadir producto → recargar → otro path → reabrir pestaña → mismo carrito; incógnito → carrito independiente. DevTools debe mostrar `__Host-kingbelt-session` (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`) cuyo valor no contiene `gid://shopify/Cart/`. Las respuestas de la web y `/api/cart` tampoco. Upstash debe mostrar actividad con TTL bajo el namespace de sesión; no inspeccionar ni publicar el valor.

El servidor es autoridad para carrito remoto, precios, cantidades aceptadas, stock, identidad del comprador, checkout, `userErrors` y `warnings`. No devuelve credenciales, respuesta GraphQL completa, identidad sensible ni campos administrativos.

### 17.3 Paginación de productos, variantes e imágenes

La paginación es una preocupación interna del adaptador de importación, no del contrato público: `CatalogProvider` devuelve conjuntos completos y las páginas no pagan.

- Productos y colecciones: connections con `first: 250` y cursor (`pageInfo.hasNextPage` / `endCursor`) en bucle hasta agotar; el Storefront API no admite más de 250 por página.
- Pertenencia producto → colección: `Product.collections(first: 250)` por producto, paginado si excede; rellena `Product.collectionIds`.
- Variantes e imágenes de cada producto: `Product.variants(first: 250)` y `Product.images(first: 250)` con su propio cursor si el producto los supera.
- Los `ProductSummary` no consultan `product.collections`: su colección primaria sale exclusivamente de `custom.kingbelt_primary_collection.reference`, evitando una conexión que no forma parte de la tarjeta.
- El recorrido guarda cada producto por handle/id una sola vez; no se reconsulta un nodo ya leído. Si el coste de query del store exigiera bajar `first`, se ajusta en la constante del adaptador, no con un valor distinto por request.

### 17.4 Transformación al dominio interno

La normalización vive en `catalog-mappers.ts` y no conoce página ni componente:

- `MoneyV2 { amount, currencyCode }` → `moneyFromDecimal(amount, currencyCode)`; nunca aritmética de coma flotante.
- IDs opacos `gid://shopify/...` → `productId()` / `variantId()` tal cual.
- `options` → `ProductOption`; `purpose` solo cuando el nombre coincide con los conocidos (Color→color, Talla/Tamaño→size). `swatch` solo si el origen lo expone.
- `selectedOptions` de variante → `OptionSelection[]` contra valores existentes; las combinaciones no declaradas no producen variante (§5).
- Inventario y política según §9.1: `availableForSale`, `currentlyNotInStock`, `quantityAvailable` (cuando esté autorizado) y `quantityRule { minimum, increment, maximum }` → `inventory`, `inventoryPolicy`, `salesStatus` y `quantityRule`. Un mínimo/incremento distinto de 1/1 falla explícitamente hasta que todas las capas amplíen su política.
- Imágenes: una sola vez en `Product.images`. Con opción Color, el catálogo completo y preflight exigen una familia nativa `MODELO_COLOR_01/02/03` por valor; la ficha runtime solo utiliza media propia segura (§11). `primaryImageId` y `variant.imageId` apuntan a la portada resuelta de su color. Sin opción Color, `mediaGroups = []` y la imagen principal sale de `featuredImage`. El host real `cdn.shopify.com` está autorizado de forma exacta en `imagePolicy.transformableHosts`, `publicSecurityConfig.remoteImageHosts` y CSP; no se usan comodines. El render aplica `width`/`height`, `srcset`, `sizes` y `loading`/`fetchpriority` sin JavaScript de cliente.
- `descriptionHtml` se sanea a texto plano antes de usarse en ficha y meta.

### 17.5 Validación antes del uso

Tras normalizar el catálogo completo, el adaptador ejecuta `assertValidCatalog()` con las monedas de `SHOPIFY_MARKET_CONTEXT` (`EUR`): la misma frontera que ya ejecuta la demo. Un `CatalogValidationError` no hace fallar `bun run build`: el build es una compilación reproducible y no consulta Shopify. En runtime, cada `ProductSummary` se valida antes de exponerse; un producto inválido hace fallar el recurso y no se elimina del listado. Mapping y validación son fail-closed y no sirven stale; un fallo transitorio del proveedor puede reutilizar la última respuesta válida del mismo recurso (stale-if-error). La barrera previa al deploy es `bun run shopify:preflight`: primero comprueba la localización activa de Storefront y, solo si España / español / EUR coinciden, carga el catálogo real bajo el mismo `@inContext(country: ES, language: ES)`, exige el manifiesto exacto, lo mapea y exige que `assertValidCatalog()` pase. En carrito, `CartErrorCode` de `userErrors` se traduce a `CartOperationErrorCode` y `CartWarningCode` a avisos de dominio; nunca se clasifican errores o warnings buscando palabras en `message` (§9.1).

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

- Fail-closed en runtime: un producto que Shopify devuelve debe cumplir el contrato de `ProductSummary` antes de exponerse; si el mapping o la validación fallan, la operación rechaza y el producto no desaparece del listado. Los errores de configuración (`ShopifyConfigurationError`: faltan o son inválidos `SHOPIFY_STORE_DOMAIN` o `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`) también fallan cerrado, registran un diagnóstico sin secretos y no sirven un catálogo vacío. La página no se renderiza vacía ni corrupta; el despliegue anterior de Vercel sigue publicando el sitio.
- Stale-if-error: solo para fallos transitorios del proveedor (timeout, red, HTTP 5xx, 429) cuando ya hay una respuesta válida del mismo recurso. Mapping, validación y configuración no reutilizan stale.
- El adaptador no degrada a un «catálogo vacío» silencioso por una respuesta parcial de Storefront ni por configuración inválida: un producto o colección inexistente (`null`) se traduce a `undefined`; un producto presente e inválido, o un fallo de API o de configuración, se propaga.
- En el navegador, un fallo del carrito Shopify conserva el último estado válido o expone un error temporal; nunca activa el adapter demo, `localStorage`, `/cart-catalog.json` ni un checkout ficticio.
- El rollback al adaptador demo (§17.10) es la vía operativa rápida y no exige cambios de UI.

### 17.12 Gateway GraphQL servidor ligero (sin SDK)

Existe un gateway propio exclusivamente servidor en `infrastructure/shopify/` con `fetch`, versión `2026-07`, autenticación privada, timeout y una función `graphql()` genérica y tipada. Distingue fallos HTTP, JSON inválido y errores GraphQL sin devolver respuestas parciales ni registrar cuerpos o credenciales. No usa Hydrogen ni SDK adicional y no conoce el dominio; las queries de catálogo viven separadas en `catalog-query.ts`.

`COMMERCE_SOURCE` es `client/public` y selecciona el proveedor sin contener secretos. `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_API_VERSION` y `SHOPIFY_CUSTOMER_ACCOUNT_URL` son variables `server/public`; `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` y `VERCEL_DEPLOY_HOOK_URL` son `server/secret`. El store de sesiones usa `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en runtime, fuera de `astro:env`; el driver las lee desde `process.env` en su entrypoint, no desde configuración serializable de Astro. Production y Preview necesitan las dos. Con `COMMERCE_SOURCE=shopify`, un dominio o token ausente/inválido no degrada a demo: el catálogo SSR falla cerrado y el carrito responde 503; con `COMMERCE_SOURCE=demo`, las credenciales presentes no cambian el proveedor ni se validan al arrancar. Catálogo y carrito nunca degradan automáticamente entre ramas. `SHOPIFY_STORE_DOMAIN` debe ser el hostname `tu-tienda.myshopify.com`; el Storefront API rechaza el dominio público del sitio, `admin.shopify.com` y URLs con protocolo o ruta. `SHOPIFY_CUSTOMER_ACCOUNT_URL` es la URL alojada de Customer Accounts; no se concatena desde el dominio de la tienda y no se usa como checkout.

El gateway acepta `buyerIp` opcional para tráfico de fondo. Toda petición Storefront provocada por una request SSR real —páginas de catálogo, sitemap commerce, carrito y checkout— envía `Shopify-Storefront-Buyer-IP` desde `Astro.clientAddress` / `context.clientAddress`. El smoke, el preflight y el build omiten ese header: no representan a un comprador y no deben inventar una IP. La IP no se persiste, no entra en el dominio ni en las claves de caché, y no decide país, idioma ni moneda. Las peticiones autenticadas no siguen redirects y no reutilizan caché HTTP.

### 17.13 Contexto de mercado (España)

Mercado de lanzamiento:

- Country: Spain (ES)
- Currency: EUR
- Language: Spanish (ES)

Shopify Admin:

1. Markets → España debe estar activo.
2. EUR debe ser la moneda aplicable al mercado.
3. Español debe estar publicado/disponible para España.
4. Productos del manifiesto deben estar disponibles para España.
5. El Headless storefront debe poder consultar ese contexto.

El mercado operativo está fijado en servidor en `SHOPIFY_MARKET_CONTEXT`: `country: ES`, `language: ES`, `currency: EUR`. No es secreto ni variable de entorno. Catálogo y carrito leen esa única definición. No hay geolocalización, `Accept-Language` ni selector de país/moneda.

`@inContext(country, language)` aplica al catálogo y a las queries Storefront normales (incluido el preflight). Determina qué productos, precios e idioma de catálogo ve el storefront para España.

`CartBuyerIdentity.countryCode` es la autoridad del país del Cart: pricing internacional y checkout. No es equivalente a `@inContext(country)`. `cartCreate` envía `buyerIdentity: { countryCode: ES }` y, si un carrito existente tiene otro país, `cartBuyerIdentityUpdate` lo alinea una sola vez. Las operaciones de Cart que devuelven `CART_FIELDS` usan `@inContext(language: ES)` para títulos y opciones traducibles; no envían `country` por `@inContext`. La query técnica de cantidades de línea no usa `@inContext`.

El mapper del Cart exige `buyerIdentity.countryCode = ES` y que todos los `MoneyV2` (`subtotal` y costes de línea) sean `EUR` antes de traducir al dominio. Una moneda incorrecta no se degrada a línea unavailable: falla el mapping completo. El checkout usa el `checkoutUrl` de ese Cart ya contextualizado, sin añadir `country`, `currency` ni `language` a la URL.

No se envían email, `customerAccessToken` ni datos personales. El BFF `/api/cart` no admite país, idioma ni moneda en el body. Un error de mercado o de proveedor responde error genérico y no borra `shopifyCartId`.

`shopify:preflight` consulta `shop` y `localization` en una sola query Storefront con el mismo `@inContext(country: ES, language: ES)`. Solo certifica el mercado después de comprobar que Storefront ha activado país ES, idioma ES, EUR y español entre los idiomas disponibles. Un fallo de localización no descarga el catálogo. El resumen `Market: ES` / `Language: ES` / `Currency: EUR` significa contexto verificado, no constantes locales. El catálogo se valida después con `SHOPIFY_SUPPORTED_CURRENCIES = ['EUR']`. El preflight es la comprobación autoritativa; no hay query `localization` en el runtime de páginas ni de `/api/cart`.

No hay selector de país, moneda o idioma, ni hreflang, ni URLs regionales mientras exista un único mercado. Customer Accounts se resuelve en §16. Shipping, taxes, payments, notifications y Thank You / Order Status se verifican en Shopify Admin según [`SHOPIFY_LAUNCH_OPERATIONS.md`](SHOPIFY_LAUNCH_OPERATIONS.md); este bloque de mercado no los certifica.

## 18. Operational launch gate

Barreras. Ninguna sustituye a las otras.

1. `bun run shopify:preflight` — Storefront: config, auth, market ES / ES / EUR, manifiesto y mapping. No certifica envío, impuestos, pagos ni emails.
2. `bun run shopify:cart-smoke` — deployment real + BFF `/api/cart` + Cart API hasta `checkoutUrl`. No certifica pago ni Order.
3. `bun run shopify:release-gate` — orquesta validate + session + preflight + cart smoke + HTTP del deployment. Si pasa: `AUTOMATED PRE-PAYMENT GATE: PASSED` y `PAYMENT QA READINESS: BLOCKED`. No certifica Admin ni pagos.
4. [`SHOPIFY_LAUNCH_OPERATIONS.md`](SHOPIFY_LAUNCH_OPERATIONS.md) — Shopify Admin: checkout, cuentas, envío, tax, pagos, notificaciones, fulfillment, políticas, Thank You / Order Status.
5. Pedido de prueba (después) — tarifa, tax, pago, pedido, email e inventario.

`bun run validate` = código. `bun run session:preflight` = Upstash. `bun run shopify:cart-smoke` = carrito real sin pedido. `bun run shopify:release-gate` = gate único pre-pagos. Sin flags `*_READY` y sin Admin API.
