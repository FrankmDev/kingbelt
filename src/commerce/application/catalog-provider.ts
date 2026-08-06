import type { Collection, CollectionPage, Product, ProductSummary } from '../domain/catalog';

/** Puerto de lectura del catálogo consumido por las rutas. */
export interface CatalogProvider {
  getCollections(): Promise<Collection[]>;
  getCollectionByHandle(handle: string): Promise<CollectionPage | undefined>;
  getProductHandles(): Promise<string[]>;
  getCollectionHandles(): Promise<string[]>;
  getProductByHandle(handle: string): Promise<Product | undefined>;
  getFeaturedProducts(limit: number): Promise<ProductSummary[]>;
  getRelatedProducts(product: Product, limit: number): Promise<ProductSummary[]>;
}
