# Datos empresariales y requisitos legales — KingBelt

> **Advertencia interna:** Los textos legales deben ser revisados y aprobados por un profesional antes del lanzamiento. Este documento no constituye asesoramiento legal.

## Estado del sistema

KingBelt utiliza un contrato tipado en `src/config/business.ts` para diferenciar información **confirmada** (`confirmed`), **pendiente** (`pending`) y **no aplicable** (`not-applicable`).

Los valores pendientes:
- **no se renderizan** en contenido público;
- **no aparecen** en metadata, footer, FAQ ni copy;
- pueden activarse confirmando el hecho en `businessFacts` sin editar múltiples componentes.

La frontera de lanzamiento está en `src/config/legal-readiness.ts` y `bun run legal:preflight`. `bun run validate` comprueba el código del gate, no que los datos comerciales ya estén completos.

Astro policy content must be reconciled with Shopify Admin before Payment QA. SHOPIFY POLICY CONTENT REQUIRED MANUALLY. No se declara coincidencia automática con políticas de Admin.

## Checklist para la empresa

### Identidad y contacto

- [x] Razón social / denominación — CintuElx S.L. (`confirmed`)
- [x] Nombre comercial — KingBelt (`confirmed`)
- [x] NIF/CIF — B42696716 (`confirmed`)
- [x] Dirección facilitada por la empresa (`address`; texto literal, sin función jurídica)
- [x] Domicilio social — Avenida de Novelda, 143, bajo, Elche (`registeredAddress`; Aviso Legal)
- [x] Teléfono de atención — 965 43 01 51 (`confirmed`)
- [x] Datos registrales — inscrita en el Registro Mercantil de Alicante (fuente: Aviso Legal, 18 ago 2026)
- [x] Actividad — comercialización de accesorios de cuero online (fuente: Aviso Legal)

### Comercio y operación

Los importes, plazos y métodos deben coincidir con Shopify Admin. No inventarlos aquí ni en copy público. El checklist operativo está en `docs/SHOPIFY_LAUNCH_OPERATIONS.md`. Una contradicción entre estas páginas y Checkout es MANUAL BLOCKER.

- [x] Territorios de venta — destinos habilitados en compra (fuente: Política de envíos)
- [x] Política fiscal — impuestos comunicados en el checkout; IVA no nominado (fuente: Aviso Legal / Envíos)
- [x] Métodos de pago — se muestran en el checkout; reembolso por el mismo medio (fuente: Aviso Legal / Devoluciones)
- [x] Transportistas — empresa de transporte no nominada; modalidad en compra (fuente: Política de envíos)
- [x] Costes de envío — se muestran antes de confirmar; varían (fuente: Política de envíos)
- [x] Plazo de preparación — distinto del transporte (fuente: Política de envíos)
- [x] Plazo de entrega — máximo 30 días naturales salvo otro acuerdo (fuente: Política de envíos)
- [x] Política de devoluciones — 30 días / 14 de desistimiento (fuente: Política de devoluciones)
- [x] Dirección para devoluciones — Carrús / Polígono (fuente: Política de devoluciones; distinta del texto empresarial facilitado)
- [x] Garantía legal de conformidad, no sustituida (fuente: Política de devoluciones)
- [x] Jurisdicción — legislación española (fuente: Aviso Legal)

### Claims de marketing (activables vía `businessFacts`)

- [ ] Origen de fabricación (`madeInSpain`)
- [ ] Embalaje incluido (`packagingIncluded`)
- [ ] Envío gratuito (`freeShipping`)
- [ ] Compromiso de tiempo de respuesta (`responseTime`)

### Privacidad y datos

- [x] Responsable del tratamiento — CintuElx S.L. (fuente: Política de privacidad)
- [x] Finalidades del tratamiento (fuente: Política de privacidad)
- [x] Bases jurídicas — resumen del texto publicado; no hay tabla art. 6 por finalidad
- [x] Plazos de conservación — criterios de la política publicada; sin número de años
- [x] Destinatarios (fuente: Política de privacidad)
- [x] Transferencias internacionales (fuente: Política de privacidad)
- [x] Inventario de cookies del código (sesión Shopify + localStorage demo + fonts). Checkout Shopify no inventariado.

## Documentos legales

| Ruta | Estado | Robots | Sitemap |
|------|--------|--------|---------|
| `/aviso-legal` | published | indexable | Incluido |
| `/privacidad` | published | indexable | Incluido |
| `/cookies` | published | indexable | Incluido |
| `/condiciones` | published | indexable | Incluido |
| `/envios-y-devoluciones` | published | indexable | Incluido |
| `/devoluciones` | published | indexable | Incluido |
| `/desistimiento` | inactivo | noindex,nofollow | Excluido |

### Activar un documento

1. Completar los `businessFacts` requeridos para cada sección.
2. Revisar y aprobar el texto con asesor legal.
3. Cambiar `status: 'published'` en `src/content/legal.ts` solo cuando el texto sea definitivo, sin placeholders ni secciones pending.
4. `robots` y el sitemap se actualizan desde ese estado. El footer solo lista `published`.
5. `bun run legal:preflight` debe pasar. Un FAIL por datos pendientes exige verificación manual y actualización de `business.ts` / documentos. No desactivar el gate.

Los borradores no aparecen en navegación pública. El footer y el sitemap solo incluyen documentos `published`.

## Mecanismo de desistimiento

- Vía operativa publicada: `/devoluciones` (comunicación a `contabilidad@cintuelx.com` y modelo de formulario).
- `/desistimiento` permanece inactive: no es la vía pública ni un requisito de lanzamiento por sí sola.

## Páginas de ayuda

| Ruta | Indexable | Notas |
|------|-----------|-------|
| `/ayuda` | Sí | Portada del centro de ayuda |
| `/guia-de-tallas` | Sí | Tabla pendiente de datos por modelo |
| `/cuidados` | Sí | Recomendaciones generales |
| `/envios-y-devoluciones` | No (draft) | Política pendiente de validación |

## SEO

- Sitemap: `@astrojs/sitemap` → `/sitemap-index.xml`
- Robots: `src/pages/robots.txt.ts`
- Exclusiones: `/404`, `/carrito`, `/cart-catalog.json`, `/desistimiento`, documentos draft

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
