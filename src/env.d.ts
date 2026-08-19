/// <reference types="astro/client" />

declare namespace App {
  interface SessionData {
    /** Identificador remoto de carrito Shopify. Solo server-side; nunca se serializa al navegador. */
    shopifyCartId: string;
  }
}
