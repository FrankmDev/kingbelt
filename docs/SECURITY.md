# Seguridad antes de integrar servicios externos

Estado: baseline preventiva. El catálogo de build usa Storefront cuando existen credenciales servidor; el carrito sigue en persistencia demo y resuelve variantes desde el snapshot público `/cart-catalog.json`. No hay token en el navegador ni checkout remoto cableado.

## Límites de confianza

- El navegador no es autoridad para precio, stock, identidad de producto, descuentos, comprador ni posibilidad de checkout. Solo puede proponer `variantId` y cantidad; el proveedor recompone todas las líneas y vuelve a sincronizarlas antes del checkout.
- El contrato cliente de carrito/checkout no transporta access tokens ni identidad autenticada. Si se activa Customer Accounts, la sesión y los tokens vivirán en servidor detrás de una cookie `HttpOnly`; el proveedor resolverá la identidad sin confiar en un campo enviado por el navegador.
- `localStorage` contiene exclusivamente versión, `variantId` y cantidad, con límites de tamaño, líneas, longitud y cantidad. No se guardan tokens, email, nombre, direcciones, precios ni respuestas completas. No se usa `sessionStorage`. El snapshot `/cart-catalog.json` es una proyección pública del catálogo ya emitido en las fichas; no incluye secretos ni campos administrativos.
- El catálogo externo debe normalizarse y pasar `assertValidCatalog()` antes de llegar a páginas o componentes. Sus campos son texto plano: el HTML del proveedor se rechaza. Si en el futuro se necesitara rich text, deberá sanitizarse en servidor con una allowlist explícita y nunca pasarse directamente a `set:html`.
- El JSON incrustado se serializa con `serializeJsonForHtml()`, que escapa `<`, `>`, `&`, U+2028 y U+2029. Los atributos `data-*` solo contienen IDs, estados o proyecciones públicas; nunca secretos ni objetos administrativos.
- Las imágenes del catálogo solo pueden usar rutas raíz o HTTPS hacia hosts exactos declarados en `publicSecurityConfig.remoteImageHosts`. No se aceptan comodines, credenciales, HTTP, puertos alternativos ni coincidencias por sufijo.

## Variables y secretos

- Configurar dominio y token privado selecciona el catálogo Storefront en el runtime SSR; el carrito híbrido usa el BFF Shopify cuando existe `SHOPIFY_CART_COOKIE_SECRET` y degrada a demo sin él. `SHOPIFY_WEBHOOK_SECRET` y `VERCEL_DEPLOY_HOOK_URL` viven solo en el runtime de `/api/shopify-catalog-rebuild` y en el entorno de Vercel; no entran en `astro:env` ni en el bundle.
- Un nombre `PUBLIC_*` se considera parte del bundle y del HTML público. No puede contener secretos, tokens Admin, tokens Storefront, contraseñas ni credenciales privadas. El carrito Shopify usa siempre el BFF same-origin; el navegador no necesita un token del proveedor.
- Los secretos privados se leen únicamente desde una frontera servidor mediante `astro:env/server`. El runtime SSR usa el token privado en cada ciclo de caché para consultar el catálogo: el secreto vive solo en el entorno del servidor y no entra en el HTML, los assets ni el bundle cliente. Las operaciones de carrito pasan por el BFF same-origin.
- Preview y producción deben usar proyectos/entornos de secretos separados, tiendas o credenciales separadas y permisos independientes. Nunca se copia el valor de producción a preview.
- Todo secreto debe poder rotarse desde el gestor del despliegue sin editar código. La rotación incluye revocar el valor anterior, actualizar el entorno correspondiente y reconstruir/reiniciar el runtime que lo consume.
- `bun run security:scan` revisa archivos fuente y artefactos generados sin imprimir valores. CI usa `bun run security:scan:history` con historial completo. Si aparece un secreto real, no basta con borrarlo: hay que revocarlo, rotarlo y purgarlo del historial siguiendo el procedimiento aprobado por el propietario del repositorio.

## Checkout, redirecciones y errores

