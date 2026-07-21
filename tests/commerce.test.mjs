import { describe, expect, test } from 'bun:test';
import { addToCart, emptyCart, updateLineQuantity } from '../src/lib/commerce/cart-operations.ts';
import { getSafeCheckoutUrl } from '../src/lib/commerce/checkout.ts';
import { createLocalCommerceProvider } from '../src/lib/commerce/local-provider.ts';
import {
  LOCAL_CART_STORAGE_KEY,
  persistCart,
  readPersistedCart,
} from '../src/lib/commerce/local-cart-storage.ts';
import { moneyFromDecimal, moneyFromMajor } from '../src/lib/commerce/money.ts';

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const atlasInput = {
  productId: 'kb-vestir-001',
  color: 'Negro',
  size: '85',
  quantity: 1,
};

describe('dominio de carrito local', () => {
  test('calcula dinero en unidades mínimas', () => {
    expect(moneyFromMajor(10.01)).toEqual({ amountMinor: 1001, currency: 'EUR' });
    expect(moneyFromDecimal('10.01')).toEqual({ amountMinor: 1001, currency: 'EUR' });
    expect(() => moneyFromDecimal('10.001')).toThrow();
  });

  test('rechaza opciones manipuladas y productos agotados', () => {
    const invalid = addToCart(emptyCart(), { ...atlasInput, color: 'javascript:alert(1)' });
    expect(invalid.success).toBe(false);
    expect(invalid.error?.field).toBe('color');

    const soldOut = addToCart(emptyCart(), {
      productId: 'kb-sport-001',
      color: 'Negro / acero',
      size: '85',
      quantity: 1,
    });
    expect(soldOut.success).toBe(false);
    expect(soldOut.error?.code).toBe('out_of_stock');
  });

  test('ajusta una cantidad que supera el stock local', () => {
    const added = addToCart(emptyCart(), {
      productId: 'kb-casual-002',
      color: 'Marrón / detalle tricolor',
      size: '85',
      quantity: 1,
    });
    expect(added.success).toBe(true);

    const updated = updateLineQuantity(added.cart, added.cart.lines[0].id, 3);
    expect(updated.success).toBe(true);
    expect(updated.adjustedQuantity).toBe(2);
    expect(updated.cart.lines[0].quantity).toBe(2);
  });
});

describe('persistencia no autoritativa', () => {
  test('persiste solo identidades y selección', () => {
    const storage = new MemoryStorage();
    const result = addToCart(emptyCart(), atlasInput);
    persistCart(storage, result.cart);

    const raw = storage.getItem(LOCAL_CART_STORAGE_KEY);
    expect(raw).toContain('"productId":"kb-vestir-001"');
    expect(raw).not.toContain('unitPrice');
    expect(raw).not.toContain('Cinturón Atlas');
    expect(readPersistedCart(storage).source).toBe('current');
  });

  test('migra el formato antiguo sin confiar en su precio', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'kingbelt-cart-v2',
      JSON.stringify({
        lines: [
          {
            product: {
              id: 'kb-vestir-001',
              name: '<img src=x onerror=alert(1)>',
              unitPrice: { amount: 0.01, currency: 'EUR' },
              href: 'javascript:alert(1)',
            },
            color: 'Negro',
            size: '85',
            quantity: 1,
          },
        ],
      })
    );

    const provider = createLocalCommerceProvider({ storage });
    const cart = await provider.initialize();
    expect(cart.lines[0].product.name).toBe('Cinturón Atlas');
    expect(cart.lines[0].product.unitPrice.amountMinor).toBe(8900);
    expect(cart.lines[0].product.href).toBe('/productos/cinturon-atlas');
    expect(cart.lines[0].product.sizeUnit).toBe('cm');
  });

  test('descarta payloads sobredimensionados o cantidades inválidas', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LOCAL_CART_STORAGE_KEY,
      JSON.stringify({ version: 3, lines: [{ ...atlasInput, quantity: 100 }] })
    );
    expect(readPersistedCart(storage)).toEqual({ lines: [], source: 'invalid' });
  });
});

describe('redirección de checkout', () => {
  test('solo permite HTTPS y un host exacto declarado por el proveedor', () => {
    const safe = getSafeCheckoutUrl({
      status: 'idle',
      url: 'https://checkout.example.com/cart/1',
      allowedHosts: ['checkout.example.com'],
    });
    expect(safe?.hostname).toBe('checkout.example.com');

    expect(
      getSafeCheckoutUrl({
        status: 'idle',
        url: 'https://checkout.example.com.evil.test/cart/1',
        allowedHosts: ['checkout.example.com'],
      })
    ).toBeNull();
    expect(
      getSafeCheckoutUrl({
        status: 'idle',
        url: 'http://checkout.example.com/cart/1',
        allowedHosts: ['checkout.example.com'],
      })
    ).toBeNull();
  });
});
