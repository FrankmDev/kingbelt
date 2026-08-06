# Preparación de KingBelt para Shopify

## 1. Estado actual

La web sigue siendo estática y funciona sin variables de entorno. El catálogo, las variantes y el carrito de demostración se resuelven con proveedores locales; no existe cliente HTTP, GraphQL, tienda configurada ni dependencia de Shopify.

## 2. Arquitectura objetivo

```txt
páginas/componentes → CatalogProvider → local ahora / adaptador Shopify después
scripts de carrito  → CommerceProvider → local ahora / adaptador Shopify después
                                      ↘ dominio neutral compartido
```

Las respuestas GraphQL se transformarán al dominio neutral dentro del futuro adaptador. No llegarán a páginas ni componentes.

## 3. Proveedor de catálogo

Es responsable de colecciones, resúmenes para grids, fichas completas, handles, destacados y relacionados. Los resúmenes excluyen variantes para que una colección no serialice el catálogo completo.

## 4. Proveedor de carrito

Es responsable de inicializar, añadir una variante, modificar cantidades, eliminar líneas y obtener checkout. La identidad autoritativa es `variantId`; título, precio, imagen, opciones y stock se vuelven a resolver en el proveedor.

## 5. Producto y variante

`CommerceProduct` diferencia ID interno, handle y referencia comercial. Cada `ProductVariant` tiene ID y SKU propios, opciones seleccionadas, precio, disponibilidad, stock opcional e imagen opcional. Solo existen combinaciones declaradas como variantes; no se calcula el producto cartesiano de opciones.

## 6. Generación estática

`getStaticPaths()` solicita únicamente handles. Cada ruta obtiene después su producto o colección por handle durante el build. El sitio continúa sin adapter y sin SSR.

## 7. Actualización futura

Los datos se obtendrán durante el build. Cuando cambie el catálogo se reconstruirá el despliegue de Vercel. Más adelante podrá conectarse un webhook de Shopify a un deploy hook de Vercel; esa automatización no está implementada.

## 8. Mapeo previsto

| Origen | Dominio / Shopify |
| --- | --- |
| Código de modelo | `CommerceProduct.reference` |
| Handle | handle de Shopify |
| Color | opción `Color` |
| Talla | opción `Talla` |
| SKU | SKU de variante |
| Precio | precio de variante, convertido a unidades mínimas |
| Coste | dato administrativo; nunca público |
| Stock | inventario de variante |
| Categoría interna | colección |
| Product category | categoría oficial de Shopify |
| Material | especificación y futuro metafield |
| Ancho | especificación y futuro metafield |
| Hebilla | especificación y futuro metafield |
| Tres imágenes | media de producto y, cuando proceda, imagen principal de variante/color |

## 9. Decisiones empresariales pendientes

Faltan confirmar catálogo definitivo, precios, moneda/mercados, reglas de stock, taxonomía de colecciones, categoría oficial, materiales, anchos, hebillas, textos SEO, política de imágenes, checkout y credenciales autorizadas. El coste nunca formará parte del dominio público.

## 10. Categorías y colecciones

Las categorías públicas se modelan como colecciones. Una colección destacada ordena la portada, pero el layout acepta entre tres y seis sin asumir dos secundarias exactas. Debe decidirse qué colecciones son manuales o automáticas antes de importar.

## 11. Imágenes

El dominio admite imagen principal, galería dinámica, imagen de variante, dimensiones, alt, posición y agrupación opcional por valor de opción. La primera integración puede asociar una imagen principal a cada variante/color y dejar el resto en la galería general. Cuando se conozca el CDN definitivo habrá que autorizarlo con `image.domains` o `image.remotePatterns` de Astro si se usa optimización remota. No se configuran aún metaobjects ni metafields.

## 12. Filtros

Los filtros locales usan tipo, colores normalizados, rango de precio y disponibilidad del resumen. El adaptador futuro mapeará esos criterios a los filtros disponibles en Shopify; no se ha configurado Search & Discovery ni consultas remotas.

## 13. SEO

El SEO consume el dominio neutral. La ficha genera `Product`, marca, imágenes, referencia, canonical, disponibilidad y una sola oferta o `AggregateOffer`; no genera un `Offer` por variante.

## 14. Pasos exactos para activar Shopify

1. Confirmar campos pendientes, colecciones, mercados, inventario y política de imágenes.
2. Crear y validar la tienda y el catálogo fuera de este repositorio.
3. Elegir el flujo de carrito: cliente con token público o frontera servidor para credenciales privadas.
4. Fijar `SHOPIFY_API_VERSION` y configurar dominio y token apropiado en el entorno de despliegue.
5. Implementar el cliente Storefront mínimo en la frontera elegida.
6. Implementar adaptadores separados para `CatalogProvider` y `CommerceProvider`.
7. Mapear respuestas GraphQL al dominio neutral y ejecutar el validador antes de renderizar.
8. Autorizar el dominio CDN de imágenes solo cuando sea conocido.
9. Ejecutar pruebas de catálogo, variantes, carrito, rutas, SEO y validación visual.
10. Cambiar `COMMERCE_SOURCE` a Shopify en la selección de proveedores.
11. Configurar reconstrucciones de Vercel; valorar después webhook/deploy hook.
12. Verificar checkout, secretos, CSP/cabeceras y vuelta al proveedor local antes de publicar.

Un token público de Storefront puede exponerse al cliente; un token privado es exclusivamente de servidor. La decisión final del cliente de carrito se tomará al conectar la tienda. La versión API debe fijarse explícitamente y nunca ser `latest`.

## 15. Vuelta temporal al proveedor local

Mantener los fixtures y proveedores locales mientras dure la transición. Ante una incidencia, restablecer `COMMERCE_SOURCE=local`, reconstruir el sitio y comprobar catálogo/carrito local. La reversión no exige cambiar páginas ni componentes porque ambos proveedores comparten el dominio neutral.
