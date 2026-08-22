import { site } from '@config/site';
import { businessFacts, confirmed, toTelHref } from '@config/business';
import { LEGAL_CONTACT_EMAIL } from './legal-bodies';
import type { IconName } from '../components/ui/icon-paths';
import type { FAQItem } from './faq';

const contactEmail = confirmed(businessFacts.email) ?? site.contact.email;
const contactPhone = confirmed(businessFacts.phone);
const contactLegalName = confirmed(businessFacts.legalName);

export interface ContactChannel {
  label: string;
  value: string;
  description?: string;
  href: string;
  icon: IconName;
  meta?: string;
}

export interface PurchaseInfoItem {
  title: string;
  description: string;
  label: string;
  meta?: string;
  icon: IconName;
}

export interface InquiryType {
  value: string;
  label: string;
}

export interface FAQSidebar {
  image: string;
  imageAlt: string;
  caption: string;
  label: string;
}

interface ContactData {
  hero: {
    eyebrow: string;
    description: string;
    image: string;
    imageAlt: string;
    imagePosition: string;
    meta: string;
  };
  channels: ContactChannel[];
  inquiryTypes: InquiryType[];
  faqs: FAQItem[];
  faqSidebar: FAQSidebar;
  purchaseInfo: {
    eyebrow: string;
    title: string;
    description: string;
    badge: { label: string } | undefined;
    cta: { label: string; href: string };
    image: {
      src: string;
      alt: string;
      label: string;
      caption: string;
    };
    items: PurchaseInfoItem[];
  };
  emailBanner: {
    eyebrow: string;
    title: string;
    description: string;
    ctaLabel: string;
  };
}

const contactChannels: ContactChannel[] = [
  {
    label: 'Email',
    value: contactEmail,
    description: 'Pedidos, devoluciones, incidencias y atención general.',
    href: `mailto:${contactEmail}`,
    icon: 'mail',
  },
  ...(contactPhone
    ? [
        {
          label: 'Teléfono',
          value: contactPhone,
          description: contactLegalName
            ? `Atención telefónica de ${contactLegalName}.`
            : 'Atención telefónica.',
          href: toTelHref(contactPhone),
          icon: 'phone' as const,
        },
      ]
    : []),
  {
    label: 'Instagram',
    value: site.social.instagram.handle,
    description: 'La actualidad visual de la marca.',
    href: site.social.instagram.href,
    icon: 'instagram',
    meta: 'Red social',
  },
];

export const contactData = {
  hero: {
    eyebrow: 'Contacto',
    description:
      'Producto, pedidos, colaboraciones o cualquier pregunta sobre KingBelt. Cuéntanos qué necesitas y continuamos desde ahí.',
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Persona sujetando varios cinturones de cuero en un taller',
    imagePosition: 'center 52%',
    meta: 'KingBelt · Contacto',
  },

  channels: contactChannels,

  inquiryTypes: [
    { value: 'producto', label: 'Producto y materiales' },
    { value: 'pedido', label: 'Pedido' },
    { value: 'devolucion', label: 'Devolución o incidencia' },
    { value: 'colaboracion', label: 'Colaboración o prensa' },
    { value: 'otro', label: 'Otra consulta' },
  ],

  faqs: [
    {
      question: '¿Cómo elijo la talla correcta?',
      answer:
        'Consulta nuestra guía de tallas para conocer los métodos de medición. La equivalencia depende del modelo: revisa la ficha del producto o escríbenos con tu medida antes de comprar.',
      category: 'Tallaje',
      icon: 'ruler',
    },
    {
      question: '¿Dónde puedo ver información de envío?',
      answer:
        'Consulta la política de envíos para plazos, seguimiento e incidencias. El coste y la modalidad aplicables se muestran antes de confirmar el pedido.',
      category: 'Envío',
      icon: 'truck',
    },
    {
      question: '¿Qué hago si la talla no me conviene?',
      answer:
        'Tienes 30 días naturales desde la recepción para devolver el producto. La vía recomendada para un cambio de talla es devolver la pieza y hacer un pedido nuevo. Consulta la política de devoluciones para plazos, gastos y reembolsos.',
      category: 'Cambios',
      icon: 'rotate-ccw',
    },
    {
      question: '¿Cómo debo cuidar el cuero?',
      answer:
        'En la guía de cuidados encontrarás recomendaciones generales. Las instrucciones específicas por material se indicarán en cada ficha de producto cuando estén disponibles.',
      category: 'Cuidado',
      icon: 'shield-check',
    },
    {
      question: '¿Cómo puedo contactar con KingBelt?',
      answer:
        'Por email en contabilidad@cintuelx.com o por teléfono. Indica el número de pedido, el modelo o el contexto de tu consulta para que podamos orientarte con más precisión.',
      category: 'Atención',
      icon: 'mail',
    },
  ] satisfies FAQItem[],

  faqSidebar: {
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Detalle de un cinturón KingBelt sobre superficie de trabajo',
    caption: 'Cada pieza se revisa con atención antes de salir.',
    label: 'Producto',
  },

  purchaseInfo: {
    eyebrow: 'Tu compra',
    title: 'Información clara, desde el pedido.',
    description:
      'El plazo estimado de entrega se indica al comprar. Tienes 30 días para devolver. Si necesitas ayuda con un pedido, escríbenos a contabilidad@cintuelx.com.',
    badge: undefined,
    cta: {
      label: 'Centro de ayuda',
      href: '/ayuda',
    },
    image: {
      src: '/images/brand/cinturones-en-taller.jpg',
      alt: 'Detalle de cinturón de cuero KingBelt',
      label: 'Producto',
      caption: 'Información de compra disponible en el centro de ayuda.',
    },
    items: [
      {
        title: 'Guía de tallas',
        description: 'Métodos de medición y equivalencias por modelo cuando estén publicadas.',
        label: 'Tallaje',
        icon: 'ruler',
      },
      {
        title: 'Envíos',
        description: 'Zonas, plazos, seguimiento e incidencias de transporte.',
        label: 'Envío',
        icon: 'truck',
      },
      {
        title: 'Devoluciones',
        description: '30 días desde la recepción, desistimiento y reembolsos.',
        label: 'Cambios',
        icon: 'rotate-ccw',
      },
      {
        title: 'Atención directa',
        description: contactPhone
          ? `Escríbenos a ${LEGAL_CONTACT_EMAIL} o llama al ${contactPhone}.`
          : `Escríbenos a ${LEGAL_CONTACT_EMAIL}.`,
        label: 'Contacto',
        icon: 'mail',
      },
    ] satisfies PurchaseInfoItem[],
  },

  emailBanner: {
    eyebrow: 'Escríbenos',
    title: 'Una conversación clara desde el primer mensaje.',
    description:
      'Explica qué pieza, pedido o propuesta tienes en mente. Cuanto más concreto sea el contexto, más fácil será orientar la respuesta sin intercambios innecesarios.',
    ctaLabel: 'Enviar email',
  },
} satisfies ContactData;
