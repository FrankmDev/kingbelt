# KingBelt

Frontend de KingBelt construido con Astro 7.2, TypeScript estricto, Tailwind CSS 4 y Bun, con renderizado server-side en Vercel y catálogo Shopify Storefront consultado bajo demanda. La base editorial y el sistema visual están preparados para evolucionar hacia Shopify sin acoplar la interfaz al proveedor de comercio.

## Requisitos

- Bun 1.3.14 o superior.
- Node.js 22.12 o superior, preferiblemente una versión LTS par.

## Configuración local

1. Copia `.env.example` a `.env`.
2. Mantén `COMMERCE_SOURCE=demo` para trabajar sin Shopify.
3. Usa `COMMERCE_SOURCE=shopify` únicamente cuando también hayas configurado las variables Shopify necesarias.

`COMMERCE_SOURCE` es obligatoria y solo acepta `demo` o `shopify`. Las credenciales Shopify no activan ningún proveedor por sí solas.

## Comandos

```sh
bun install
bun run dev
bun run check
bun run test
bun run build
bun run check:links
bun run check:perf
bun run validate
bun run preview
```

`bun run validate` ejecuta instalación congelada, auditoría de dependencias, escaneo de fuentes e historial, check de Astro/TypeScript, build, tests, escaneo del build, enlaces internos y presupuestos de rendimiento —incluida la ficha renderizada de 76 variantes—.

## Estructura

```text
src/
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

La validación local se ejecuta con `bun run validate` (check, tests, build, enlaces internos y presupuestos de rendimiento) usando la versión de Bun declarada en `packageManager`.
