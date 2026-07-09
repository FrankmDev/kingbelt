# AGENTS.md — KingBelt

Este documento es de lectura obligatoria antes de crear, tocar o rehacer
cualquier componente visual del proyecto. Si vas a escribir CSS, Astro,
copy o estructurar una sección, empieza por aquí. Si algo que vas a hacer
contradice este documento, para y pregunta antes de continuar.

---

## 1. Qué es KingBelt

Marca ecommerce inicialmente centrada en cinturones, pensada desde el
día uno para escalar a ropa y accesorios. No es una landing ni un
placeholder: es una arquitectura frontend real (Astro + Shopify a
futuro), con datos modelados de forma genérica (`Product`, no `Belt`).

KingBelt es una marca masculina de accesorios inspirada en el universo
moto. La moto es **contexto y actitud**, no el producto. El cinturón,
la hebilla, el cuero: eso es el producto y siempre debe ser el
protagonista visual.

---

## 2. Dirección estética objetivo (ACTUALIZADA)

Esto sustituye cualquier ambigüedad de versiones anteriores del brief:

> **KingBelt tiene que sentirse como una ecommerce moderna, limpia y
> editorial — el nivel de acabado de Zara, Mango o Sfera — pero
> aplicada al universo moto/leather gear en vez de moda genérica.**

Eso significa, en términos concretos:

