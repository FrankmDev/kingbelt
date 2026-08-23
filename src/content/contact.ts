import { site } from '@config/site';
import { businessFacts, confirmed, toTelHref, toWhatsAppHref, FREE_SHIPPING_DETAIL, FREE_SHIPPING_LABEL } from '@config/business';
import { LEGAL_CONTACT_EMAIL } from './legal-bodies';
import type { IconName } from '../components/ui/icon-paths';
import type { FAQItem } from './faq';

const contactEmail = confirmed(businessFacts.email) ?? site.contact.email;
const contactPhone = confirmed(businessFacts.contactPhone);
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
    hints: { label: string; text: string }[];
  };
}

const contactChannels: ContactChannel[] = [
  {
    label: 'Email',
    value: contactEmail,
    description: 'Pedidos, devoluciones, incidencias y atención general.',
    href: `mailto:${contactEmail}`,
    icon: 'mail',
    meta: 'Canal principal',
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
          meta: 'Atención directa',
        },
        {
          label: 'WhatsApp',
          value: contactPhone,
          description: 'Mensajes para consultas rápidas sobre producto y pedidos.',
          href: toWhatsAppHref(contactPhone),
          icon: 'whatsapp' as const,
          meta: 'Respuesta ágil',
        },
      ]
    : []),
];

export const contactData = {
  hero: {
    eyebrow: 'Contacto',
    description:
      'Producto, pedidos, colaboraciones o cualquier pregunta sobre KingBelt. Cuéntanos qué necesitas y continuamos desde ahí.',
    image: '/images/imagen-cinturon-kingbelt-21.avif',
    imageAlt: 'Cinturones de cuero marrón y negro KingBelt sobre piedra texturizada',
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
      question: '¿Cuánto cuesta el envío?',
      answer: `${FREE_SHIPPING_LABEL}. ${FREE_SHIPPING_DETAIL} Consulta plazos, destinos e incidencias en la política de envíos.`,
      category: 'Envío',
      icon: 'truck',
    },
    {
      question: '¿Qué hago si la talla no me conviene?',
      answer:
        'Escríbenos antes de enviar el producto. Te indicaremos el procedimiento disponible una vez confirmadas las condiciones definitivas de devolución.',
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
      answer: `Por email en ${contactEmail}, por teléfono o WhatsApp en ${contactPhone ?? 'nuestros canales de contacto'}. Indica el número de pedido, el modelo o el contexto de tu consulta para que podamos orientarte con más precisión.`,
      category: 'Atención',
      icon: 'mail',
    },
  ] satisfies FAQItem[],

  faqSidebar: {
    image: '/images/imagen-cinturon-kingbelt-1.avif',
    imageAlt: 'Manos artesanas cortando cuero marrón con tijeras profesionales',
    caption: 'Cada pieza se revisa con atención antes de salir.',
    label: 'Producto',
  },

  purchaseInfo: {
    eyebrow: 'Tu compra',
    title: 'Información clara, desde el pedido.',
    description:
      `${FREE_SHIPPING_LABEL}: el transporte va incluido en el precio del producto. Consulta plazos, devoluciones y atención en el centro de ayuda.`,
    badge: { label: FREE_SHIPPING_LABEL },
    cta: {
      label: 'Centro de ayuda',
      href: '/ayuda',
    },
    image: {
      src: '/images/imagen-cinturon-kingbelt-8.avif',
      alt: 'Tres cinturones de cuero marrón KingBelt con costura en contraste',
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
        title: FREE_SHIPPING_LABEL,
        description:
          'El transporte va incluido en el precio. Consulta plazos, destinos e incidencias en la política de envíos.',
        label: 'Envío',
        icon: 'truck',
      },
      {
        title: 'Devoluciones',
        description: 'Solicita instrucciones antes de enviar un producto.',
        label: 'Cambios',
        icon: 'rotate-ccw',
      },
      {
        title: 'Atención directa',
        description: contactPhone
          ? `Escríbenos a ${LEGAL_CONTACT_EMAIL}, llama al ${contactPhone} o envíanos un WhatsApp.`
          : `Escríbenos a ${LEGAL_CONTACT_EMAIL}.`,
        label: 'Contacto',
        icon: 'mail',
      },
    ] satisfies PurchaseInfoItem[],
  },

  emailBanner: {
    eyebrow: 'Escríbenos',
    title: 'Una conversación clara desde el <em>primer mensaje</em>.',
    description:
      'Cuanto más concreto sea el contexto, más fácil será orientar la respuesta sin intercambios innecesarios.',
    ctaLabel: 'Enviar email',
    hints: [
      {
        label: 'Producto',
        text: 'Modelo, color o talla que tienes en mente.',
      },
      {
        label: 'Pedido',
        text: 'Número de referencia si ya has comprado.',
      },
      {
        label: 'Propuesta',
        text: 'Colaboración, prensa o cualquier contexto relevante.',
      },
    ],
  },
} satisfies ContactData;
