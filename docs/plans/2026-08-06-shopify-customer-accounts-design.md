# Diseño: cuentas de cliente con Shopify

## Estado y decisión

Este documento fija contratos y límites; no autoriza todavía una implementación. No se crearán rutas, formularios, adaptadores, sesiones, credenciales ni datos ficticios hasta que existan una tienda Shopify configurada, un dominio estable y un runtime servidor elegido.

KingBelt utilizará **Customer accounts** —la versión actual y sin contraseña de las cuentas de Shopify— junto con **Customer Account API**. Shopify la recomienda para acceder a datos de cliente en storefronts personalizados y ofrece autenticación alojada, passwordless y compartida con checkout. Las cuentas legacy de Storefront API, `customerCreate`, `customerAccessTokenCreate`, recuperación de contraseña, Multipass y una autenticación propia quedan fuera de la arquitectura.

En Customer accounts, iniciar sesión y registrarse son el mismo flujo alojado: Shopify solicita el correo y verifica su posesión con un código de un solo uso. Si no existe un perfil, Shopify lo crea automáticamente. Por tanto, KingBelt podrá presentar dos intenciones de entrada —«Iniciar sesión» y «Crear cuenta»—, pero ambas comenzarán en el mismo endpoint de autorización de Shopify. No habrá formulario propio de contraseña, alta ni recuperación. La recuperación consiste en volver al flujo alojado, reenviar el código o acudir a soporte si se perdió el acceso al correo; no existe una contraseña que KingBelt deba restablecer.

Fuentes oficiales consultadas el 6 de agosto de 2026:

