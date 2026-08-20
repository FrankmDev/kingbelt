# Shopify Launch Operations — KingBelt

Fecha: 19 agosto 2026.

Astro entrega un carrito Shopify íntegro. Desde checkout hasta pedido, Shopify es la única autoridad. Lo que el código no puede ver se verifica aquí, a mano. Nunca con flags, Admin API ni importes inventados.

No guardar en Git: capturas de Payments, IBAN, VAT ID, KYC, direcciones personales ni tokens.

## Gates

| Comando / doc | Cubre | No cubre |
| --- | --- | --- |
| `bun run validate` | Código | Shopify Admin |
| `bun run session:preflight` | Upstash | Catálogo, checkout |
| `bun run shopify:preflight` | Storefront + catálogo + market ES | Envío, impuestos, pagos, emails |
| `bun run shopify:cart-smoke` | Deployment real + Cart API + `checkoutUrl` | Pago, Order, Admin API |
| `bun run shopify:release-gate` | Orquesta validate + session + Shopify + cart smoke + HTTP del deployment | Pago, Order, Admin API, promoción |
| Este documento | Admin: checkout → pedido | Un pedido de prueba |
| Pedido de prueba *(después)* | Tarifa, tax, pago, pedido, email, inventario | — |

`shopify:release-gate` ya engloba A/B/C/E + comprobaciones HTTP. Los comandos individuales siguen documentados para diagnosticar un fallo. No promociona, no hace rollback y no crea pedidos.

## Código (ya garantizado)

No sustituye Admin. Sin checkboxes: no es trabajo de tienda.

- Sin checkout, pago, thank-you ni order-status en Astro.
- Salida única: `Cart.checkoutUrl` → `getSafeCheckoutUrl()` → `window.location.assign`. Sin `SHOPIFY_CHECKOUT_URL`, sin query `country`/`currency`/`locale`/`cartId`, sin iframe.
- Customer Accounts: `SHOPIFY_CUSTOMER_ACCOUNT_URL` (desktop, móvil, `/cuenta/iniciar` 307). Si falta: 503. Nunca panel demo. Preflight estructural; sin `fetch` de esa URL.
- Guest checkout en frontend: sin login para add-to-cart, carrito ni checkout.
- Sin motor fiscal, sin tarifa de envío autoritativa, sin reserva de inventario, sin emails desde `/api/cart`.
- Sin Admin API, Admin token, `*_READY`, `SHIPPING_RATE`, `VAT_RATE`, `PAYMENT_PROVIDER`.

Los checks 1–12 quedan `[ ]` hasta verificación humana.

---

## Automated Cart Smoke -- no order

Antes de probar pagos debemos demostrar mediante el deployment real que un usuario anónimo puede crear y recuperar una sesión segura, operar un Cart Shopify real, conservarlo entre requests, obtener un checkout válido y dejar el carrito limpio, sin que ningún identificador remoto o secreto salga del servidor.

El script automático termina en `checkoutUrl`. No completa Shopify Checkout, no envía dirección, no paga y no crea un Order.

### Prerequisites

- [ ] `session:preflight` passed
- [ ] `shopify:preflight` passed
- [ ] deployment uses `COMMERCE_SOURCE=shopify`
- [ ] smoke pilot product is published and purchasable

### Command

```sh
COMMERCE_SOURCE=shopify \
SHOPIFY_SMOKE_BASE_URL=https://your-deployment.example \
SHOPIFY_SMOKE_PRODUCT_HANDLE=cinturon-caballero-al-corte-tintado-seta-5009-35 \
bun run shopify:cart-smoke
```

`SHOPIFY_SMOKE_BASE_URL` es el origin HTTPS del deployment candidato. No se infiere de `VERCEL_URL`, rama, `SHOPIFY_STORE_DOMAIN` ni `siteUrl`. Las credenciales Storefront salen del entorno seguro; no las pegues en el comando.

No forma parte de `bun run validate`, del job `quality` ni de `shopify:preflight`. Ejecutarlo solo en staging, preview autorizado o production candidate, y solo antes de launch o tras cambios de Cart/BFF/sesión/Shopify/deployment.

