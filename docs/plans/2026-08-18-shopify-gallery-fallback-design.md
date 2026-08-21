# Degradación segura de galerías Shopify

`Product.images` es la única autoridad de galerías del catálogo completo y de `shopify:preflight`. Esta decisión sustituye el diseño inicial basado en `custom.kingbelt_color_galleries`: la auditoría real demostró que varios productos compartían metaobjects con media de modelos distintos aunque sus imágenes nativas estaban correctamente organizadas.

El preflight exige por cada color una única familia nativa `MODELO_COLOR_01/02/03`, ordenada por sufijo y con tres IDs únicos. El índice de identidades y familias se construye una vez por producto, con coste lineal respecto a sus imágenes y variantes. En runtime, una familia inequívoca puede estar temporalmente incompleta; sin familia, una imagen de variante solo se acepta si coincide por ID o URL absoluta exacta con `Product.images`. `ProductVariant.image` no es autoridad y no necesita coincidir con la portada. Nunca se distribuyen imágenes por posición global, huecos u orden de variantes. Si no existe una relación inequívoca, el mapping falla.

El preflight permanece estricto para que esta tolerancia operativa no convierta la deuda de Shopify en un catálogo certificado. El contrato completo está en [`docs/SHOPIFY_READINESS.md`](../SHOPIFY_READINESS.md) §8.1 y §11.
