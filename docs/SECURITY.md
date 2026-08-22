# Seguridad antes de integrar servicios externos

Estado: la fuente de comercio se declara explícitamente con `COMMERCE_SOURCE=demo|shopify`. Demo usa catálogo local, `localStorage` y `/cart-catalog.json`; Shopify usa Storefront, el BFF `/api/cart`, la Cart API y checkout remoto sin exponer tokens al navegador.

## Límites de confianza

- El navegador no es autoridad para precio, stock, identidad de producto, descuentos, comprador, país, idioma, moneda ni posibilidad de checkout. Solo puede proponer `variantId` y cantidad; el servidor reconcilia el Cart autoritativo en la misma operación de checkout.
- El contrato cliente de carrito/checkout no transporta access tokens ni identidad autenticada. Customer Accounts está alojada por Shopify (`SHOPIFY_CUSTOMER_ACCOUNT_URL`); KingBelt no almacena customer tokens, contraseñas, OTP, email de cliente ni OAuth, no inspecciona la sesión de cuentas y no registra esos datos. Una Customer Account API futura, si se implementa, mantendrá sesión y tokens solo en servidor detrás de una cookie `HttpOnly`.
- Solo en modo demo, `localStorage` contiene exclusivamente versión, `variantId` y cantidad, con límites de tamaño, líneas, longitud y cantidad. No se guardan tokens, email, nombre, direcciones, precios ni respuestas completas. No se usa `sessionStorage`. El snapshot `/cart-catalog.json` es una proyección pública del catálogo demo ya emitido en las fichas; no incluye secretos ni campos administrativos y responde 404 en modo Shopify.
- El catálogo externo debe normalizarse y pasar `assertValidCatalog()` antes de llegar a páginas o componentes. Sus campos son texto plano: el HTML del proveedor se rechaza. Si en el futuro se necesitara rich text, deberá sanitizarse en servidor con una allowlist explícita y nunca pasarse directamente a `set:html`.
- El JSON incrustado se serializa con `serializeJsonForHtml()`, que escapa `<`, `>`, `&`, U+2028 y U+2029. Los atributos `data-*` solo contienen IDs, estados o proyecciones públicas; nunca secretos ni objetos administrativos.
- Las imágenes del catálogo solo pueden usar rutas raíz o HTTPS hacia hosts exactos declarados en `publicSecurityConfig.remoteImageHosts`. No se aceptan comodines, credenciales, HTTP, puertos alternativos ni coincidencias por sufijo.

## Variables y secretos

- `COMMERCE_SOURCE` es pública, obligatoria y solo acepta `demo` o `shopify`; no contiene secretos. Se configura en las variables de entorno de cada deployment, nunca en `vercel.json`, y no se infiere de `VERCEL_ENV`, hostname, rama ni tokens. Selecciona a la vez catálogo y carrito. Local y Preview no conectados a staging usan `demo` sin secretos Shopify. Staging y Production usan `shopify` con credenciales exclusivas de cada entorno. Dominio, versión y token privado solo validan la rama Shopify y nunca la activan automáticamente. Si faltan o son inválidos, Shopify no degrada a demo: el catálogo SSR falla cerrado y el BFF de carrito responde 503. `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_API_VERSION` y `SHOPIFY_CUSTOMER_ACCOUNT_URL` son `server/public`. `SHOPIFY_CUSTOMER_ACCOUNT_URL` es la URL alojada de Customer Accounts configurada en Shopify; no es un secreto, no se concatena desde el dominio de la tienda y no se usa como checkout. `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` y `VERCEL_DEPLOY_HOOK_URL` son `server/secret` y no entran en el bundle cliente. `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` se leen en runtime desde `process.env` en el session driver; no entran en `astro:env`, `astro:env/client` ni en el bundle. En Vercel (Production y Preview) deben existir las dos; una sola, con espacios, saltos de línea o HTTP, falla cerrado. No se copian al build ni a `.env.production` en el repositorio. Tras crear, cambiar o rotar cualquiera, hay que redesplegar.
- Un nombre `PUBLIC_*` se considera parte del bundle y del HTML público. No puede contener secretos, tokens Admin, tokens Storefront, contraseñas ni credenciales privadas. El carrito Shopify usa siempre el BFF same-origin; el navegador no necesita un token del proveedor.
- Los secretos privados se leen únicamente desde una frontera servidor mediante `astro:env/server`. En modo Shopify, el runtime SSR usa el token privado en cada ciclo de caché para consultar el catálogo: el secreto vive solo en el entorno del servidor y no entra en el HTML, los assets ni el bundle cliente. Las operaciones de carrito pasan por el BFF same-origin. El flujo de persistencia es `browser → opaque session cookie → Astro session store → Shopify cartId`. La cookie de sesión es opaca (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, prefijo `__Host-`, sin `Domain`); el Cart ID completo existe solo en el store Redis/KV server-side. Si `session.get` no puede leer el store, `/api/cart` responde 503: no se crea otro carrito ni se degrada a disco, memoria o cookie.

