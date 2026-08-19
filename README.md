# KingBelt

Frontend de KingBelt construido con Astro 7.2, TypeScript estricto, Tailwind CSS 4 y Bun, con renderizado server-side en Vercel y catálogo Shopify Storefront consultado bajo demanda. La base editorial y el sistema visual están preparados para evolucionar hacia Shopify sin acoplar la interfaz al proveedor de comercio.

## Requisitos

- Bun 1.3.14 o superior.
- Node.js 22.12 o superior, preferiblemente una versión LTS par.

## Configuración local

1. Copia `.env.example` a `.env`.
2. Mantén `COMMERCE_SOURCE=demo` para trabajar sin Shopify.
3. Usa `COMMERCE_SOURCE=shopify` únicamente cuando también hayas configurado las variables Shopify necesarias.

`COMMERCE_SOURCE` es obligatoria y solo acepta `demo` o `shopify`. Se configura en las variables de entorno de cada deployment —nunca en `vercel.json`— y no se infiere de `VERCEL_ENV`, hostname, rama ni credenciales.

| Entorno | `COMMERCE_SOURCE` | Credenciales |
| --- | --- | --- |
| Desarrollo local | `demo` | Ningún secreto Shopify obligatorio |
| Preview / PR (sin staging) | `demo` | Sin credenciales de producción |
| Staging | `shopify` | Solo las de la tienda de staging |
| Production | `shopify` | Solo las de la tienda de producción |

En Vercel, el carrito Shopify persiste el Cart ID en el store de sesiones de Astro (`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`). El navegador solo recibe una cookie de sesión opaca.

## Despliegue en Vercel

Crea las variables en el proyecto de Vercel (Settings → Environment Variables). `COMMERCE_SOURCE` es `astro:env` de cliente y se incrusta en el build: un cambio exige redesplegar. No las pongas en `vercel.json`.

| Variable | Lectura | Build / runtime | Formato | Entornos |
| --- | --- | --- | --- | --- |
| `COMMERCE_SOURCE` | `import.meta.env` vía `astro:env/client` | Build (pública de cliente) | `demo` o `shopify` | Todos. Production y staging: `shopify`. Preview/local sin tienda: `demo` |
| `SHOPIFY_STORE_DOMAIN` | `astro:env/server` | Build y runtime (pública de servidor) | hostname `tu-tienda.myshopify.com` | Production y Preview/staging con `COMMERCE_SOURCE=shopify` |
| `SHOPIFY_API_VERSION` | `astro:env/server` | Build y runtime | `2026-07` (valor por defecto) | Los mismos que Shopify |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | `astro:env/server` | Runtime (secreto) | token privado Headless, sin espacios ni comillas | Los mismos que Shopify |
| `UPSTASH_REDIS_REST_URL` | `process.env` en el session driver | Runtime | URL REST de Upstash | Production y Preview en Vercel |
| `UPSTASH_REDIS_REST_TOKEN` | `process.env` en el session driver | Runtime | token REST de Upstash | Production y Preview en Vercel |
| `SHOPIFY_WEBHOOK_SECRET` | `astro:env/server` | Runtime (secreto, opcional) | secreto HMAC del webhook | Solo si activas el rebuild |
| `VERCEL_DEPLOY_HOOK_URL` | `astro:env/server` | Runtime (secreto, opcional) | URL del Deploy Hook | Solo si activas el rebuild |

`SHOPIFY_STORE_DOMAIN` es el hostname de la tienda en Shopify, no el dominio público del sitio:

```text
SHOPIFY_STORE_DOMAIN=tu-tienda-real.myshopify.com
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=...
COMMERCE_SOURCE=shopify
```

No uses `https://`, barra final, `admin.shopify.com`, `kingbelt.es` ni comillas. El Storefront GraphQL no acepta el dominio público. El nombre `SHOPIFY_STOREFRONT_ACCESS_TOKEN` no existe en este proyecto.

Tras crear o corregir variables: Redeploy del deployment en el dashboard de Vercel, o un push a la rama conectada. Un deployment Ready previo no relee variables de cliente hasta reconstruirse.

