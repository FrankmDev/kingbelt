/**
 * Contrato tipado para hechos empresariales y comerciales.
 * Los valores con status `pending` no deben renderizarse en contenido público.
 */
import { site } from './site';

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
export const LEGAL_TAX_ID = 'B42696716';
export const LEGAL_PHONE_DISPLAY = '965 43 01 51';
export const COMPANY_SUPPLIED_ADDRESS = `Bueno e Hijos SL,
Poligono Industrial,
Avinguda de Novelda, 143,
03206 Carrus,
Alicante,
España`;
export const REGISTERED_ADDRESS = `Avenida de Novelda, 143, bajo
03206 Elche (Alicante)
España`;
export const REGISTERED_ADDRESS_SINGLE_LINE =
  'Avenida de Novelda, 143, bajo, 03206 Elche (Alicante), España';

export interface BusinessFacts {
  legalName: BusinessFact;
  tradeName: BusinessFact;
  taxId: BusinessFact;
  address: BusinessFact;
  registeredAddress: BusinessFact;
  email: BusinessFact;
  phone: BusinessFact;
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

const COMPANY_SUPPLIED_SOURCE = 'Datos empresariales facilitados por CintuElx S.L.';
const AVISO_LEGAL_SOURCE = 'Aviso Legal, 18 de agosto de 2026';
const ENVIOS_SOURCE = 'Política de envíos, 18 de agosto de 2026';
const DEVOLUCIONES_SOURCE = 'Política de devoluciones, 18 de agosto de 2026';
const PRIVACY_SOURCE = 'Política de privacidad, 22 de agosto de 2026';
const CODE_INVENTORY_SOURCE = 'Inventario técnico de src/content/legal-technologies.ts y el código de sesión/fuentes';

export const CONFIRMED_ADDRESS = COMPANY_SUPPLIED_ADDRESS;

export const businessFacts: BusinessFacts = {
  legalName: {
    status: 'confirmed',
    value: LEGAL_NAME,
    source: COMPANY_SUPPLIED_SOURCE,
  },
  tradeName: {
    status: 'confirmed',
    value: site.name,
    source: 'Marca comercial en uso',
  },
  taxId: {
    status: 'confirmed',
    value: LEGAL_TAX_ID,
    source: COMPANY_SUPPLIED_SOURCE,
  },
  address: {
    status: 'confirmed',
    value: COMPANY_SUPPLIED_ADDRESS,
    source: COMPANY_SUPPLIED_SOURCE,
    notes:
      'Texto facilitado por la empresa, sin función jurídica propia. No es el domicilio social del Aviso Legal ni la dirección de devoluciones.',
  },
  registeredAddress: {
    status: 'confirmed',
    value: REGISTERED_ADDRESS,
    source: AVISO_LEGAL_SOURCE,
    notes: 'Domicilio social declarado en el Aviso Legal.',
  },
  email: {
    status: 'confirmed',
    value: site.contact.email,
    source: 'src/config/site.ts',
  },
  phone: {
    status: 'confirmed',
    value: LEGAL_PHONE_DISPLAY,
    source: COMPANY_SUPPLIED_SOURCE,
  },
  registryData: {
    status: 'confirmed',
    value: 'Inscrita en el Registro Mercantil de Alicante, tomo 4280, folio 5, sección 8, hoja A-168894.',
    source: AVISO_LEGAL_SOURCE,
  },
  activity: {
    status: 'confirmed',
    value:
      'Comercialización de accesorios de cuero y productos relacionados a través de tienda online, bajo el nombre comercial Kingbelt.',
    source: AVISO_LEGAL_SOURCE,
  },
  salesTerritory: {
    status: 'confirmed',
    value: 'Destinos habilitados para entrega durante el proceso de compra.',
    source: ENVIOS_SOURCE,
  },
  taxPolicy: {
    status: 'confirmed',
    value:
      'Los impuestos aplicables se comunican durante el proceso de compra, antes de confirmar el pedido. Determinados destinos pueden estar sujetos a aranceles u otros conceptos fijados por las autoridades.',
    source: `${AVISO_LEGAL_SOURCE}; ${ENVIOS_SOURCE}`,
    notes: 'No hay un tipo de IVA nominado en las políticas publicadas.',
  },
  paymentMethods: {
    status: 'confirmed',
    value:
      'Las modalidades de pago disponibles se muestran durante el proceso de compra, antes de confirmar el pedido. El reembolso se realiza por el mismo medio utilizado, salvo acuerdo expreso del cliente.',
    source: `${AVISO_LEGAL_SOURCE}; ${DEVOLUCIONES_SOURCE}`,
    notes: 'Las políticas publicadas no nombran Shopify Payments ni otros proveedores concretos.',
  },
  carriers: {
    status: 'confirmed',
    value:
      'El transporte lo realiza una empresa de transporte propuesta, seleccionada o contratada por KingBelt. El transportista concreto no está nominado en las políticas publicadas; la modalidad se comunica durante el proceso de compra.',
    source: ENVIOS_SOURCE,
  },
  shippingCosts: {
    status: 'confirmed',
    value:
      'Los gastos de envío se muestran antes de confirmar el pedido. Pueden variar según destino, modalidad, importe y promociones.',
    source: ENVIOS_SOURCE,
  },
  preparationTime: {
    status: 'confirmed',
    value:
      'El plazo de preparación es distinto del de transporte. Los pedidos en festivos o fines de semana pueden comenzar el siguiente día laborable.',
    source: ENVIOS_SOURCE,
  },
  deliveryTime: {
    status: 'confirmed',
    value: 'Entrega en un máximo de 30 días naturales, salvo otro acuerdo',
    source: ENVIOS_SOURCE,
    notes: 'El plazo o fecha estimada concreta se comunica durante el proceso de compra.',
  },
  returnPolicy: {
    status: 'confirmed',
    value:
      '30 días naturales desde la recepción. Los primeros 14 cubren el desistimiento legal. Los gastos de devolución por cambio de opinión corren a cargo del cliente.',
    source: DEVOLUCIONES_SOURCE,
  },
  returnAddress: {
    status: 'confirmed',
    value: `CintuElx S.L. – Kingbelt
Avinguda de Novelda, 143
Polígono Industrial
03206 Carrús, Alicante
España`,
    source: DEVOLUCIONES_SOURCE,
  },
  warranty: {
    status: 'confirmed',
    value:
      'La política de devoluciones no limita ni sustituye los derechos legales derivados de la garantía legal de conformidad.',
    source: DEVOLUCIONES_SOURCE,
  },
  jurisdiction: {
    status: 'confirmed',
    value:
      'Legislación española. Los consumidores podrán acudir a los juzgados y tribunales que resulten legalmente competentes.',
    source: AVISO_LEGAL_SOURCE,
  },
  dataController: {
    status: 'confirmed',
    value: `${LEGAL_NAME}, nombre comercial Kingbelt, NIF ${LEGAL_TAX_ID}`,
    source: PRIVACY_SOURCE,
  },
  processingPurposes: {
    status: 'confirmed',
    value:
      'Prestar y mejorar los servicios de compra, gestionar pedidos, pagos, envíos, devoluciones, atención al cliente, seguridad y, cuando proceda, comunicaciones comerciales.',
    source: PRIVACY_SOURCE,
  },
  legalBases: {
    status: 'confirmed',
    value:
      'La Política de privacidad describe el uso de la información para cumplir el contrato (prestación de los Servicios, pedidos y pagos), obligaciones legales, seguridad y prevención de fraude, comunicaciones y, cuando el tratamiento se base en él, consentimiento. Determinadas divulgaciones se realizan por los motivos descritos en esa política.',
    source: PRIVACY_SOURCE,
    notes: 'No hay una tabla artículo 6 por finalidad; el valor resume el texto publicado.',
  },
  retentionPeriod: {
    status: 'confirmed',
    value:
      'El plazo de conservación depende de la necesidad de mantener la cuenta, prestar los Servicios, cumplir obligaciones legales, resolver conflictos o hacer cumplir contratos y políticas aplicables.',
    source: PRIVACY_SOURCE,
    notes: 'La política publicada no fija un número de años.',
  },
  recipients: {
    status: 'confirmed',
    value:
      'Shopify y otros proveedores que prestan servicios en nuestro nombre (pagos, logística, hosting, atención al cliente y análisis), partners de marketing cuando corresponda, y autoridades cuando la ley lo exija.',
    source: PRIVACY_SOURCE,
  },
  internationalTransfers: {
    status: 'confirmed',
    value:
      'Pueden existir transferencias fuera del EEA o del Reino Unido, cubiertas mediante cláusulas contractuales tipo u otros mecanismos reconocidos, salvo decisión de adecuación.',
    source: PRIVACY_SOURCE,
  },
  cookiesAndTechnologies: {
    status: 'confirmed',
    value:
      'Cookie de sesión __Host-kingbelt-session en modo Shopify; localStorage kingbelt-cart-v4 solo en modo demo; tipografías Fontshare y Google Fonts. Sin analítica, publicidad ni marketing en el código del sitio. Las cookies del checkout y cuentas Shopify se sirven en dominios de Shopify y no se inventarían aquí.',
    source: CODE_INVENTORY_SOURCE,
  },
  madeInSpain: { status: 'pending', notes: 'Origen de fabricación confirmado' },
  packagingIncluded: { status: 'pending', notes: 'Tipo de embalaje incluido' },
  freeShipping: { status: 'pending', notes: 'Condiciones de envío gratuito' },
  responseTime: { status: 'pending', notes: 'Compromiso de tiempo de respuesta' },
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
  return highlights;
};
