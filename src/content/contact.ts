import { site } from '@config/site';
import type { IconName } from '../components/ui/icon-paths';
import type { FAQItem } from './faq';

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

  channels: [
    {
      label: 'Email',
      value: site.contact.email,
      description: 'Para consultas de producto, pedidos y atención general.',
      href: `mailto:${site.contact.email}`,
      icon: 'mail',
    },
    {
      label: 'Instagram',
      value: site.social.instagram.handle,
      description: 'La actualidad visual de la marca.',
      href: site.social.instagram.href,
      icon: 'instagram',
      meta: 'Red social',
    },
  ] satisfies ContactChannel[],

  inquiryTypes: [
    { value: 'producto', label: 'Producto y materiales' },
    { value: 'pedido', label: 'Pedido' },
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
        'Las políticas de envío se publicarán en la página de envíos y devoluciones cuando estén confirmadas. Mientras tanto, escríbenos si tienes una consulta concreta.',
      category: 'Envío',
      icon: 'truck',
    },
    {
      question: '¿Qué hago si la talla no me conviene?',
      answer:
        'La política de cambios y devoluciones se publicará cuando esté confirmada. Consulta la guía de tallas antes de comprar y escríbenos si necesitas orientación.',
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
        'Por email o Instagram. Indica el modelo, la medida o el contexto de tu consulta para que podamos orientarte con más precisión.',
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
      'Envío, embalaje y cambios se detallarán cuando las políticas estén confirmadas. Mientras tanto, consulta el centro de ayuda o escríbenos.',
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
        title: 'Envíos y devoluciones',
        description: 'Políticas de envío y cambios pendientes de validación por la empresa.',
        label: 'Envío',
        icon: 'truck',
      },
      {
        title: 'Atención directa',
        description: 'Escríbenos con tu consulta concreta por email o Instagram.',
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
