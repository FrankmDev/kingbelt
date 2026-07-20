# Starter audit

Auditoría realizada sobre el proyecto anfitrión antes de construir este starter.

## Clasificación

### 1. Reutilizable y neutral

- Astro estático por defecto con TypeScript estricto.
- Páginas delgadas que coordinan datos, SEO y orden de secciones.
- Props tipadas, `class:list`, slots y atributos HTML reenviados cuando aportan valor.
- Separación entre páginas, layouts, componentes, datos y lógica de integración.
- HTML semántico, un único `h1`, foco visible, labels persistentes y soporte de movimiento reducido.
- Recursos procesables dentro de `src/` y archivos públicos solo cuando deben servirse sin transformación.
- Utilidades de composición reutilizables y tokens globales solo para decisiones compartidas.

### 2. Reutilizable después de adaptarlo

- El layout base se separa en `BaseLayout`, `SEO`, `JsonLd`, `SkipLink` y `PageShell`.
- El CSS global se reduce a un único `globals.css` intencional: Tailwind, tema, base y accesibilidad.
- Los shells y ritmos de sección se convierten en primitivas neutrales `Container` y `Section`.
- El tratamiento manual de imágenes se sustituye por `astro:assets` y una primitiva responsive.
- Los datos globales se convierten en configuración tipada de sitio, navegación, SEO y funcionalidad.
- El proceso documental se normaliza en responsabilidades de proyecto, diseño, arquitectura, contenido, páginas y QA, sin scripts generadores.

### 3. Específico del proyecto anfitrión

- Marca, copy, dominio, productos, catálogo, blog, imágenes, iconografía y rutas comerciales.
- Paleta, tipografías, texturas, superficies, nombres de tokens y motion reconocible.
- Header, Footer, heroes, secciones, cards editoriales y componentes de negocio terminados.
- Integraciones y modelos preparados para un comercio concreto.

### 4. Deuda técnica que no debe copiarse

- Un `global.css` de miles de líneas que mezcla reset, tokens, primitivas y componentes.
- Comentarios históricos y changelogs incrustados en CSS de producción.
- Dependencia base de Tailwind y GSAP pese a que no son necesarias en la mayoría de proyectos.
- SVGs por nombre con fallback silencioso y contenido HTML inyectado sin contrato estricto.
- Fuentes remotas y metadatos de marca acoplados al layout.
- Falta de aliases, sitemap y una validación técnica consistente.

## Dependencias

### Conservadas

- `astro`
- `typescript`
- `@astrojs/check`

### Añadidas al núcleo

- `@astrojs/sitemap`
- `tailwindcss`
- `@tailwindcss/vite`

### Eliminadas del núcleo

- `gsap`
- Frameworks de UI, CMS, ecommerce, analítica y validadores complejos

Estas capacidades se añaden por proyecto únicamente cuando son necesarias.

## Decisiones arquitectónicas

- Cuatro capas explícitas: núcleo, configuración, sistema visual generado y componentes específicos.
- `project.config.ts` es la fuente principal de inicialización.
- `PROJECT_START.md` gobierna la inicialización y los protocolos posteriores.
- Bun instala desde un lockfile sin scripts intermedios de configuración.
- Astro 7, Tailwind 4 mediante el plugin oficial de Vite, salida estática, alias `@/`, sitemap y responsive images con `astro:assets`.
- `src/styles/globals.css` es la única hoja CSS; los componentes usan utilidades Tailwind.
- La automatización de navegador se excluye del núcleo: se instala por proyecto únicamente cuando el riesgo y el proceso de entrega la justifican.
- Los proyectos sin inicializar publican `noindex` y bloquean rastreo hasta superar el protocolo de validación.
- El starter incluye una página foundation mínima y 404, no una web comercial terminada.