- **Fotografía y producto por delante de la decoración.** Zara/Mango no
  llenan sus tarjetas de texturas, sombras dobles y grabados. Dejan que
  la imagen del producto y el espacio en blanco (o "espacio en negro
  asfalto", en nuestro caso) hagan el trabajo.
- **Grids limpias, tipografía con jerarquía clara, mucho aire.** Nada de
  amontonar iconos decorativos, esquineras, puntitos y líneas de
  cosido en cada componente solo porque "queda temático".
- **La estética industrial (asphalt/steel/graphite) es la que aporta
  el carácter moto — no el cuero por sí solo.** Si cada tarjeta lleva
  grano de cuero y sombra cálida, todo el sitio vuelve a leer
  "marroquinería", que es justo lo que hay que evitar (ver brief
  original, §5).
- Mantenemos la base visual que ya existe y que al usuario **le gusta
  a nivel de paleta y tipografía** (bone + bronce + asfalto, Bitter +
  Satoshi). No se trata de rehacer el sistema desde cero, sino de
  **redistribuir dónde se aplica cada textura** y **subir el nivel de
  ejecución** para que compita con una ecommerce real, no con un
  moodboard.

### La proporción visual del brief original se mantiene como referencia:

- 45% retail masculino (limpio, tipográfico, producto)
- 25% ecommerce editorial (grids, fotografía, espacio)
- 20% motorcycle lifestyle (asfalto, garaje, steel)
- 10% cuero/producto (grano, cosido, hardware — solo donde hay producto real)

Esa última cifra, 10%, es literal: la textura de cuero debe aparecer en
el 10% de las superficies del sitio, no en el 90%.

---

## 3. Qué evitar (sigue vigente, sin cambios)

Nunca:
calaveras, fuego, carbono, neumáticos como textura, cadenas decorativas,
motores como fondo, iconos biker genéricos, exceso de negro, exceso de
marrón, estética Harley/motera de los 2000, plantilla WooCommerce
básica, diseño WordPress, marca rústica, marroquinería delicada tipo
atelier/museo, papel/pergamino, dorado lujo, cognac como color
protagonista.

Nuevo, derivado de la auditoría del sistema actual:
- Grano de cuero (`kb-texture-leather`, sombra `inset-leather`) como
  default de cualquier card/panel genérico. Ver §5.
- Más de un tono cálido dominando una grid entera. Si cinco cards
  seguidas son todas crema+bronce, falta alternancia steel/graphite.
- Headings en peso regular/light en tamaños grandes (h1/h2). Un slab
  serif fino en tamaño hero lee "editorial delicado", no "retail".

---

## 4. Sistema de diseño — fuente única de verdad

El archivo `global.css` es la única fuente de tokens (color, tipografía,
espaciado, sombra, radio). Ningún componente debe hardcodear un hex,
una sombra o un tamaño de fuente que ya exista como variable. Si hace
falta un valor nuevo, se añade como token en `global.css`, no inline.

### 4.1 Paleta — roles, no solo nombres

| Token | Rol |
|---|---|
| `--color-king-bg` | Fondo funcional de página (claro) |
| `--color-king-bone` | Tono de marca/material (ligeramente distinto de bg) |
| `--color-king-surface` | Superficie de card/panel clara |
| `--color-king-text` | Texto principal |
| `--color-king-muted` | Texto secundario, metadatos |
| `--color-king-accent` | Bronce — CTAs, acentos, hover. Uso moderado |
| `--color-king-accent-light` | Tobacco claro — solo detalles pequeños, nunca superficies grandes (riesgo cognac) |
| `--color-king-asphalt` / `--color-king-oil` | Negro cálido — secciones full-bleed oscuras |
| `--color-king-graphite` | Base de la familia "steel" — cards oscuras dentro de secciones claras |
| `--color-king-steel` | Gris frío — texto/bordes sobre superficies steel, tags técnicos |
| `--color-king-brass` | Detalle metálico puntual (hardware, rivets) |

### 4.2 Familia de superficies — cuándo usar cada una

- **`kb-card` / `kb-panel`** → el default. 80% del contenido: blog,
  features, formularios, stats, la mayoría de tarjetas de producto.
  Superficie clara, inset neutro, sin grano.
- **`kb-card-steel` / `kb-panel-steel`** → superficie graphite
  autocontenida, usable dentro de una sección clara para romper el
  ritmo. Úsala en 1 de cada 4-5 elementos de una grid, o para destacar
  un item (producto en oferta, feature principal, testimonio).
- **`kb-card-dark`** → variante translúcida, pensada para usarse ya
  dentro de `section-asphalt` / `section-steel` (no como pieza aislada
  sobre fondo claro).
- **`.kb-leather` (modificador)** → añade grano de cuero + sombra
  cálida. Se apila sobre `kb-card`/`kb-panel`. Reservado
  exclusivamente para contexto de producto de cuero real: ficha de
  producto, selector de color/material, packaging. Nunca en
  BlogCard, FeatureCard, StatBlock, ContactMethod, etc.

### 4.3 Tipografía — jerarquía y peso

- **Bitter (serif slab)** → hero, titulares de sección, momentos de
  marca. H1 en peso 700, H2 en 600. Esto es lo que da carácter
  "retail" en vez de "editorial suave". H4/H5 se mantienen ligeros
  para metadatos y títulos de card pequeños.
- **Satoshi (sans)** → todo lo demás: navegación, botones, precios,
  specs, filtros, labels, body copy. Debe ganar presencia en cualquier
  contexto de producto/ecommerce.
- Los estilismos raros (demasiado tracking, demasiadas mayúsculas en
  bloques largos) se reservan para eyebrows/labels de una línea, nunca
  para párrafos.

### 4.4 Reglas de composición tipo Zara/Mango, aplicadas

- Un solo H1 por página, jerarquía de headings correcta.
- Prioriza layouts de imagen grande + poco texto en vez de bloques
  densos de texto decorado.
- El espacio en blanco (o "espacio asfalto" en secciones oscuras) es
  parte del diseño, no un vacío que rellenar con más textura.
- Grids de producto: foto al 90% del peso visual de la card, tipografía
  de precio/nombre discreta y precisa (Satoshi, no Bitter).

---

## 5. Auditoría del sistema actual — resumen de cambios aplicados

Esto documenta lo que ya se corrigió en `global.css` para que cualquier
IA entienda el porqué de las nuevas clases y no las revierta:

1. Se creó la familia **steel/graphite** (`kb-card-steel`,
   `kb-panel-steel`, `kb-badge-steel`, `kb-tag-steel`,
   `.text-king-steel`) porque `--color-king-steel` y
   `--color-king-oil` estaban definidos pero no se usaban en ningún
   componente real — todo el peso industrial vivía solo en fondos
   full-bleed.
2. El grano de cuero y su sombra (`--kb-shadow-inset-leather`,
   `.kb-texture-leather`) dejaron de ser el default de
   `kb-card`/`kb-panel`/`kb-card-static`/`kb-card-dry`. Ahora requieren
   la clase `.kb-leather` explícita.
3. `--color-king-accent-light` se ajustó (era demasiado cercano a
   cognac). Sigue existiendo para detalles puntuales, no para
   superficies.
4. Fix de typo: `--kbd-badge-radius` → `--kb-badge-radius`.
5. `--color-king-bone` ya no es un alias exacto de `--color-king-bg`.
6. H1/H2 subieron de peso (400 → 700/600 respectivamente) para leer
   "retail" en vez de "editorial delicado".
7. Revisión general de accesibilidad y consistencia en componentes del
   Style Museum: se añadieron tokens tipográficos `--kb-text-sm`,
   `--kb-text-xs` y `--kb-text-2xs`; se corrigieron textos con opacidad
   insuficiente sobre fondos claros/oscuros; se ajustaron títulos de
   tarjetas (BlogCard, FeatureCard) al sistema de tokens; se implementó
   el pull-quote y drop-cap reales en Prose; y se forzó
   `overflow-hidden` en Card/Panel para respetar el radio de borde.

Si vas a rehacer un componente y ves que usa `kb-shadow-inset-leather`
o `kb-texture-leather` sin que el componente muestre producto de cuero
real, es una señal de que ese componente hereda un patrón antiguo y
debe migrarse al inset neutro (`--kb-shadow-inset-soft`) o a una
variante steel.

---

## 6. Stack técnico

- Astro + TypeScript + Tailwind CSS + CSS global propio.
- Astro estático por defecto. No usar React salvo necesidad real de
  interactividad (carrito, filtros dinámicos, etc.).
- Capa de datos desacoplada: `páginas/componentes → src/lib/commerce/
  → Shopify Storefront API` (futuro). Nunca llamar a Shopify
  directamente desde un componente.
- Modelo de producto genérico: `Product`, `ProductVariant`,
  `ProductOption`, `ProductImage`, `Collection`, `Money`, `Cart`,
  `CartItem`. Nunca un modelo tipo `Belt`.
- No usar `any`. No hardcodear datos globales dentro de componentes
  reutilizables. No mezclar lógica de datos con presentación si se
  puede evitar.

### Estructura de carpetas de referencia

```
src/
  components/{layout,ui,sections,blog,contact,product,collection,cart}/
  data/{site,navigation,homepage,blog,contact}.ts (+products/collections futuro)
  lib/commerce/{types,local,mapper}.ts (+shopify futuro)
  lib/{seo,utils}.ts
  layouts/BaseLayout.astro
  pages/{index,about,blog/,contacto}.astro (+colecciones/,producto/,carrito futuro)
  styles/globals.css
```

---

## 7. Fases del proyecto (contexto, no cambia el trabajo de hoy)

1. **Base editorial/corporativa** (actual): Inicio, About, Blog,
   Artículo, Contacto. Consolidar identidad visual y componentes base.
2. **Base ecommerce mock**: colecciones, producto individual, carrito
   placeholder, con datos locales.
3. **Shopify**: productos reales, Storefront API, carrito → checkout.
4. **Ecommerce real**: pagos, pedidos, emails, SEO, analítica, legal,
   QA, lanzamiento.

No construir todavía `ProductCard`, `ProductGrid`, `CollectionCard`,
`CartDrawer`, `CheckoutSummary`, `LoginForm`, `FilterBar`, etc. — eso
es fase 2+. Ahora mismo el foco son los componentes base de página
(header, footer, hero, cards genéricas, badges, tags, botones,
formularios, tipografía) con el sistema visual correcto.

---

## 8. Definition of done — checklist antes de dar por bueno un componente

Antes de considerar terminado cualquier componente o sección, comprueba:

- [ ] ¿Usa tokens de `global.css` (color, radio, sombra, tipografía) en
      vez de valores hardcodeados?
- [ ] Si es una card/panel genérica (no producto de cuero), ¿usa el
      inset neutro y NO lleva `.kb-leather` ni `kb-texture-leather`?
- [ ] Si es una grid de 3+ elementos, ¿hay al menos una pieza en
      variante steel/graphite para romper el monocromatismo crema?
- [ ] ¿El heading principal del componente usa el peso correcto según
      su nivel (h1 hero = 700, h2 sección = 600, h4/h5 = ligero)?
- [ ] ¿Hay un único H1 en la página y la jerarquía de headings es
      correcta?
- [ ] ¿La imagen/producto tiene más peso visual que la decoración
      (esquineras, puntos, líneas de cosido)?
- [ ] ¿Cumple accesibilidad básica? (alt en imágenes, labels en
      formularios, focus visible, contraste suficiente, botones y
      enlaces semánticamente correctos)
- [ ] ¿SEO básico cubierto si es una página? (title, description, un
      H1, URLs limpias)
- [ ] ¿El componente evita literalmente todo lo listado en §3?
