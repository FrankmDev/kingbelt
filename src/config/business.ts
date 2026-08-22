/**
 * Contrato tipado para hechos empresariales y comerciales.
 * Los valores con status `pending` no deben renderizarse en contenido público.
 */
import { siteUrl } from './site';

export type BusinessFact<T = string> =
  | {
      status: 'confirmed';
      value: T;
      source: string;
      notes?: string;
    }
  | {
      status: 'pending' | 'not-applicable';
      value?: never;
      source?: never;
      notes?: string;
    };

/** Devuelve el valor solo si está confirmado. */
export const confirmed = <T>(fact: BusinessFact<T>): T | undefined =>
  fact.status === 'confirmed' ? fact.value : undefined;

export const LEGAL_NAME = 'CintuElx S.L.';
export const LEGAL_TRADE_NAME = 'Kingbelt';
export const LEGAL_TAX_ID = 'B42696716';
export const LEGAL_PHONE_DISPLAY = '965 43 01 51';
export const LEGAL_EMAIL = 'contabilidad@cintuelx.com';
export const LEGAL_REGISTERED_ADDRESS = `Avenida de Novelda, 143, bajo,
03206 Elche (Alicante),
España`;
export const LEGAL_REGISTRY_DATA =
  'Registro Mercantil de Alicante, sección 8, hoja A-168894, inscripción 3.';
export const LEGAL_ACTIVITY =
  'Fabricación y comercio mayorista y minorista de artículos de calzado, marroquinería y complementos de vestir.';
export interface BusinessFacts {
  legalName: BusinessFact;
  tradeName: BusinessFact;
  taxId: BusinessFact;
  address: BusinessFact;
  registeredAddress: BusinessFact;
  email: BusinessFact;
  phone: BusinessFact;
  website: BusinessFact;
  registryData: BusinessFact;
  activity: BusinessFact;
  salesTerritory: BusinessFact;
  taxPolicy: BusinessFact;
  paymentMethods: BusinessFact;
  carriers: BusinessFact;
  shippingCosts: BusinessFact;
  preparationTime: BusinessFact;
  deliveryTime: BusinessFact;
  returnPolicy: BusinessFact;
  returnAddress: BusinessFact;
  warranty: BusinessFact;
  jurisdiction: BusinessFact;
  dataController: BusinessFact;
  processingPurposes: BusinessFact;
  legalBases: BusinessFact;
  retentionPeriod: BusinessFact;
  recipients: BusinessFact;
  internationalTransfers: BusinessFact;
  cookiesAndTechnologies: BusinessFact;
  madeInSpain: BusinessFact;
  packagingIncluded: BusinessFact;
  freeShipping: BusinessFact;
  responseTime: BusinessFact;
}

export type BusinessFactKey = keyof BusinessFacts;

const COMPANY_CONFIRMATION_SOURCE =
  'Confirmación empresarial facilitada por CintuElx S.L. el 22/08/2026.';
const LEGAL_TEXT_VALIDATION_SOURCE =
  'Textos legales declarados definitivos por CintuElx S.L. el 22/08/2026.';
const BORME_REGISTERED_ADDRESS_SOURCE =
  'BORME-A-2026-1-03, inscripción 55, publicado el 02/01/2026.';
const BORME_ACTIVITY_SOURCE =
  'BORME-A-2020-36-03, constitución de CintuElx S.L., publicado el 21/02/2020.';

/** Copy pública: el transporte va incluido en el precio del producto. */
export const FREE_SHIPPING_LABEL = 'Envíos gratuitos';
export const FREE_SHIPPING_DETAIL =
  'El coste del envío está incluido en el precio del producto; no añadimos gastos de transporte aparte.';
export const CART_CHECKOUT_NOTE = `${FREE_SHIPPING_LABEL}. Los impuestos se calculan en el checkout.`;