- [Customer Account API para storefronts headless](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api)
- [Configuración y tipos de cliente](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started)
- [Referencia de autenticación, renovación y logout](https://shopify.dev/docs/api/customer/latest)
- [Creación automática y acceso passwordless](https://help.shopify.com/en/manual/customers/customer-accounts)
- [Scopes de Customer Account API](https://shopify.dev/docs/api/usage/access-scopes#customer-access-scopes)
- [Autenticación del checkout](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/checkout-authentication)
- [Deprecación del intercambio de token para Storefront](https://shopify.dev/changelog/deprecation-of-storefrontcustomeraccesstokencreate-mutation)
- [Renderizado bajo demanda de Astro](https://docs.astro.build/en/guides/on-demand-rendering/)

## Alternativas valoradas

1. **Cuenta completamente alojada por Shopify.** El header puede usar el componente oficial `shopify-account` y pedidos, perfil y direcciones viven en las páginas de Customer accounts. Es la opción de menor superficie y será el fallback si el hosting de KingBelt no puede mantener sesiones servidor.
2. **Autenticación alojada + cuenta KingBelt mediante BFF.** Shopify conserva la identidad y Customer Account API aporta pedidos, perfil y direcciones. Un backend de Astro guarda los tokens y el navegador solo recibe una cookie opaca. Es la opción elegida porque permite una experiencia `/cuenta` propia sin recibir credenciales.
3. **Cliente OAuth público en el navegador.** Es un flujo oficial con PKCE, pero hace que el navegador custodie access y refresh tokens. No se adopta porque contradice la frontera de seguridad solicitada.

No se mezclarán las opciones 1 y 2 de manera incidental. En concreto, no habrá un estado del componente oficial y otro estado BFF sin una estrategia explícita de sincronización y pruebas. Si se elige finalmente la opción alojada, se retirarán del alcance las páginas privadas propias en vez de simularlas.

## Arquitectura objetivo

```txt
navegador
  ├─ contenido público estático
  ├─ cookie opaca de cuenta ───────────────┐
  └─ cookie/handle independiente de carrito│
                                           ▼
Astro on-demand / BFF
  ├─ CustomerSessionService ── SessionRepository cifrado
  ├─ CustomerAccountService ── CustomerAccountProvider ── Customer Account API
  └─ CustomerCartLinker ────── CartProvider ────────────── Storefront Cart API
                                           │
                                           └─ autorización alojada / logout OIDC de Shopify
```

La web continuará estática por defecto. La implementación futura añadirá el adapter oficial correspondiente al hosting y marcará solo las rutas de cuenta y sus endpoints con `prerender = false`. No es necesario convertir todo el sitio a SSR.

Las páginas y componentes consumen servicios de aplicación neutrales. No importan GraphQL, endpoints OAuth, SDKs, respuestas de Shopify ni el repositorio de sesión. Los tokens solo pueden atravesar código servidor dentro de infraestructura y nunca forman parte de props, HTML, JSON para el navegador, logs, analítica o errores.

### Módulos previstos, no creados en esta fase

```txt
src/customer-account/
  domain/           # perfil, dirección, pedido y estados neutrales
  application/      # casos de uso y puertos
  infrastructure/
    shopify/        # discovery, OAuth y Customer Account API
    session/        # almacenamiento servidor y cifrado
  account.ts        # composition root servidor

src/pages/cuenta/   # páginas privadas on-demand
src/pages/api/account/  # endpoints same-origin on-demand
```

`commerce/` y `customer-account/` son dominios separados. Su única colaboración explícita es `CustomerCartLinker`; la sesión de cuenta no se convertirá en el almacén del carrito y el carrito anónimo no probará que exista una sesión autenticada.

## Contratos de aplicación

Los contratos exactos se materializarán como TypeScript al implementar. Esta es su semántica mínima:

```ts
type CustomerSessionSnapshot =
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; customer: CustomerIdentitySummary }
  | { kind: 'expired'; reason: 'idle' | 'absolute' | 'provider' }
  | { kind: 'unavailable'; retryable: true };

interface CustomerSessionService {
  getSnapshot(context: RequestContext): Promise<CustomerSessionSnapshot>;
  beginAuthorization(context: RequestContext, returnTo: SafeAccountPath): Promise<Response>;
  completeAuthorization(context: RequestContext, callbackUrl: URL): Promise<Response>;
  logout(context: RequestContext): Promise<Response>;
}

interface CustomerAccountService {
  getProfile(context: AuthenticatedRequestContext): Promise<CustomerProfile>;
  updateProfile(context: AuthenticatedRequestContext, input: CustomerProfileInput): Promise<OperationResult<CustomerProfile>>;
  listOrders(context: AuthenticatedRequestContext, page: CursorPage): Promise<CursorResult<CustomerOrderSummary>>;
  getOrder(context: AuthenticatedRequestContext, id: CustomerOrderId): Promise<CustomerOrder | null>;
  listAddresses(context: AuthenticatedRequestContext): Promise<CustomerAddress[]>;
  createAddress(context: AuthenticatedRequestContext, input: CustomerAddressInput): Promise<OperationResult<CustomerAddress>>;
  updateAddress(context: AuthenticatedRequestContext, id: CustomerAddressId, input: CustomerAddressInput): Promise<OperationResult<CustomerAddress>>;
  deleteAddress(context: AuthenticatedRequestContext, id: CustomerAddressId): Promise<OperationResult<void>>;
}

interface CustomerCartLinker {
  attachAuthenticatedBuyer(context: AuthenticatedRequestContext): Promise<CartAssociationResult>;
  refreshAuthenticatedBuyer(context: AuthenticatedRequestContext): Promise<CartAssociationResult>;
  rotateToAnonymousCart(context: RequestContext): Promise<CartRotationResult>;
}
```

`RequestContext` contiene referencias opacas a sesión, carrito, origen e IP validada; nunca un token accesible a presentación. `CustomerIdentitySummary` se limita a lo necesario para el header —por ejemplo, nombre visible e iniciales—. Pedidos, direcciones y perfil son proyecciones neutrales y no copias completas del schema de Shopify.

`OperationResult` separa éxito de errores estables de dominio: `validation`, `unauthenticated`, `forbidden`, `conflict`, `throttled`, `unavailable` y `unknown`. Los textos de Shopify no se muestran directamente. Toda mutación solicita y procesa `userErrors`, incluso cuando GraphQL responde HTTP 200.

## Flujo de autorización, registro y verificación

1. `GET /cuenta/iniciar` y `GET /cuenta/registro` validan un destino interno y llaman a `beginAuthorization`.
2. El servidor descubre `authorization_endpoint`, `token_endpoint`, `end_session_endpoint` y `jwks_uri` desde el dominio de storefront configurado; no acepta un dominio recibido del navegador ni fija endpoints manualmente.
3. El servidor crea una transacción corta y de un solo uso con `state`, `nonce`, destino validado y, si el flujo configurado lo admite, PKCE S256. La transacción vive en almacenamiento servidor; el navegador solo recibe su identificador opaco.
4. El navegador se redirige al sistema alojado de Shopify. Shopify gestiona correo, código de un solo uso, reenvío, social login o Shop cuando estén habilitados. KingBelt no ve el correo ni el OTP enviado en esa pantalla.
5. `/cuenta/callback` exige coincidencia constante de `state`, callback exacto, transacción no usada y no caducada. Intercambia el `code` desde servidor como cliente confidencial.
6. El `id_token` se valida criptográficamente con las claves descubiertas: firma, `iss`, `aud`, `exp` y `nonce`. Decodificar un JWT sin verificarlo no es validación.
7. Solo después se crea una nueva sesión, se rota el ID para evitar fijación y se destruye la transacción. El destino se lee del registro servidor y no del query string devuelto.
8. Se intenta asociar el carrito anónimo mediante `CustomerCartLinker`. Un fallo de carrito no revierte una autenticación válida: deja la asociación pendiente y obliga a revalidarla antes de checkout.

La creación de un cliente desconocido y la verificación de email pertenecen a Shopify. Un cambio de correo mediante Customer Account API respetará el estado de verificación devuelto por Shopify; la UI no confirmará el nuevo correo de forma optimista. No se añadirá un endpoint público que diga si un email existe.

Los scopes de OAuth documentados actualmente para el canal headless incluyen `openid email customer-account-api:full`. El alcance efectivo se reduce en la configuración del canal: inicialmente solo `customer_read_customers`, `customer_write_customers` y `customer_read_orders`. No se solicitará `customer_write_orders`, suscripciones, compañías, store credit, metafields ni Admin API sin un caso de uso aprobado. Deben cumplirse además los requisitos de Shopify para datos protegidos de cliente.

## Sesión y renovación

La cookie de cuenta será host-only, con nombre prefijado `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` y sin `Domain`. Contendrá únicamente un identificador aleatorio de alta entropía. No se guardará en `localStorage`, `sessionStorage`, IndexedDB ni una cookie legible por JavaScript ningún access token, refresh token, ID token, authorization code, verifier PKCE o dato personal.

El registro servidor de sesión contendrá solo lo necesario: tokens cifrados, expiración conocida, versión de rotación, timestamps de creación/último uso y referencia mínima al cliente. El almacén debe ser persistente y compartido entre instancias; el almacenamiento en memoria no sirve en producción. Sus TTL de inactividad y absoluto se fijarán antes de lanzamiento, nunca serán infinitos y no podrán superar la validez permitida por Shopify.

Antes de cada operación privada, el servidor comprueba la sesión. Si el access token está próximo a expirar, una renovación single-flight usa el refresh token contra el endpoint descubierto. La respuesta completa —incluido un refresh token rotado— se cifra y sustituye atómicamente usando control de versión. Las solicitudes concurrentes esperan el mismo resultado y no reutilizan un refresh token ya rotado.

- `invalid_grant`, token inválido o sesión absoluta/ociosa vencida: destruir sesión y devolver `expired`.
- Fallo temporal de red o `5xx`: conservar el último registro válido, no mostrar datos cacheados y devolver `unavailable`; no convertir una caída de Shopify en un falso logout.
- `THROTTLED`: respetar backoff y `Retry-After` cuando exista; no repetir mutaciones automáticamente.
- Resultado de mutación incierto por corte de red: refetch antes de presentar éxito. Una creación no idempotente, como una dirección, no se reenvía automáticamente.

El frontend solo conoce `CustomerSessionSnapshot`. Las páginas públicas pueden consultar un endpoint mínimo `no-store` para pintar el header; no reciben el registro de sesión ni datos de cuenta completos.

## Logout completo y datos antiguos

`POST /cuenta/cerrar` exige origen same-site y protección CSRF. El servidor realiza estas acciones en este orden de seguridad:

1. toma el `id_token` solo en memoria de la petición;
2. intenta preparar un carrito anónimo nuevo copiando únicamente líneas revalidadas y país/mercado no personal;
3. hace el commit local de salida: destruye la sesión, expira su cookie y sustituye el handle de carrito por el nuevo o por un carrito vacío; el handle anterior se descarta aunque la copia haya fallado;
4. invalida inmediatamente el snapshot de UI y emite un evento de logout a otras pestañas;
5. redirige al `end_session_endpoint` descubierto con `id_token_hint` y un `post_logout_redirect_uri` registrado exactamente en Shopify.

El logout remoto es una redirección OIDC oficial, no una llamada inventada. Si Shopify no está disponible, KingBelt permanece localmente cerrado y muestra una salida segura para reintentar el cierre remoto; nunca restaura la sesión local. El antiguo carrito puede seguir existiendo en Shopify, pero KingBelt elimina su handle, por lo que ya no puede usarse como invitado con una identidad anterior.

Como defensa ante una respuesta de logout perdida, todo endpoint de carrito comprueba la coherencia entre sesión de cuenta y marca de asociación: si recibe un carrito asociado sin una sesión autenticada vigente, rota a carrito anónimo antes de devolver datos o checkout. `checkoutUrl` nunca se persiste ni se reutiliza después del logout.

La UI elimina su estado en memoria solo después de que el servidor confirme que destruyó la sesión local, publica el cambio mediante `BroadcastChannel` y hace una navegación completa. Las páginas privadas usan `Cache-Control: private, no-store, max-age=0`, no entran en caché CDN o service worker y revalidan en `pageshow`; si el navegador restaura una entrada de bfcache, la página se recarga antes de volver a habilitar contenido sensible. Así, volver atrás o cerrar sesión en otra pestaña no muestra datos antiguos.

## Carrito anónimo y asociación oficial

La cookie o handle de carrito es independiente de la cookie de cuenta. El usuario puede añadir productos sin autenticarse; iniciar o cerrar sesión no fusiona dos almacenes de sesión ni convierte el carrito en autoridad de identidad.

Tras login, el servidor usa el access token vigente de Customer Account API directamente como `customerAccessToken` en `cartBuyerIdentityUpdate`, el mecanismo oficial de Storefront Cart API. Desde 2025-01 no se usa `storefrontCustomerAccessTokenCreate`, que está deprecado. En llamadas Storefront realizadas desde servidor se reenvía `Shopify-Storefront-Buyer-IP` solo desde una IP obtenida de cabeceras confiables del runtime.

Cada renovación de token vuelve a ejecutar `cartBuyerIdentityUpdate`. Inmediatamente antes de obtener `checkoutUrl`, el servidor revalida token, asociación y carrito. Si no puede confirmar la asociación, no promete un checkout autenticado: permite reintentar o, mediante una elección explícita, rota a carrito invitado. La URL de checkout se solicita en ese momento y pasa la validación HTTPS y de host exacto ya definida por el dominio de comercio.

Para logout se prefiere crear un carrito anónimo nuevo a enviar `null` esperando que Shopify elimine una identidad; solo se utilizará una mutación de desasociación si la versión fijada de la API la documenta expresamente.

## Rutas, privacidad y caché

Rutas previstas:

| Ruta | Método | Comportamiento |
| --- | --- | --- |
| `/cuenta/iniciar` | GET | Comienza autorización alojada |
| `/cuenta/registro` | GET | Misma autorización, intención de copy distinta |
| `/cuenta/recuperar` | GET | Vuelve al acceso alojado; no hay reset de contraseña |
| `/cuenta/callback` | GET | Valida OAuth/OIDC y crea sesión |
| `/cuenta/cerrar` | POST | Destruye sesión y comienza logout OIDC |
| `/cuenta` | GET | Resumen privado o redirect a pedidos |
| `/cuenta/pedidos` y `/cuenta/pedidos/[id]` | GET | Lectura paginada y detalle del cliente actual |
| `/cuenta/perfil` | GET | Perfil del cliente actual |
| `/cuenta/direcciones` | GET | Direcciones del cliente actual |
| `/api/account/session` | GET | Snapshot mínimo para UI pública |
| `/api/account/profile/update` | POST | Actualiza perfil y aplica POST/Redirect/GET |
| `/api/account/addresses/create` | POST | Crea una dirección propia |
| `/api/account/addresses/update` | POST | Actualiza una dirección propia |
| `/api/account/addresses/delete` | POST | Elimina una dirección propia |

Todas, salvo los iniciadores, son on-demand. Las privadas exigen sesión servidor en cada request, añaden `noindex,nofollow`, se excluyen del sitemap y responden `Cache-Control: private, no-store, max-age=0` más la directiva equivalente del CDN elegido. Nunca se usan `getStaticPaths`, datos de cliente durante build, props serializadas con PII ni revalidación pública por URL.

Las mutaciones aceptan solo `POST`, verifican `Origin`/`Sec-Fetch-Site`, token CSRF ligado a sesión, tipo de contenido, tamaño máximo y esquema de entrada. Después siguen POST/Redirect/GET. No se habilita CORS para estos endpoints.

## Redirecciones seguras

`returnTo` acepta únicamente paths relativos de una allowlist de navegación de KingBelt. Se rechazan esquemas, hosts, `//`, barras invertidas, credenciales, caracteres de control, dobles codificaciones y destinos fuera de la base esperada. El valor normalizado se guarda en la transacción servidor y el callback solo recibe su `state` opaco.

Callback y logout usan URLs HTTPS exactas registradas en Shopify. Producción y staging tienen clientes y dominios estables separados; no se autorizan wildcards ni dominios efímeros de preview. Los endpoints descubiertos solo se aceptan para el dominio Shopify configurado. Las redirecciones de checkout conservan su allowlist exacta de hosts, nunca coincidencia por sufijo.

## Errores, enumeración y abuso

KingBelt no recibe email en sus endpoints públicos de login/registro, de modo que no puede filtrar si existe una cuenta. La pantalla alojada de Shopify es responsable de OTP, reenvíos y protecciones de identidad. El copy propio será neutral: «Inicia sesión o crea tu cuenta con tu correo». No habrá mensajes como «correo no registrado», «cuenta existente» o diferencias de estado/tiempo generadas por código propio.

Si en el futuro se añade un paso previo con email, deberá tener respuesta uniforme, rate limit por IP y huella de sesión, límites progresivos y el mecanismo antiabuso aprobado entonces. CAPTCHA no se añadirá por defecto ni se fingirá ahora. Los endpoints de inicio/callback, mutaciones privadas y checkout tendrán rate limit en servidor; los límites de Shopify complementan, no sustituyen, esta protección.

Los errores visibles se traducen a categorías neutrales. Tokens, códigos, `state`, nonce, IDs completos de pedidos, correo, dirección y variables GraphQL se redactan de logs, trazas y reporting. La observabilidad conserva solo código estable, fase, request ID de Shopify cuando sea seguro, latencia y correlation ID propio.

No hay actualización optimista de perfil, dirección ni pedidos. Tras una mutación exitosa se usa el recurso devuelto o se vuelve a consultar. Ante un resultado incierto se muestra «No hemos podido confirmar el cambio» y se reconcilia; no se presenta el dato anterior como actualizado.

## Invariantes verificables

- Ningún elemento `input[type=password]` ni campo OTP pertenece a KingBelt.
- Ninguna mutación legacy de cliente de Storefront API aparece en el bundle o en servidor.
- El bundle, HTML, source maps, logs y almacenamiento del navegador no contienen tokens de cliente.
- La cookie de cuenta solo contiene un ID opaco y se rota en login/logout.
- Las rutas privadas fallan cerradas sin sesión, no se prerenderizan y no admiten caché pública.
- Pedidos y direcciones solo se obtienen con el token del cliente de la sesión actual.
- Logout local funciona aunque Shopify o el carrito fallen; nunca conserva datos visibles.
- Login/logout en una pestaña actualiza el header de las demás y bfcache no revive PII.
- Un refresh concurrente produce una sola rotación y conserva el refresh token más reciente.
- Un fallo transitorio distingue `unavailable` de `anonymous` o `expired`.
- Toda redirección maliciosa termina en un destino interno seguro por defecto.
- El carrito anónimo sobrevive separado; el carrito autenticado solo se asocia con `cartBuyerIdentityUpdate`.
- Checkout vuelve a validar sesión, token, carrito y host antes de redirigir.
- Builds, sitemap, RSS, analytics y páginas de error nunca contienen datos de cliente.

## Prerrequisitos para implementar

1. Activar **Customer accounts**, no legacy customer accounts, en Shopify.
2. Instalar el canal Headless, crear un storefront y configurar Customer Account API como cliente confidencial.
3. Aprobar acceso a datos protegidos y habilitar solo `customer_read_customers`, `customer_write_customers` y `customer_read_orders`.
4. Registrar callbacks y logout HTTPS exactos para producción y staging.
5. Elegir hosting y adapter Astro; confirmar soporte de SSR, cabeceras `no-store`, secretos runtime y almacenamiento de sesión multiinstancia.
6. Elegir almacén con TTL y cifrado/KMS; definir límites ocioso y absoluto, rotación de claves y borrado.
7. Fijar una versión estable soportada de Customer Account API y Storefront API; nunca usar `latest` en código.
8. Configurar dominio Shopify, client ID y client secret exclusivamente como secretos servidor.
9. Decidir si la cuenta se presenta dentro de KingBelt (opción 2) o se delega por completo a Shopify (opción 1).
10. Completar threat model, política de retención, DPA/privacidad, rate limiting, CSP y runbook de rotación/revocación.

Hasta completar estos puntos, cualquier icono de cuenta debe permanecer ausente o enlazar únicamente a una capacidad oficial ya configurada. No se publicará una pantalla de login desconectada.