- La caché anónima de catálogo está limitada a 512 recursos por instancia. Una respuesta anterior solo se reutiliza tras errores transitorios y durante un máximo de 15 minutos; mapping, validación y configuración nunca usan stale. Esto limita memoria y evita mantener indefinidamente contenido obsoleto durante una caída prolongada. Los identificadores Shopify tienen límite de longitud y rechazan caracteres de control. Las galerías inferidas solo pueden reutilizar imágenes presentes en `Product.images` por ID o URL absoluta exacta.
- Preview y producción deben usar proyectos/entornos de secretos separados, tiendas o credenciales separadas y permisos independientes. Nunca se copia el valor de producción a preview.
- Todo secreto debe poder rotarse desde el gestor del despliegue sin editar código. La rotación incluye revocar el valor anterior, actualizar el entorno correspondiente y reconstruir/reiniciar el runtime que lo consume.
- `bun run security:scan` revisa archivos fuente y artefactos generados sin imprimir valores. CI usa `bun run security:scan:history` con historial completo. Si aparece un secreto real, no basta con borrarlo: hay que revocarlo, rotarlo y purgarlo del historial siguiendo el procedimiento aprobado por el propietario del repositorio.

## Checkout, redirecciones y errores

- Solo se navega a un checkout con estado `ready`, HTTPS, sin credenciales, puerto 443/default, URL acotada y host exacto de una allowlist. Se rechazan hosts por sufijo, comodines, IPs, espacios, caracteres de control y cualquier otro esquema. La URL autoritativa es `Cart.checkoutUrl`; no se construye `/checkout` ni se añade country, currency, locale o cartId. La navegación es top-level (`window.location.assign`); no hay iframe ni modal de checkout.
- Checkout, pagos, envío e impuestos ocurren en Shopify. No se añaden Stripe, Shopify Payments ni PayPal a `script-src`, `connect-src` ni `frame-src` de KingBelt. La configuración Admin de esas superficies se verifica con [`SHOPIFY_LAUNCH_OPERATIONS.md`](SHOPIFY_LAUNCH_OPERATIONS.md), no con flags de entorno.
- El click de checkout realiza una única reconciliación autoritativa en servidor: el Cart devuelto en esa operación contiene el estado comercial actual y, si es válido, el `checkoutUrl`. Una discrepancia de precio, cantidad, stock o línea debe comunicarse y, si es impeditiva, bloquear la salida.
- Un query param del navegador no es autoridad de pago ni de pedido. KingBelt no confirma compras; Thank You y Order Status los sirve Shopify.
- Los mensajes públicos son genéricos y no incluyen cuerpos GraphQL, stack traces, IDs de infraestructura, cabeceras, tokens ni excepciones internas. El código cliente no registra en consola. Los logs de servidor, cuando existan, deben usar campos estructurados y redacción por nombre (`authorization`, `token`, `cookie`, `password`, `secret`, `email`) antes de enviarse a un proveedor.

## Formularios y datos personales

