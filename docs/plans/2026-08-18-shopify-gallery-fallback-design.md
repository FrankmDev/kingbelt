# Degradación segura de galerías Shopify

## Objetivo

Evitar que la web completa responda `500` cuando Storefront no exponga `kingbelt.color_galleries`, sin reconstruir galerías mediante heurísticas que puedan mezclar fotografías de distintos colores.

## Diseño

La normalización mantiene dos caminos dentro de `infrastructure/shopify`. Si `kingbelt.color_galleries` contiene referencias, conserva el contrato estricto: una referencia por color, tres `MediaImage` ordenadas, colores existentes, IDs únicos y portada idéntica a `variant.image`. Un metafield parcialmente configurado continúa siendo un error y no se oculta con un fallback.

Si el metafield no llega o no contiene referencias, el adaptador agrupa las variantes por el valor de la opción Color. El fallback solo se acepta cuando todas las variantes publicadas de un color tienen imagen, comparten exactamente el mismo ID y ese ID pertenece a `Product.images`. El grupo resultante contiene únicamente esa imagen. No se asignan detalles por posición, nombre de archivo, orden global ni reparto entre colores.

El dominio admite grupos de una a tres imágenes. La cardinalidad exacta de tres sigue validándose en el mapper de la galería estructurada; la validación neutral limita el máximo y mantiene las reglas de identidad, pertenencia y relación variante-color. La UI no cambia: consume el mismo `Product.mediaGroups`, muestra la portada correcta por color y recuperará automáticamente tres imágenes cuando Shopify publique el metafield.

## Verificación

Los tests cubren ambos caminos, metaobjects con identificador real de Shopify, metafields ausentes o vacíos y rechazo de imágenes nativas ambiguas o ajenas. La comprobación contra el catálogo real debe confirmar una única imagen compartida por todas las tallas de cada color y renderizado SSR sin `500`.
