export interface FAQItem {
  question: string;
  answer: string;
}

export interface ContactMethod {
  label: string;
  value: string;
  description: string;
  href: string;
  icon: string;
}

export const contactData = {
  hero: {
    eyebrow: 'Contacto',
    title: 'Háblanos. <em>Estamos aquí</em>.',
    description:
      'Si tienes dudas sobre nuestros productos, envíos o quieres saber más sobre el proceso artesanal, estaremos encantados de ayudarte.',
    image:
      'https://images.unsplash.com/photo-1560343776-97e52d3a5a2b?auto=format&fit=crop&w=1920&q=80',
    imageAlt: 'Artesano trabajando el cuero en el taller',
    meta: 'KingBelt · Madrid · Hecho en España',
  },

  methods: [
    {
      label: 'Email',
      value: 'hola@kingbelt.com',
      description: 'Respuesta en menos de 24 horas laborables',
      href: 'mailto:hola@kingbelt.com',
      icon: 'mail',
    },
    {
      label: 'WhatsApp',
      value: '+34 123 456 789',
      description: 'Respuesta inmediata en horario laboral',
      href: 'https://wa.me/1234567890',
      icon: 'paper-plane',
    },
    {
      label: 'Instagram',
      value: '@kingbelt',
      description: 'Novedades, procesos y vida de taller',
      href: 'https://instagram.com/kingbelt',
      icon: 'instagram',
    },
    {
      label: 'Estudio',
      value: 'Madrid, España',
      description: 'Visitas con cita previa. Escríbenos y coordinamos.',
      href: '#',
      icon: 'ruler',
    },
  ] satisfies ContactMethod[],

  faqs: [
    {
      question: '¿Cuánto tarda el envío?',
      answer:
        'Todos nuestros pedidos se preparan en 24–48 horas laborables. Los envíos nacionales (España peninsular) se entregan en 2–3 días hábiles. Para Europa, el plazo estimado es de 5–7 días hábiles. Las islas y destinos internacionales pueden tardar algo más; te informaremos del plazo exacto al hacer el pedido.',
    },
    {
      question: '¿Puedo devolver un producto?',
      answer:
        'Por supuesto. Tienes 14 días naturales desde la recepción para devolver cualquier artículo en su estado original. Los gastos de devolución corren por cuenta del cliente, excepto si el producto llega defectuoso. Escríbenos un email y te guiaremos en el proceso paso a paso.',
    },
    {
      question: '¿Cómo sé mi talla de cinturón?',
      answer:
        'Mide un cinturón que ya tengas y te quede bien, desde el extremo de la hebilla hasta el agujero que más uses. Esa es tu talla. Si no tienes uno a mano, mide tu cintura justo por encima de la cadera y suma 5–7 cm. Si tienes dudas, escríbenos por WhatsApp y te ayudamos encantados.',
    },
    {
      question: '¿De qué material están hechos?',
      answer:
        'Trabajamos con cuero vacuno de plena flor, seleccionado por su durabilidad y la pátina natural que adquiere con el uso. Los herrajes son de latón macizo o acero inoxidable, según el modelo. Todo se fabrica en España, en nuestro taller de Madrid, con procesos tradicionales y acabado cuidado.',
    },
    {
      question: '¿Hacéis envíos internacionales?',
      answer:
        'Sí, enviamos a todo el mundo. Los gastos y plazos varían según el destino. Al hacer el pedido, el sistema calculará el coste exacto. Para pedidos fuera de la UE, pueden aplicarse aranceles e impuestos locales, que corren por cuenta del comprador. Escríbenos si quieres un presupuesto antes de pedir.',
    },
    {
      question: '¿Los productos tienen garantía?',
      answer:
        'Todos nuestros cinturones tienen una garantía de 2 años contra defectos de fabricación. El cuero y los herrajes están diseñados para el uso diario, pero si algo falla por nuestro proceso, lo repararemos o reemplazaremos sin coste. La garantía cubre costuras, hebillas y ojetes; no cubre el desgaste natural del cuero.',
    },
  ] satisfies FAQItem[],
};
