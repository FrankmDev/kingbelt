import { site } from './site';
import type { IconName } from '../components/ui/icon-paths';

export interface ContactChannel {
  label: string;
  value: string;
  description?: string;
  href: string;
  icon: IconName;
  meta?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category: string;
  icon: IconName;
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
    badge: { label: string };
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
    image: '/image.jpg',
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
      meta: 'Respuesta en 24h',
    },
    {
      label: 'Instagram',
      value: '@kingbelt',
      description: 'La actualidad visual de la marca.',
      href: site.urls.instagram,
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
      question: '¿Dónde fabricáis los cinturones?',
      answer:
        'Todas las piezas se diseñan y se terminan en España, trabajando con curtidurías y talleres locales. La piel es de origen europeo y la herrajería se funde en pequeñas series para mantener el control de calidad.',
      category: 'Hecho en España',
      icon: 'hammer',
    },
    {
      question: '¿Cuánto tarda en llegar mi pedido?',
      answer:
        'Para envíos peninsulares, el plazo estimado es de 24 a 72 horas laborables. Baleares, Canarias y envíos internacionales pueden ampliarse entre 3 y 7 días laborables. Siempre recibirás un enlace de seguimiento en cuanto el paquete salga de nuestro taller.',
      category: 'Envío',
      icon: 'truck',
    },
    {
      question: '¿Qué pasa si la talla no me conviene?',
      answer:
        'Puedes consultar nuestra guía de tallas antes de comprar. Si una vez recibido el cinturón necesitas un cambio, dispones de 14 días naturales desde la entrega. El producto debe estar sin usar y en su embalaje original.',
      category: 'Cambios',
      icon: 'ruler',
    },
    {
      question: '¿Incluye caja de regalo?',
      answer:
        'Sí. Cada cinturón viaja en una caja de cartón rígido forrada interiormente, pensada para proteger la pieza y para abrirse como si fuera un regalo. Además incluye una bolsa de algodón para guardarlo.',
      category: 'Embalaje',
      icon: 'gift',
    },
    {
      question: '¿Cómo debo cuidar el cuero?',
      answer:
        'Evita el contacto prolongado con el agua y los productos químicos. Para mantener el brillo, limpia con un paño seco y aplica una ligera capa de crema hidratante para cuero de vez en cuando. Con el uso, la piel ganará un tono único propio.',
      category: 'Cuidado',
      icon: 'shield-check',
    },
  ] satisfies FAQItem[],

  faqSidebar: {
    image: '/image.jpg',
    imageAlt: 'Detalle de un cinturón KingBelt sobre superficie de trabajo',
    caption: 'Cada pieza se revisa a mano antes de salir del taller.',
    label: 'Taller',
  },

  purchaseInfo: {
    eyebrow: 'Tu compra',
    title: 'Todo claro, desde el pedido.',
    description:
      'Embalaje, envío y cambios resueltos con el mismo criterio que aplicamos al producto: directo, sin letra pequeña.',
    badge: {
      label: 'Hecho en España',
    },
    cta: {
      label: 'Ver la colección',
      href: '/coleccion',
    },
    image: {
      src: '/image.jpg',
      alt: 'Caja de regalo KingBelt con cinturón de cuero en bolsa de algodón',
      label: 'Embalaje',
      caption: 'Cada pieza viaja protegida y lista para abrirse.',
    },
    items: [
      {
        title: 'Preparado para llegar bien',
        description: 'Protegemos cada pieza y la enviamos en su caja con bolsa de algodón.',
        label: 'Embalaje',
        meta: 'Caja incluida',
        icon: 'package',
      },
      {
        title: 'Envío con seguimiento',
        description: 'Recibirás un enlace para consultar el estado de tu pedido en tiempo real.',
        label: 'Envío',
        meta: '24–72h península',
        icon: 'truck',
      },
      {
        title: 'Cambios sencillos',
        description: 'Dispones de 14 días naturales para solicitar un cambio de talla sin complicaciones.',
        label: 'Cambios',
        meta: '14 días',
        icon: 'ruler',
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