export const businessFacts: BusinessFacts = {
  legalName: {
    status: 'confirmed',
    value: LEGAL_NAME,
    source: COMPANY_CONFIRMATION_SOURCE,
  },
  tradeName: {
    status: 'confirmed',
    value: LEGAL_TRADE_NAME,
    source: COMPANY_CONFIRMATION_SOURCE,
  },
  taxId: {
    status: 'confirmed',
    value: LEGAL_TAX_ID,
    source: COMPANY_CONFIRMATION_SOURCE,
  },
  address: {
    status: 'confirmed',
    value: LEGAL_REGISTERED_ADDRESS,
    source: COMPANY_CONFIRMATION_SOURCE,
    notes: 'Dirección de contacto y domicilio social confirmados; no se declara como dirección logística de devoluciones.',
  },
  registeredAddress: {
    status: 'confirmed',
    value: LEGAL_REGISTERED_ADDRESS,
    source: BORME_REGISTERED_ADDRESS_SOURCE,
    notes: 'Domicilio social confirmado por la empresa y contrastado con el BORME; no implica domicilio fiscal ni dirección logística de devoluciones.',
  },
  email: {
    status: 'confirmed',
    value: LEGAL_EMAIL,
    source: COMPANY_CONFIRMATION_SOURCE,
  },
  phone: {
    status: 'confirmed',
    value: LEGAL_PHONE_DISPLAY,
    source: COMPANY_CONFIRMATION_SOURCE,
  },
  website: {
    status: 'confirmed',
    value: siteUrl,
    source: COMPANY_CONFIRMATION_SOURCE,
  },
  registryData: {
    status: 'confirmed',
    value: LEGAL_REGISTRY_DATA,
    source: BORME_REGISTERED_ADDRESS_SOURCE,
  },
  activity: {
    status: 'confirmed',
    value: LEGAL_ACTIVITY,
    source: BORME_ACTIVITY_SOURCE,
  },
  salesTerritory: {
    status: 'confirmed',
    value: 'Destinos habilitados para entrega durante el checkout de Shopify.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  taxPolicy: {
    status: 'confirmed',
    value: 'Los impuestos aplicables y, cuando proceda, los conceptos aduaneros se comunican antes de confirmar la compra.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  paymentMethods: {
    status: 'confirmed',
    value: 'Las modalidades disponibles se muestran en el checkout de Shopify; los reembolsos usan el mismo medio salvo acuerdo expreso sin coste adicional.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  carriers: {
    status: 'confirmed',
    value: 'Empresa de transporte propuesta, seleccionada o contratada por Kingbelt; la modalidad concreta se comunica durante la compra.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  shippingCosts: {
    status: 'confirmed',
    value: 'Incluidos en el precio del producto',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
    notes: 'No se añaden gastos de transporte aparte en la compra ordinaria.',
  },
  preparationTime: {
    status: 'confirmed',
    value: 'La preparación comienza tras la confirmación del pedido y, cuando corresponda, la autorización del pago; su duración se integra en la estimación comunicada al cliente.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  deliveryTime: {
    status: 'confirmed',
    value: 'Entrega en un máximo de 30 días naturales, salvo otro acuerdo',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
    notes: 'La fecha o el plazo estimado concreto se comunica durante la compra o en la confirmación del pedido.',
  },
  returnPolicy: {
    status: 'confirmed',
    value: 'Desistimiento legal de 14 días naturales, ampliado voluntariamente a 30 días naturales, conforme a la política publicada.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  returnAddress: {
    status: 'pending',
    notes: 'Dirección operativa de devoluciones pendiente de confirmación expresa.',
  },
  warranty: {
    status: 'confirmed',
    value: 'Se preservan íntegramente los derechos legales de conformidad y garantía del consumidor.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  jurisdiction: {
    status: 'confirmed',
    value: 'Legislación española y tribunales competentes conforme a la normativa aplicable al consumidor.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  dataController: {
    status: 'confirmed',
    value: `${LEGAL_NAME}, ${LEGAL_REGISTERED_ADDRESS.replace(/\s*\n\s*/g, ', ')}`,
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  processingPurposes: {
    status: 'confirmed',
    value: 'Prestar la tienda y sus servicios, gestionar compras, pagos, pedidos, envíos, devoluciones, atención, seguridad y comunicaciones permitidas.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  legalBases: {
    status: 'confirmed',
    value: 'Ejecución contractual, cumplimiento de obligaciones legales, intereses legítimos y consentimiento cuando resulte aplicable.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  retentionPeriod: {
    status: 'confirmed',
    value: 'Durante el tiempo necesario para prestar los servicios, mantener la relación y cumplir obligaciones legales, resolver conflictos o exigir responsabilidades.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  recipients: {
    status: 'confirmed',
    value: 'Shopify y proveedores necesarios de tecnología, pagos, alojamiento, atención y logística; autoridades u otros terceros cuando exista obligación o base legal.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  internationalTransfers: {
    status: 'confirmed',
    value: 'Cuando existan transferencias fuera del EEE o Reino Unido se emplearán decisiones de adecuación, cláusulas contractuales tipo u otro mecanismo reconocido.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  cookiesAndTechnologies: {
    status: 'confirmed',
    value: 'Cookie de sesión opaca para el carrito Shopify, localStorage exclusivo del modo demo y recursos tipográficos externos declarados en la política.',
    source: LEGAL_TEXT_VALIDATION_SOURCE,
  },
  madeInSpain: { status: 'pending', notes: 'Origen de fabricación pendiente de confirmación.' },
  packagingIncluded: { status: 'pending', notes: 'Tipo de embalaje pendiente de confirmación.' },
  freeShipping: {
    status: 'confirmed',
    value: FREE_SHIPPING_LABEL,
    source: LEGAL_TEXT_VALIDATION_SOURCE,
    notes: FREE_SHIPPING_DETAIL,
  },
  responseTime: { status: 'pending', notes: 'Compromiso de tiempo de respuesta pendiente de confirmación.' },
};

/** Normaliza el teléfono nacional publicado a un href `tel:`. */
export const toTelHref = (display: string): string => `tel:+34${display.replace(/\D/g, '')}`;

/** Claims públicos derivados de hechos confirmados. Vacío si no hay datos. */
export const publicHighlights = (): string[] => {
  const highlights: string[] = [];
  const madeIn = confirmed(businessFacts.madeInSpain);
  if (madeIn) highlights.push(`Hecho en ${madeIn}`);
  const delivery = confirmed(businessFacts.deliveryTime);
  if (delivery) highlights.push(delivery);
  const packaging = confirmed(businessFacts.packagingIncluded);
  if (packaging) highlights.push(packaging);
  const freeShipping = confirmed(businessFacts.freeShipping);
  if (freeShipping) highlights.push(freeShipping);
  return highlights;
};
