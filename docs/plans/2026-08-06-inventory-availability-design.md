# Diseño: inventario y disponibilidad coherentes

## Decisión

La aplicación usa una única interpretación derivada en `commerce/domain/inventory.ts`. El catálogo conserva hechos independientes —estado comercial, inventario conocido o desconocido, política de continuación y máximo comercial opcional— y nunca almacena un booleano redundante de disponibilidad. La función derivada devuelve estado visible, comprabilidad, máximo efectivo y motivo del límite. Ficha, carrito, proyecciones de catálogo y barrera de checkout consumen ese mismo contrato.

Se valoraron tres enfoques: repetir condiciones en cada vista, almacenar un estado normalizado en cada variante o derivarlo desde hechos canónicos. El primero permite contradicciones; el segundo crea una segunda fuente que puede quedar obsoleta. Se elige la derivación pura porque mantiene las reglas comprobables y sustituibles al conectar Shopify.

## Cantidades y recuperación

El máximo efectivo es el menor límite aplicable entre stock —solo cuando es conocido y la venta sin stock está denegada—, máximo comercial de variante y protección técnica del carrito. El motivo viaja con el valor para que la UI no describa el límite técnico como inventario. La exposición de cifras exactas y el umbral de pocas unidades son configuración pendiente; el default conservador comunica estados sin cifras.

Al reconciliar persistencia se vuelven a resolver precio, variante e inventario. Una bajada de stock positiva reduce automáticamente la cantidad con aviso. Stock cero o variante no disponible conserva la línea y bloquea checkout; una identidad eliminada se retira. El checkout refresca de nuevo el proveedor y solo continúa si el carrito reconciliado es comprable. La política `continue` mantiene comprables las variantes sin stock.

## Verificación

Las pruebas cubren stock conocido, desconocido, bajo, agotado, no disponible, continuación sin stock, eliminación, máximo comercial, límite técnico, recuperación de cantidades y revalidación previa al checkout. El futuro adaptador Shopify deberá reconstruir el estado desde sus respuestas de variante y carrito, tratando siempre el almacenamiento y el navegador como no autoritativos.