### Launch sequence

A. CODE — `bun run validate` (`COMMERCE_SOURCE=demo`)
B. STORAGE — `bun run session:preflight`
C. SHOPIFY DATA — `COMMERCE_SOURCE=shopify bun run shopify:preflight`
D. DEPLOY CANDIDATE — deployment HTTPS real
E. CART — `COMMERCE_SOURCE=shopify bun run shopify:cart-smoke`
F. RELEASE GATE — `COMMERCE_SOURCE=shopify bun run shopify:release-gate`
G. MANUAL CHECKOUT SMOKE — hasta métodos de pago, **sin pagar**
H. PAYMENT TEST ORDERS — siguiente fase
I. ACTIVATE LIVE PAYMENTS — solo después

F ya ejecuta A/B/C/E y las comprobaciones HTTP del deployment (`SHOPIFY_SMOKE_BASE_URL`). A–E siguen siendo útiles para aislar un fallo. No intercambiar el testing de pagos antes de F.

Preview puede certificar código y configuración Preview. No demuestra que Production tenga las mismas env vars. Antes de pedidos reales hay que comprobar Production.

Tras cambiar cualquier env var de Production: crear o promover un **nuevo** deployment. Un deployment Ready anterior no relee runtime. El release gate no ejecuta `vercel promote`, `vercel --prod` ni `git push`.

### Production environment names

Comprobar en Vercel Production los **nombres**, nunca pegar valores aquí:

- [ ] `COMMERCE_SOURCE` = `shopify` (nunca `demo`)
- [ ] `SHOPIFY_STORE_DOMAIN` = `kingbelt-store.myshopify.com` (no `kingbelt-store.shopify.com`)
- [ ] `SHOPIFY_API_VERSION`
- [ ] `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`
- [ ] `SHOPIFY_CUSTOMER_ACCOUNT_URL`
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

Los valores operativos de preflight/smoke (`SHOPIFY_PREFLIGHT_EXPECTED_*`, `SHOPIFY_SMOKE_BASE_URL`, `SHOPIFY_SMOKE_PRODUCT_HANDLE`) se usan desde el entorno que ejecuta el gate, no se copian Preview → Production en código.

### Identidad confirmada en Admin (19 agosto 2026)

Valores públicos de tienda. No son secretos. No sustituyen tokens ni Upstash.

| Variable | Valor confirmado |
| --- | --- |
| `SHOPIFY_STORE_DOMAIN` | `kingbelt-store.myshopify.com` |
| `SHOPIFY_CUSTOMER_ACCOUNT_URL` | `https://shopify.com/106425811284/account` |
| `SHOPIFY_PREFLIGHT_EXPECTED_COLLECTION_HANDLES` | `sport,casual,vestir` |
| `SHOPIFY_SMOKE_PRODUCT_HANDLE` | `cinturon-caballero-al-corte-tintado-seta-5009-35` |

`SHOPIFY_PREFLIGHT_EXPECTED_PRODUCT_HANDLES` debe ser este CSV exacto. El preflight compara conjuntos, no el orden. Fuente: Storefront API, no el título de Admin ni una URL con tilde:

```
cinturon-caballero-al-corte-tintado-40-mm-5003-40,cinturon-caballero-al-corte-volanato-5026-40,cinturon-caballero-altamarea-hebilla-doble-pua-5880-40,cinturon-caballero-piel-al-corte-montana-5029-40,cinturon-caballero-al-corte-doble-pespunte-bicolor-5508-35,cinturon-caballero-al-corte-tintado-seta-5009-35,cinturon-caballero-al-corte-lujado-con-costura-5025-35,cinturon-caballero-altamarea-5568-35,cinturon-caballero-al-corte-grabado-puntos-5776-40,cinturon-ensamblado-serraje-pintado-contorno-5365-35
```

