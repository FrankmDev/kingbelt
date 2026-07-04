# KingBelt

Web Astro para la base de marca de KingBelt, preparada para escalar a ecommerce con Shopify.

## Estructura

```text
src/
  components/
    common/     Componentes editoriales compartidos
    layout/     Header, footer y shell visual
    ui/         Primitivas de interfaz reutilizables
  data/         Navegación, home y configuración de marca
  layouts/      Layout base con SEO, fuentes y globals
  pages/        Rutas Astro
  sections/     Secciones de home
  styles/       Estilos globales y tokens Tailwind
```

## Comandos

```sh
bun install
bun run dev
bun run build
bun run astro check
```

## Convenciones

- Las páginas deben orquestar datos, SEO y layout; la UI vive en `components/` o `sections/`.
- Los tokens visuales globales están en `src/styles/global.css`.
- La integración de catálogo y checkout se añadirá desde cero con Shopify.