## Comandos

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
bun run build
bun run check:links
bun run check:perf
bun run validate
bun run preview
```

Antes de integrar cambios:

```sh
bun run validate
```

`bun run validate` es la suite autoritativa: auditoría de dependencias, escaneo de secretos en fuentes e historial, check de Astro/TypeScript, build, tests, escaneo del build, enlaces internos, presupuestos de rendimiento y la ficha renderizada de 76 variantes. El job `quality` de GitHub Actions ejecuta la misma suite en cada Pull Request y en `push` a `main`, con `COMMERCE_SOURCE=demo` y sin credenciales Shopify. Instala dependencias una sola vez con `bun install --frozen-lockfile` y después corre `bun run validate`.

## Estructura

```text
src/
├── session-driver.ts        Store de sesiones Astro (Upstash en Vercel, disco en local)
├── commerce/
│   ├── domain/              Modelos y reglas comerciales puras
│   ├── application/         Puertos, casos de uso y validación
│   ├── infrastructure/demo/ Adaptadores del ecommerce de demostración
│   ├── infrastructure/shopify/ Gateway, catálogo y carrito de Storefront API
│   ├── commerce-source.ts      Selección explícita y tipada del proveedor
│   ├── catalog.ts           Proveedor de catálogo activo
│   ├── cart.ts              Proveedor de carrito activo
│   └── cart-server.ts       Composición del carrito servidor (BFF)
├── components/
│   ├── faq/                 Presentación de preguntas frecuentes
│   ├── layout/              Header y footer
│   ├── ui/                  Primitivas reutilizables
│   ├── blog/                Composición del dominio editorial
│   ├── sections/
│   │   ├── home/            Secciones de portada
│   │   ├── about/           Secciones corporativas
│   │   └── contact/         Secciones de contacto
│   ├── product/             Dominio de producto
│   ├── collection/          Dominio de catálogo
│   ├── cart/                Interfaz del carrito local
│   ├── help/                Centro de ayuda
│   └── legal/               Documentos legales y desistimiento
├── config/                  Configuración y hechos empresariales
├── content/                 Contenido editorial tipado
├── demo-catalog.ts          Datos ficticios aislados de producción
├── layouts/                 Documento y metadata global
├── pages/                   Rutas y orquestación
├── scripts/                 Interacción cliente; ecommerce en scripts/commerce
├── shared/                  Utilidades compartidas (browser, SEO, seguridad)
└── styles/                  Tokens, globals y estilos de dominio
```

## Convenciones

- Las páginas seleccionan datos, definen SEO/schema y ordenan secciones; la presentación vive en componentes.
- `src/styles/global.css` es la fuente de verdad de tokens, base y patrones compartidos.
- `src/commerce/application` define contratos neutrales; `src/commerce/catalog.ts` y `src/commerce/cart.ts` seleccionan los adaptadores activos fuera de los componentes.
- No hay barrels `index.ts`: los imports identifican la dependencia concreta.
- `tests/architecture.test.mjs` impide dependencias desde dominio/aplicación hacia infraestructura y desde UI hacia adaptadores o datos demo.
- El proyecto renderiza bajo demanda con `output: 'server'` y el adapter `@astrojs/vercel`; solo los artículos del blog se prerenderizan. No usa frameworks de UI ni Advanced Routing.
- La Dev Toolbar de Astro (astronauta) está desactivada en `astro.config.mjs`.
- Usa Bun exclusivamente; el lockfile válido es `bun.lock`.

Lee `AGENTS.md` antes de modificar el proyecto y carga `docs/DESIGN.md`, `docs/ARCHITECTURE.md` o `docs/PROJECT.md` según el alcance.

Preparación y activación Shopify: `docs/SHOPIFY_READINESS.md`.  
Política de secretos, checkout, CSP, cabeceras, formularios y CI: `docs/SECURITY.md`. No conectes credenciales reales sin completar su checklist de activación.

## Rutas de ayuda y legal

| Ruta | Estado |
|------|--------|
| `/ayuda` | Publicada |
| `/guia-de-tallas` | Publicada (tabla pendiente de datos) |
| `/cuidados` | Publicada |
| `/envios-y-devoluciones` | Borrador |
| `/aviso-legal` | Borrador |
| `/privacidad` | Borrador |
| `/cookies` | Borrador |
| `/condiciones` | Borrador |
| `/desistimiento` | Inactivo (revisión interna) |

Detalle de activación: `docs/BUSINESS_AND_LEGAL_REQUIREMENTS.md`.

La validación local se ejecuta con `bun run validate` usando la versión de Bun declarada en `packageManager`. Es la misma barrera que GitHub Actions aplica antes de integrar.