Shopify translitera «cinturón» a `cinturon`, no a `cintur-on` ni a `cinturón`. `product(handle:)` con esas otras formas devuelve vacío y la PDP reescribe a 404. El catálogo demo (`cinturon-atlas`, etc.) sigue siendo independiente. `productRedirects` está vacío. El mapper de colección principal ya lee `custom.kingbelt_primary_collection` por `.reference`; no usa `kingbelt.primary_collection`.

Sigue faltando `SHOPIFY_SMOKE_BASE_URL` (origin HTTPS del deployment Vercel). Tokens Storefront y Upstash solo en Vercel / `.env` local, nunca en este documento.

### Release gate command

```sh
COMMERCE_SOURCE=shopify \
SHOPIFY_SMOKE_BASE_URL=https://your-deployment.example \
SHOPIFY_SMOKE_PRODUCT_HANDLE=cinturon-caballero-al-corte-tintado-seta-5009-35 \
bun run shopify:release-gate
```

### Manual browser smoke

Ventana de incógnito. No automatizar con Playwright.

1. Abrir `SHOPIFY_SMOKE_BASE_URL/productos/<SHOPIFY_SMOKE_PRODUCT_HANDLE>` y comprobar que el producto renderiza.
2. Seleccionar una variante comprable, añadir 1 unidad y verificar drawer/cart: producto, variante, cantidad 1, EUR.
3. Recargar, abrir el carrito y comprobar que conserva exactamente el mismo producto.
4. Pulsar checkout: navegación top-level a Shopify Checkout. Sin iframe, popup extraño, 404 ni login obligatorio.
5. En Checkout: producto, variante, quantity 1, precio y EUR correctos.
6. Si Shopify pide email antes de delivery, usar un correo de prueba no personal (`@example.com`). No datos de un cliente real.
7. Introducir una dirección española de prueba autorizada. Debe aparecer al menos una opción de envío válida. «Shipping not available» es BLOCKER de Admin, no de Astro.
8. La tarifa debe coincidir con Shopify Admin y la política pública. Comprobar subtotal, envío, tax si corresponde, total y EUR. Shopify es autoridad fiscal.
9. Confirmar que la superficie de métodos de pago es visible. **No introducir tarjeta. No pulsar Pay now / Pagar. No completar pedido.**
10. Cerrar checkout o volver al sitio. No se necesita Order ni Thank You.

Si aparece un Order, es un error de procedimiento: reportarlo y cancelarlo en Shopify. El script automático no navega ni paga, así que no debe poder crear uno.

No activar Payments test mode solo para este smoke. No cambiar payment, shipping ni tax desde código. Si `checkoutUrl` falla la allowlist, investigar el hostname real; no relajar `getSafeCheckoutUrl`.

---

## 1. Market — BLOCKER

Shopify Admin → Markets.

- [ ] España activa.
- [ ] EUR.
- [ ] Español disponible.
- [ ] Productos esperados disponibles en España.

Listo cuando: Admin coincide con el market que ya exige `shopify:preflight` (ES / ES / EUR).

Evidence: ___ · Date: ___ · Notes: ___

## 2. Customer Accounts — BLOCKER

Shopify Admin → Customer accounts.

- [ ] Customer Accounts actuales habilitadas. Legacy = BLOCKER.
- [ ] `SHOPIFY_CUSTOMER_ACCOUNT_URL` abre el portal correcto (no Admin, otra tienda, 404, checkout ni bucle a `/cuenta/iniciar`).
- [ ] Probar: header desktop, header móvil, `/cuenta/iniciar`.
- [ ] Cuenta opcional. Compra sin registro.

Un dominio `account.<dominio>` no exige cambio de código si la env tiene la URL final.

Evidence: ___ · Date: ___ · Notes: ___

## 3. Checkout — BLOCKER

Shopify Admin → Settings → Checkout, y Customize (Checkout and accounts).

- [ ] Contacto: **Email** (recomendado al lanzar; no recoger email en Astro).
- [ ] **Require customers to sign in before checkout: OFF** salvo decisión comercial explícita.
- [ ] Paso de revisión/confirmación del mercado europeo en Shopify. No existe `/checkout/review` en Astro.
- [ ] Políticas enlazadas en Checkout (ver §9).
- [ ] Customize: logo KingBelt, colores, tipografía, nombre, contacto — en checkout, cuentas, Thank You y Order Status. Coherente, no un clon de Astro.