- El formulario actual apunta a una ruta local todavía no implementada, limita nombre, email y mensaje en HTML y bloquea el envío; sus controles no tienen `name`, por lo que una degradación sin JavaScript tampoco transmite datos personales. Antes de activarlo, el servidor debe limitar el cuerpo total, aceptar solo el content type previsto, volver a validar longitudes y enum de asunto, normalizar email, aplicar rate limiting/antiabuso y protección CSRF u origen según la arquitectura elegida.
- El contenido se trata como texto, no HTML. Las salidas se escapan en su contexto. No se incluyen datos del formulario en URLs, analítica o logs.
- Solo se pedirán datos necesarios para responder la consulta o completar la operación. No se solicitan contraseñas ni datos de pago. Deben definirse retención, borrado, encargados y acceso antes de activar el endpoint.
- No se implementará autenticación, hashing de contraseñas, cifrado de datos ni protocolos criptográficos propios. Se usarán capacidades mantenidas del proveedor y primitivas estándar del runtime.

## Cabeceras y CSP

`vercel.json` aplica CSP, HSTS, `nosniff`, denegación de framing, referrer policy y Permissions Policy. La CSP refleja las necesidades actuales: scripts propios; estilos propios y hojas de fuentes aprobadas; fuentes de Google/Fontshare; imágenes propias, `data:` para texturas existentes y Unsplash; sin frames, objetos ni conexiones externas.

`style-src` conserva temporalmente `'unsafe-inline'` porque la interfaz usa atributos `style` para posición de imagen y muestras de color. `script-src` no permite `'unsafe-inline'`; el build fuerza los módulos ejecutables a archivos propios para que la política sea compatible. Cada servicio futuro debe justificar y añadir únicamente sus orígenes exactos a la directiva mínima necesaria. La política debe probarse primero en preview y comprobarse en la respuesta HTTP real; un `<meta>` no sustituye cabeceras de plataforma.

## Frontera HTTP de `/api/cart`

El BFF del carrito es same-origin y no público. Acepta únicamente `POST` con `Content-Type: application/json`, `Origin` exactamente igual a `request.url.origin` y uno de los cinco comandos cerrados (`refresh`, `add`, `update`, `remove`, `checkout`). Rechaza propiedades extra, `cartId` enviado por el navegador, GIDs de otra familia y cantidades fuera de `1..99`. Los `ProductVariant` GID no aceptan query; los `CartLine` GID admiten exclusivamente el contexto que devuelve Storefront (`?cart=<token URL-safe>`), sin parámetros adicionales, fragmento, path extra ni codificación porcentual. Astro `security.checkOrigin` se mantiene; el chequeo manual de `Origin` es necesario porque esa protección nativa no cubre `application/json`. No hay CORS, tokens CSRF propios ni rate limiter en la aplicación: el navegador expresa una intención mínima; el servidor valida la forma; Shopify sigue siendo la autoridad comercial.

## Rate limiting de lanzamiento (Vercel WAF)

El código no implementa rate limiting. En serverless un contador en memoria o por instancia no es una defensa distribuida. Antes de exponer `/api/cart` a tráfico real hay que habilitarlo en la infraestructura de Vercel:

1. Vercel Dashboard → Project → Firewall → New Rule.
2. Condiciones: Path equals `/api/cart` AND Method equals `POST`.
3. Acción: Rate Limit.
4. Baseline inicial de lanzamiento: **120 requests / 1 minute / source IP**. Si la interfaz no permite exactamente esa sintaxis, usar el equivalente más cercano.

Esa cifra no es una política comercial permanente. Permite uso normal y QA, limita automatización abusiva y debe ajustarse después con métricas reales. No se configura en `vercel.json`.

Checklist pre-launch:

- [ ] Vercel WAF rate limit habilitado para POST `/api/cart`
- [ ] baseline inicial: 120 req/min por source IP
- [ ] revisar métricas después del lanzamiento

## Persistencia de sesión del carrito (staging)

