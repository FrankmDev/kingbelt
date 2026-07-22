/**
 * Contrato tipado para hechos empresariales y comerciales.
 * Los valores con status `pending` no deben renderizarse en contenido público.
 */

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

export interface BusinessFacts {
  legalName: BusinessFact;
  tradeName: BusinessFact;
  taxId: BusinessFact;
  address: BusinessFact;
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

export const businessFacts: BusinessFacts = {
  legalName: { status: 'pending', notes: 'Razón social registrada' },
  tradeName: {
    status: 'confirmed',
    value: 'KingBelt',
    source: 'Marca comercial en uso',
  },
  taxId: { status: 'pending', notes: 'NIF/CIF' },
  address: { status: 'pending', notes: 'Domicilio social y fiscal' },
  email: {
    status: 'confirmed',
    value: 'hola@kingbelt.com',
    source: 'src/data/site.ts',
  },
  phone: { status: 'pending', notes: 'Teléfono de atención' },
  registryData: { status: 'pending', notes: 'Datos registrales (Registro Mercantil, tomo, folio, hoja)' },
  activity: { status: 'pending', notes: 'Actividad económica / CNAE' },
  salesTerritory: { status: 'pending', notes: 'Territorios de venta confirmados' },
  taxPolicy: { status: 'pending', notes: 'IVA y tratamiento fiscal' },
  paymentMethods: { status: 'pending', notes: 'Métodos de pago aceptados' },
  carriers: { status: 'pending', notes: 'Transportistas contratados' },
  shippingCosts: { status: 'pending', notes: 'Costes de envío por zona' },
  preparationTime: { status: 'pending', notes: 'Plazo de preparación del pedido' },
  deliveryTime: { status: 'pending', notes: 'Plazo de entrega estimado' },
  returnPolicy: { status: 'pending', notes: 'Política de devoluciones y cambios' },
  returnAddress: { status: 'pending', notes: 'Dirección para devoluciones' },
  warranty: { status: 'pending', notes: 'Garantía legal y comercial' },
  jurisdiction: { status: 'pending', notes: 'Jurisdicción y ley aplicable' },
  dataController: { status: 'pending', notes: 'Responsable del tratamiento (identidad completa)' },
  processingPurposes: { status: 'pending', notes: 'Finalidades del tratamiento confirmadas' },
  legalBases: { status: 'pending', notes: 'Bases jurídicas por finalidad' },
  retentionPeriod: { status: 'pending', notes: 'Plazos de conservación' },
  recipients: { status: 'pending', notes: 'Destinatarios y encargados' },
  internationalTransfers: { status: 'pending', notes: 'Transferencias internacionales' },
  cookiesAndTechnologies: { status: 'pending', notes: 'Inventario completo tras integraciones' },
  madeInSpain: { status: 'pending', notes: 'Origen de fabricación confirmado' },
  packagingIncluded: { status: 'pending', notes: 'Tipo de embalaje incluido' },
  freeShipping: { status: 'pending', notes: 'Condiciones de envío gratuito' },
  responseTime: { status: 'pending', notes: 'Compromiso de tiempo de respuesta' },
};

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
