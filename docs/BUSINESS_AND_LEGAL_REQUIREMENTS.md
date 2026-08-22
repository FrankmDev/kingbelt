# Datos empresariales y requisitos legales — KingBelt

> **Alcance del gate:** CintuElx S.L. declaró definitivos los textos legales el 22/08/2026. El preflight verifica facts, estado, contenido y ausencia de marcadores; no sustituye una revisión jurídica humana ni certifica automáticamente la validez de cada cláusula.

## Estado del sistema

KingBelt utiliza un contrato tipado en `src/config/business.ts` para diferenciar información **confirmada** (`confirmed`), **pendiente** (`pending`) y **no aplicable** (`not-applicable`).

Los valores pendientes:
- **no se renderizan** en contenido público;
- **no aparecen** en metadata, footer, FAQ ni copy;
- pueden activarse confirmando el hecho en `businessFacts` sin editar múltiples componentes.

La frontera de lanzamiento está en `src/config/legal-readiness.ts` y `bun run legal:preflight`. `bun run validate` comprueba el código del gate, no que los datos comerciales ya estén completos.

Las políticas publicadas en Astro se declararon reconciliadas con Shopify Admin el 22/08/2026. El registro no sustituye una nueva comprobación manual si cualquiera de las dos versiones cambia.

## Checklist para la empresa

### Identidad y contacto

- [x] Razón social / denominación — CintuElx S.L. (`confirmed`)
- [x] Nombre comercial — Kingbelt (`confirmed`)
- [x] NIF/CIF — B42696716 (`confirmed`)
- [x] Domicilio social — Avenida de Novelda, 143, bajo, 03206 Elche (Alicante), España (`confirmed`)
- [x] Email legal y de atención — contabilidad@cintuelx.com (`confirmed`)
- [x] Teléfono de atención — 965 43 01 51 (`confirmed`)
- [x] Web — https://kingbelt.es (`confirmed`)
- [x] Datos registrales — Registro Mercantil de Alicante, sección 8, hoja A-168894, inscripción 3 (`confirmed`; BORME 02/01/2026)
- [x] Actividad — fabricación y comercio de calzado, marroquinería y complementos de vestir (`confirmed`; BORME 21/02/2020)

Fuentes registrales: [cambio de domicilio e inscripción vigente](https://www.boe.es/borme/dias/2026/01/02/pdfs/BORME-A-2026-1-03.pdf) y [constitución/objeto social](https://www.boe.es/borme/dias/2020/02/21/pdfs/BORME-A-2020-36-03.pdf).

### Comercio y operación

Los importes, plazos y métodos deben coincidir con Shopify Admin. No inventarlos aquí ni en copy público. El checklist operativo está en `docs/SHOPIFY_LAUNCH_OPERATIONS.md`. Una contradicción entre estas páginas y Checkout es MANUAL BLOCKER.

- [x] Territorios de venta — destinos habilitados en checkout
- [x] Política fiscal — comunicación antes de confirmar la compra
- [x] Métodos de pago y vía de reembolso — métodos del checkout; reembolso al mismo medio salvo acuerdo válido
- [x] Transportistas — empresa propuesta, seleccionada o contratada por Kingbelt
- [x] Costes de envío — incluidos en el precio del producto
- [x] Plazo de preparación — integrado en la estimación comunicada al cliente
- [x] Plazo de entrega — estimación por pedido; máximo general de 30 días salvo acuerdo distinto
- [x] Política y plazo comercial de devoluciones — 14 días legales ampliados a 30
- [x] Garantía y texto de conformidad
- [x] Ley aplicable y jurisdicción del consumidor
- [ ] Dirección logística fija para devoluciones (`returnAddress`, manual y no publicada): se comunica con las instrucciones; no se identifica con el domicilio social

### Claims de marketing (activables vía `businessFacts`)

- [ ] Origen de fabricación (`madeInSpain`)
- [ ] Embalaje incluido (`packagingIncluded`)
- [x] Envío gratuito (`freeShipping`)
- [ ] Compromiso de tiempo de respuesta (`responseTime`)

### Privacidad y datos

- [x] Responsable del tratamiento y domicilio aplicable
- [x] Finalidades del tratamiento
- [x] Bases jurídicas por finalidad
- [x] Plazos o criterios de conservación
- [x] Categorías de destinatarios
- [x] Transferencias internacionales y garantías
- [x] Inventario de cookies y tecnologías declarado en la política

## Documentos legales

| Ruta | Estado | Robots | Sitemap |
|------|--------|--------|---------|
| `/aviso-legal` | published | index | Incluido |
| `/privacidad` | published | index | Incluido |
| `/cookies` | published | index | Incluido |
| `/condiciones` | published | index | Incluido |
| `/envios-y-devoluciones` | published | index | Incluido |
| `/devoluciones` | published | index | Incluido |
| `/desistimiento` | inactivo | noindex,nofollow | Excluido |

### Activar un documento

1. Completar los `businessFacts` requeridos para cada sección.
2. Revisar y aprobar el texto con asesor legal.
3. Cambiar `status: 'published'` en `src/content/legal.ts` solo cuando el texto sea definitivo, sin placeholders ni secciones pending.
4. `robots` y el sitemap se actualizan desde ese estado. El footer solo lista `published`.
5. `bun run legal:preflight` debe pasar. Un FAIL por datos pendientes exige verificación manual y actualización de `business.ts` / documentos. No desactivar el gate.

Los borradores no aparecen en navegación pública. El footer y el sitemap solo incluyen documentos `published`.

## Mecanismo de desistimiento

- El desistimiento puede comunicarse a `contabilidad@cintuelx.com` o por correo postal al domicilio social. `/devoluciones` contiene el modelo y el procedimiento publicados.
- La dirección logística para remitir el producto se facilita con las instrucciones de devolución y no se presupone que coincida con el domicilio social.
- `/desistimiento` permanece inactive: el formulario Astro independiente no es la vía pública ni un requisito de lanzamiento por sí solo.

## Páginas de ayuda

| Ruta | Indexable | Notas |
|------|-----------|-------|
| `/ayuda` | Sí | Portada del centro de ayuda |
| `/guia-de-tallas` | Sí | Tabla pendiente de datos por modelo |
| `/cuidados` | Sí | Recomendaciones generales |
| `/envios-y-devoluciones` | Sí | Política publicada |

## SEO

- Sitemap: `@astrojs/sitemap` → `/sitemap-index.xml`
- Robots: `src/pages/robots.txt.ts`
- Exclusiones: `/404`, `/carrito`, `/cart-catalog.json`, `/cuenta/iniciar`, `/rss.xml`, `/desistimiento`, documentos draft. El sitemap de comercio solo lista catálogo con `COMMERCE_SOURCE=shopify`.

## Cómo confirmar un dato

En `src/config/business.ts`:

```typescript
madeInSpain: {
  status: 'confirmed',
  value: 'España',
  source: 'Documento interno / certificación',
},
```

Los componentes que consumen `publicHighlights()` o `confirmed()` mostrarán el valor automáticamente.