- Solo se navega a un checkout con estado `ready`, HTTPS, sin credenciales, puerto 443/default, URL acotada y host exacto de una allowlist. Se rechazan hosts por sufijo, comodines, IPs, espacios, caracteres de control y cualquier otro esquema.
- El adaptador remoto debe sincronizar el carrito inmediatamente antes de crear checkout y devolver el carrito autoritativo. Una discrepancia de precio, cantidad, stock o línea debe comunicarse y, si es impeditiva, bloquear la salida.
- Las URLs de retorno se interpretan como estados cerrados; nunca se usa un parámetro de usuario como destino de redirección.
- Los mensajes públicos son genéricos y no incluyen cuerpos GraphQL, stack traces, IDs de infraestructura, cabeceras, tokens ni excepciones internas. El código cliente no registra en consola. Los logs de servidor, cuando existan, deben usar campos estructurados y redacción por nombre (`authorization`, `token`, `cookie`, `password`, `secret`, `email`) antes de enviarse a un proveedor.

## Formularios y datos personales

- El formulario actual apunta a una ruta local todavía no implementada, limita nombre, email y mensaje en HTML y bloquea el envío; sus controles no tienen `name`, por lo que una degradación sin JavaScript tampoco transmite datos personales. Antes de activarlo, el servidor debe limitar el cuerpo total, aceptar solo el content type previsto, volver a validar longitudes y enum de asunto, normalizar email, aplicar rate limiting/antiabuso y protección CSRF u origen según la arquitectura elegida.
- El contenido se trata como texto, no HTML. Las salidas se escapan en su contexto. No se incluyen datos del formulario en URLs, analítica o logs.
- Solo se pedirán datos necesarios para responder la consulta o completar la operación. No se solicitan contraseñas ni datos de pago. Deben definirse retención, borrado, encargados y acceso antes de activar el endpoint.
- No se implementará autenticación, hashing de contraseñas, cifrado de datos ni protocolos criptográficos propios. Se usarán capacidades mantenidas del proveedor y primitivas estándar del runtime.

## Cabeceras y CSP

`vercel.json` aplica CSP, HSTS, `nosniff`, denegación de framing, referrer policy y Permissions Policy. La CSP refleja las necesidades actuales: scripts propios; estilos propios y hojas de fuentes aprobadas; fuentes de Google/Fontshare; imágenes propias, `data:` para texturas existentes y Unsplash; sin frames, objetos ni conexiones externas.

`style-src` conserva temporalmente `'unsafe-inline'` porque la interfaz usa atributos `style` para posición de imagen y muestras de color. `script-src` no permite `'unsafe-inline'`; el build fuerza los módulos ejecutables a archivos propios para que la política sea compatible. Cada servicio futuro debe justificar y añadir únicamente sus orígenes exactos a la directiva mínima necesaria. La política debe probarse primero en preview y comprobarse en la respuesta HTTP real; un `<meta>` no sustituye cabeceras de plataforma.

## Dependencias y validación

- Bun está fijado en `packageManager`; usa `bun install --frozen-lockfile` para evitar resolver versiones distintas.
- `bun run audit:dependencies` revisa dependencias conocidas como vulnerables; cada excepción debe documentar paquete, alcance, mitigación, propietario y fecha de caducidad.
- No se imprimen variables de entorno ni respuestas externas completas en logs. Los artefactos de build se vuelven a escanear después de compilar.

## Checklist para activar una integración

1. Confirmar dueño, entorno, scopes mínimos, cuota, hosts y política de rotación.
2. Crear credenciales distintas para preview y producción en el gestor de secretos, nunca en archivos locales compartidos.
3. Implementar la frontera servidor/BFF same-origin: cliente neutral → endpoints acotados → servicio servidor → Storefront Cart API.
4. Añadir hosts exactos a la allowlist y a la directiva CSP mínima; probar URLs adversariales.
5. Validar y limitar respuestas/payloads antes de mapearlos al dominio; no exponer campos administrativos.
6. Probar carrito falsificado, stock/precio cambiado, checkout caducado, errores redactados, rate limiting y ausencia de PII en almacenamiento/logs.
7. Ejecutar `bun run validate`, `bun run audit:dependencies` y verificar las cabeceras sobre el deployment de preview.
8. Documentar procedimiento de revocación y rollback al adaptador demo antes de habilitar producción.