Production y Preview deben tener **ambas** `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Preferible una base Upstash distinta por entorno. No hay endpoint `/api/session-health`: la comprobación operativa es CLI (`bun run session:preflight`).

Checklist manual en staging:

1. Abrir staging en una ventana normal.
2. Añadir un producto.
3. Recargar la página y confirmar el mismo carrito.
4. Navegar a otra ruta y confirmar el mismo carrito.
5. Cerrar y reabrir la pestaña; la persistencia se conserva.
6. Abrir una ventana de incógnito y confirmar un carrito independiente.

En DevTools → Application → Cookies debe existir `__Host-kingbelt-session` con `Secure`, `HttpOnly`, `SameSite=Lax` y `Path=/`. El valor de la cookie no debe contener `gid://shopify/Cart/`. En las respuestas de la web y de `/api/cart`, buscar `gid://shopify/Cart/` y `cartId`: 0 coincidencias. En Upstash basta comprobar que aparece actividad bajo el namespace de sesión, con TTL, sin inspeccionar ni publicar el valor almacenado.

## Dependencias y validación

- Bun está fijado en `packageManager`; usa `bun install --frozen-lockfile` para evitar resolver versiones distintas.
- `bun run audit:dependencies` revisa dependencias conocidas como vulnerables; cada excepción debe documentar paquete, alcance, mitigación, propietario y fecha de caducidad.
- El job `quality` de GitHub Actions ejecuta `bun run validate` con `COMMERCE_SOURCE=demo` y sin secretos Shopify ni Upstash. Los pull requests no reciben credenciales de producción. Las Actions oficiales van fijadas por SHA, con `contents: read` y `persist-credentials: false`. La validación autenticada contra Storefront es `bun run shopify:preflight`; la del store de sesiones es `bun run session:preflight`; el smoke de carrito contra un deployment real es `bun run shopify:cart-smoke`; el orquestador pre-pagos es `bun run shopify:release-gate`. Esos comandos, o `bun run launch:preflight`, solo deben ejecutarse en entornos confiables de staging o Production, nunca en el job `quality` ni en PRs de forks. El token Storefront de producción debe limitarse a los scopes que usa el runtime: `unauthenticated_read_product_listings`, `unauthenticated_read_checkouts` y `unauthenticated_write_checkouts`. Las galerías proceden de `Product.images`, por lo que `unauthenticated_read_metaobjects` ya no es necesario. `unauthenticated_read_product_inventory` solo es necesario si se activa inventario exacto en Storefront. `SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES` y `SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES` no son secretos, no entran en `astro:env` ni en el bundle, y solo las lee `shopify:preflight`. `SHOPIFY_SMOKE_BASE_URL` y `SHOPIFY_SMOKE_PRODUCT_HANDLE` tampoco son secretos ni entran en `astro:env`; las leen `shopify:cart-smoke` y `shopify:release-gate`.
- No se imprimen variables de entorno ni respuestas externas completas en logs. Los artefactos de build se vuelven a escanear después de compilar.

## Checklist para activar una integración

1. Confirmar dueño, entorno, scopes mínimos, cuota, hosts y política de rotación.
2. Crear credenciales distintas para preview y producción en el gestor de secretos, nunca en archivos locales compartidos.
3. Implementar la frontera servidor/BFF same-origin: cliente neutral → endpoints acotados → servicio servidor → Storefront Cart API.
4. Añadir hosts exactos a la allowlist y a la directiva CSP mínima; probar URLs adversariales.
5. Validar y limitar respuestas/payloads antes de mapearlos al dominio; no exponer campos administrativos.
6. Probar carrito falsificado, stock/precio cambiado, checkout caducado, errores redactados, rate limiting y ausencia de PII en almacenamiento/logs.
7. Ejecutar `bun run validate`, `bun run audit:dependencies` y verificar las cabeceras sobre el deployment de preview.
8. Documentar el rollback explícito: cambiar `COMMERCE_SOURCE=demo` y redeploy/restart; para volver, declarar `COMMERCE_SOURCE=shopify`. Nunca usar un fallback en runtime.