Listo cuando: un invitado llega a Checkout desde el carrito KingBelt.

Evidence: ___ · Date: ___ · Notes: ___

## 4. Shipping — BLOCKER

Shopify Admin → Settings → Shipping and delivery.

- [ ] Ubicación activa con inventario, capaz de preparar, incluida en el perfil.
- [ ] Perfil GENERAL salvo razón comercial real.
- [ ] Todos los cinturones vendibles están en un perfil que permite envío.
- [ ] Zona España + España en el Market activo.
- [ ] **Al menos una** tarifa utilizable en esa zona.
- [ ] Si la tarifa es por peso o transportista: pesos de variante correctos en Shopify. Si es plana: el peso no fija el precio.
- [ ] Si la tarifa es calculada por transportista: tarifa de respaldo en Shopify cuando exista.

Preferir tarifa plana o envío gratuito en Shopify si aún no hay carrier fiable. SEUR no es requisito de lanzamiento. No instalar una app compleja solo para desbloquear.

```txt
FINAL SHIPPING RATE:
[valor configurado realmente en Shopify]
```

Si el coste no está decidido: **BLOCKER: definir coste de envío España.**

Listo cuando: una dirección española realista obtiene ≥1 opción en Checkout. Un perfil vacío no basta. Esa prueba es el pedido de prueba (§11), no este paso.

Evidence: ___ · Date: ___ · Notes: ___

## 5. Taxes — BLOCKER

Shopify Admin → Settings → Taxes and duties.

- [ ] Configuración fiscal España revisada.
- [ ] Registro fiscal cuando proceda (no inventar NIF/IVA aquí).
- [ ] Clasificación fiscal de productos correcta. Sin overrides accidentales.
- [ ] Precios con impuestos alineados con la política comercial.
- [ ] Checkout mostrará el impuesto correctamente.

Listo cuando: un checkout de prueba con dirección española muestra subtotal, envío, impuesto y total coherentes. Sin valores esperados en código.

`taxPolicy` en `src/config/business.ts` está `pending`. No añadir «+ IVA» / «IVA incluido» hasta confirmar. Una discrepancia con Shopify es MANUAL BLOCKER; no corregir el negocio por suposición.

Evidence: ___ · Date: ___ · Notes: ___

## 6. Payments — BLOCKER

Shopify Admin → Settings → Payments.

Preferido en España: Shopify Payments si la cuenta es elegible y está verificada. Si ya hay otro proveedor elegido a propósito, no sustituirlo.

- [ ] Proveedor válido, onboarding completo, operable en España.
- [ ] Sin banner de configuración incompleta. Método de cobro final habilitado.
- [ ] Test mode solo en QA. **Antes de live: test mode OFF.**

Bogus Gateway y tarjetas de prueba son Admin, no código. Instrucciones de prueba: runbook de QA posterior.

Listo cuando: QA de pago hecho + test mode OFF + Checkout muestra un método real. «Shopify Payments configurado» no basta. No afirmar pagos reales hasta ver test mode OFF.

Evidence: ___ · Date: ___ · Notes: ___

## 7. Notifications — BLOCKER

Shopify Admin → Settings → Notifications.

- [ ] Sender email profesional, dominio autenticado si corresponde, nombre correcto.
- [ ] Plantillas Order confirmation y Shipping confirmation revisadas. Contacto KingBelt correcto.
- [ ] Al menos una persona operativa recibe **New order** en una bandeja que se revisa.

Sin SMTP en Astro. Sin emails desde `/api/cart`. Sin SMS propio al lanzar.

Listo cuando: el pedido de prueba entrega order confirmation. Si se prueba fulfillment: también shipping confirmation.

Evidence: ___ · Date: ___ · Notes: ___

## 8. Fulfillment — BLOCKER

