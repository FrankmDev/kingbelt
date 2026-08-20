# Datos empresariales y requisitos legales — KingBelt

> **Advertencia interna:** Los textos legales deben ser revisados y aprobados por un profesional antes del lanzamiento. Este documento no constituye asesoramiento legal.

## Estado del sistema

KingBelt utiliza un contrato tipado en `src/config/business.ts` para diferenciar información **confirmada** (`confirmed`), **pendiente** (`pending`) y **no aplicable** (`not-applicable`).

Los valores pendientes:
- **no se renderizan** en contenido público;
- **no aparecen** en metadata, footer, FAQ ni copy;
- pueden activarse confirmando el hecho en `businessFacts` sin editar múltiples componentes.

## Checklist para la empresa

### Identidad y contacto

- [ ] Razón social / denominación
- [ ] Nombre comercial (actualmente: KingBelt — confirmado)
- [ ] NIF/CIF
- [ ] Domicilio social y fiscal
- [ ] Teléfono de atención
- [ ] Datos registrales (Registro Mercantil, tomo, folio, hoja, inscripción)
- [ ] Actividad económica / CNAE

### Comercio y operación

Los importes, plazos y métodos deben coincidir con Shopify Admin. No inventarlos aquí ni en copy público. El checklist operativo está en `docs/SHOPIFY_LAUNCH_OPERATIONS.md`. Una contradicción entre estas páginas y Checkout es MANUAL BLOCKER.

- [ ] Territorios de venta
- [ ] Política fiscal (IVA, impuestos)
- [ ] Métodos de pago aceptados
- [ ] Transportistas contratados
- [ ] Costes de envío por zona
- [ ] Plazo de preparación del pedido
- [ ] Plazo de entrega estimado
- [ ] Política de devoluciones y cambios
- [ ] Dirección para devoluciones
- [ ] Garantía legal y comercial
- [ ] Jurisdicción y ley aplicable

### Claims de marketing (activables vía `businessFacts`)

- [ ] Origen de fabricación (`madeInSpain`)
- [ ] Embalaje incluido (`packagingIncluded`)
- [ ] Envío gratuito (`freeShipping`)
- [ ] Compromiso de tiempo de respuesta (`responseTime`)

### Privacidad y datos

- [ ] Responsable del tratamiento (identidad completa)
- [ ] Finalidades del tratamiento por canal
- [ ] Bases jurídicas por finalidad
- [ ] Plazos de conservación
- [ ] Destinatarios y encargados (hosting, email, etc.)
- [ ] Transferencias internacionales
- [ ] Inventario de cookies tras integraciones (Shopify, analítica, marketing)

## Documentos legales

| Ruta | Estado | Robots | Sitemap |
|------|--------|--------|---------|
| `/aviso-legal` | draft | noindex,follow | Excluido |
| `/privacidad` | draft | noindex,follow | Excluido |
| `/cookies` | draft | noindex,follow | Excluido |
| `/condiciones` | draft | noindex,follow | Excluido |
| `/envios-y-devoluciones` | draft | noindex,follow | Excluido |
| `/desistimiento` | inactivo | noindex,nofollow | Excluido |

### Activar un documento

1. Completar los `businessFacts` requeridos para cada sección.
2. Revisar y aprobar el texto con asesor legal.
3. Cambiar `status: 'published'` en `src/content/legal.ts`.
4. `robots` y el sitemap se actualizarán automáticamente a partir de ese estado.

### Ocultar borradores en navegación pública

En `src/content/legal.ts`, establecer `showDraftLegalInNav = false`.

## Mecanismo de desistimiento

- Ruta preparada: `/desistimiento` (vista interna, no operativa).
- Para activar: implementar el formulario, endpoint, validación contra pedidos, acuse de recibo y revisión legal; después, cambiar el estado del documento.

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
