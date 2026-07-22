# KingBelt

Frontend estático de KingBelt construido con Astro 7.1, TypeScript estricto, Tailwind CSS 4 y Bun. La base editorial y el sistema visual están preparados para evolucionar hacia Shopify sin acoplar la interfaz al proveedor de comercio.

## Requisitos

- Bun 1.3 o superior.
- Node.js 22.12 o superior, preferiblemente una versión LTS par.

## Comandos

```sh
bun install
bun run dev
bun run check
bun run test
bun run build
bun run validate
bun run preview
```

## Estructura

```text
src/
├── components/
│   ├── common/              Infraestructura editorial compartida
│   ├── layout/              Header y footer
│   ├── ui/                  Primitivas reutilizables
│   ├── museum/              Documentación visual ejecutable
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
├── data/                    Contenido y configuración tipada
│   ├── business.ts          Hechos empresariales (confirmed/pending)
│   ├── help.ts              Ayuda y guías
│   └── legal.ts             Legal, cookies y sitemap
├── layouts/                 Documento y metadata global
├── lib/                     Dominio, proveedores y utilidades
├── pages/                   Rutas y orquestación
├── scripts/                 Inicialización cliente compartida
└── styles/                  Tokens, globals y estilos de dominio
```

## Convenciones

- Las páginas seleccionan datos, definen SEO/schema y ordenan secciones; la presentación vive en componentes.
- `src/styles/global.css` es la fuente de verdad de tokens, base y patrones compartidos.
- `src/lib/commerce/provider.ts` mantiene la interfaz neutral entre la UI y el proveedor local actual. Una futura integración con Shopify debe sustituirse en esa frontera, no dentro de los componentes.
- El proyecto genera HTML estático: no usa adapter, SSR, frameworks de UI ni Advanced Routing.
- Usa Bun exclusivamente; el lockfile válido es `bun.lock`.

Lee `AGENTS.md` antes de modificar el proyecto y carga `docs/DESIGN.md`, `docs/ARCHITECTURE.md` o `docs/PROJECT.md` según el alcance.

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

La validación continua vive en `.github/workflows/quality.yml` y ejecuta check, tests y build con Bun 1.3.10 en `main` y pull requests.
