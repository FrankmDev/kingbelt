# PROJECT.md — Contexto de KingBelt

Lee este archivo para decisiones de producto, negocio, contenidos o alcance. No contiene reglas visuales ni patrones de implementación.

## Producto y posicionamiento

KingBelt es una marca ecommerce masculina centrada inicialmente en cinturones y preparada para ampliar catálogo a ropa y accesorios.

No es una landing temporal. La web debe evolucionar hacia un ecommerce real sin rehacer su base editorial, su modelo de datos ni su sistema de componentes.

La cultura moto aporta actitud y contexto. El producto —diseño, cuero, hebilla, materiales, ajuste y durabilidad— mantiene el protagonismo. La comunicación debe ser directa, útil y segura; premium sin sonar ostentosa, artesanal en lo material sin presentarse como un atelier delicado.

## Objetivos de la web

La experiencia debe poder cubrir progresivamente:

- descubrir la marca y su criterio de producto;
- entender materiales, fabricación, tallaje, cuidado y uso;
- explorar colecciones y productos;
- resolver dudas antes y después de comprar;
- completar compra y gestión básica del pedido;
- publicar contenido editorial útil para marca, producto y SEO.

El contenido debe ayudar a decidir. Evita claims vacíos, jerga motera gratuita y texto decorativo que no aporte información.

## Arquitectura de información prevista

Base editorial consolidada:

- Inicio.
- Sobre KingBelt.
- Blog y artículos.
- Centro de ayuda (`/ayuda`), guía de tallas, cuidados.
- Contacto y preguntas frecuentes.
- Documentos legales provisionales (borrador, no indexables).
- Sistema visual y componentes compartidos.

Evolución ecommerce:

- Colecciones y búsqueda/exploración de catálogo.
- Ficha de producto y variantes.
- Carrito y conexión con checkout.
- Activación de envíos/devoluciones, condiciones definitivas y desistimiento electrónico.

Esta lista define preparación arquitectónica, no autorización para implementar cada funcionalidad.

## Modelo de dominio

Mantén entidades de comercio genéricas:

- `Product`
- `ProductVariant`
- `ProductOption`
- `ProductImage`
- `Collection`
- `Money`
- `Cart`
- `CartLine`

No introduzcas modelos como `Belt` cuando una entidad genérica de comercio resuelva el caso. Los atributos particulares del cinturón pertenecen a opciones, metafields o datos de producto, no a una arquitectura cerrada.

## Fases y límites

1. **Base editorial/corporativa — consolidada:** páginas de marca, blog, contacto, navegación, SEO base y sistema de componentes.
2. **Ecommerce local — presente y aislado:** colecciones, productos y carrito de demostración con datos locales tipados.
3. **Shopify:** adaptación de la capa de comercio a Storefront API y checkout.
4. **Operación real:** pagos, pedidos, emails, legal, analítica, SEO completo, QA y lanzamiento. El checklist Admin está en `docs/SHOPIFY_LAUNCH_OPERATIONS.md`; el código no simula esas superficies.

No adelantes una fase salvo petición explícita. La implementación local existente no autoriza a ampliar por iniciativa propia grids o fichas de producto, filtros, carrito, login, checkout ni llamadas a Shopify.

## Decisiones no confirmadas

No inventes precios, políticas comerciales, plazos, garantías, origen de fabricación, sostenibilidad, certificaciones, disponibilidad ni promesas de atención. Usa datos existentes o solicita confirmación cuando una decisión afecte al negocio o al contenido público.

Los hechos empresariales viven en `src/config/business.ts` con estado `confirmed` | `pending` | `not-applicable`. Los pendientes no se renderizan. Consulta `docs/BUSINESS_AND_LEGAL_REQUIREMENTS.md` para la checklist de activación.
