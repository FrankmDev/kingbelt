# Galerías nativas Shopify

`Product.images` es la única autoridad de galerías del catálogo completo, de `shopify:preflight` y de la ficha runtime. Esta decisión sustituye el diseño inicial basado en `custom.kingbelt_color_galleries`: la auditoría real demostró que varios productos compartían metaobjects con media de modelos distintos aunque sus imágenes nativas estaban correctamente organizadas.

Preflight y runtime exigen por cada color una única familia nativa `MODELO_COLOR_01/02/03`, ordenada por sufijo y con tres IDs únicos. El índice de identidades y familias se construye una vez por producto, con coste lineal respecto a sus imágenes. `ProductVariant.image` de todas las tallas de un Color debe corresponder a la portada de esa familia; el mapper no sustituye discrepancias. Nunca se distribuyen imágenes por posición global, huecos u orden de variantes. Una familia ausente, ambigua, incompleta o con más de tres imágenes hace fallar el producto.

El contrato completo está en [`docs/SHOPIFY_READINESS.md`](../SHOPIFY_READINESS.md) §8.1 y §11.