Shopify Admin → Orders.

- [ ] Fulfillment **manual** salvo automatización real ya probada.
- [ ] Pagado ≠ enviado. Flujo: pedido → Admin → revisar → preparar → fulfill → tracking → cliente actualizado.
- [ ] Sin auto-fulfill, sin compra automática de etiquetas, sin notificar envío antes de preparar.
- [ ] Sin archivado automático de pedidos incompletos desde Astro.

Evidence: ___ · Date: ___ · Notes: ___

## 9. Policies — BLOCKER

Configurarlas en Shopify Checkout. No inyectarlas desde Astro.

- [ ] Privacidad, devoluciones/reembolsos, términos, envío e información legal requeridas.
- [ ] Coherentes con las páginas KingBelt. Dos versiones contradictorias = MANUAL BLOCKER.

**MANUAL BLOCKER actual:** `/aviso-legal`, `/privacidad`, `/cookies`, `/condiciones`, `/envios-y-devoluciones` están `draft`. `shippingCosts`, `deliveryTime`, `freeShipping` están `pending`. No hay copy público de envío gratuito ni 24/48 h. Completar y alinear con Admin antes de publicar.

Web «gratis» + Checkout que cobra, o web «24/48 h» + operación que no puede, es BLOCKER.

Evidence: ___ · Date: ___ · Notes: ___

## 10. Thank You / Order Status — BLOCKER

Shopify las sirve. Una vez, tras el pago. El cliente vuelve a Order Status o Customer Account. Sin URLs inventadas, sin Order ID en query ni `localStorage`.

**BLOCKER:** deben usar Checkout and Accounts **actual**. Legacy (`checkout.liquid`, additional scripts, Thank You legacy) es bloqueante. Sin workaround en Astro.

Tiendas no-Plus: migrar **antes del 26 agosto 2026**. No lanzar con legacy pendiente. Si ya está actualizado: marcar verificado a mano. Esta fecha no entra en runtime.

- [ ] Thank You y Order Status en infraestructura actual.
- [ ] El flujo principal no depende de additional scripts / `checkout.liquid` legacy.

Evidence: ___ · Date: ___ · Notes: ___

## 11. Final test order — DEFERRED

No en este paso: ni Cart de prueba, ni `deliveryAddress`, ni `deliveryGroups`, ni pago.

- [ ] Dirección española → ≥1 tarifa.
- [ ] Tax correcto (subtotal, envío, impuesto, total).
- [ ] Pago (test mode en QA; OFF antes de live).
- [ ] Pedido en Admin.
- [ ] Order confirmation recibida.
- [ ] Inventario decrementado.
- [ ] Thank You Shopify.
- [ ] Order Status / Customer Account.
- [ ] Si se prueba fulfillment: shipping confirmation.

## 12. Go-live

No marcar READY/LIVE por sección hasta su «Listo cuando». Resumen:

- [ ] Market ES / EUR / ES: Admin + `shopify:preflight`.
- [ ] Customer Accounts actuales + URL comprobada en browser.
- [ ] Checkout: email, guest ON, review, políticas, branding.
- [ ] Shipping: zona España + tarifa real + prueba con dirección española (§11).
- [ ] Taxes: pedido de prueba con dirección española.
- [ ] Payments: proveedor real + QA + test mode OFF.
- [ ] Notifications: order confirmation recibida.
- [ ] Fulfillment manual operativo.
- [ ] Políticas alineadas (salir de `draft` legal).
- [ ] Thank You / Order Status actuales (no-Plus: 26 agosto 2026).
- [ ] Pedido de prueba completo (§11).

Evidence: ___ · Date: ___ · Notes: ___

## QA manual — Cart recovery

No hace falta provocar una caída real de Shopify. Los casos destructivos se cubren con mocks.

- [ ] Dejar un Cart, volver después y comprobar recuperación.
- [ ] Producto agotado/no disponible bloquea checkout.
- [ ] Una línea eliminada puede retirarse sin romper el Cart.
- [ ] Error temporal de red no vacía visualmente el carrito existente.
