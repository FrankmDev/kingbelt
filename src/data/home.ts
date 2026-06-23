export const hero = {
  eyebrow: 'Hecho en España',
  title: 'Cinturones con carácter, hechos para durar.',
  body: 'Piel seleccionada, herrajes sólidos y una estética motera depurada. Diseñados para el uso diario y para envejecer bien con el tiempo.',
  image: 'https://picsum.photos/seed/motorcycle-highway/1920/1080',
  imageAlt: 'Carretera secundaria al atardecer',
  primaryCta: { label: 'Ver colección', href: '#coleccion' },
  secondaryCta: { label: 'Comprar en Amazon', href: 'https://amazon.com/kingbelt' },
  tertiaryCta: { label: 'Consultar por WhatsApp', href: 'https://wa.me/1234567890' },
};

export const stats = [
  {
    icon: 'ruler',
    value: '8',
    unit: '',
    label: 'Modelos',
    desc: 'Una colección depurada de cinturones masculinos para uso diario.',
  },
  {
    icon: 'shield',
    value: '4',
    unit: '',
    label: 'Colores',
    desc: 'Tonos seleccionados para combinar con el armario de un hombre adulto.',
  },
  {
    icon: 'engine',
    value: '1',
    unit: '',
    label: 'Estándar',
    desc: 'Piel con cuerpo, herraje con peso, costuras que no ceden.',
  },
] as const;

export const bentoCards = [
  {
    id: 1,
    title: 'Cuero seleccionado',
    text: 'Piel con cuerpo y tacto, pensada para ganar pátina con el uso.',
    image: 'https://picsum.photos/seed/leather-texture/600/600',
    spans: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 2,
    title: 'Herrajes con peso',
    text: 'Hebillas macizas, sin aleaciones que se degradan con el tiempo.',
    image: 'https://picsum.photos/seed/steel-detail/600/600',
    spans: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 3,
    title: 'Hecho en España',
    text: 'Producción próxima y revisada pieza a pieza.',
    image: 'https://picsum.photos/seed/hand-craft/600/600',
    spans: 'md:col-span-1 md:row-span-1',
  },
] as const;

export const marqueeLine =
  'CUERO REAL · HERRAJES SÓLIDOS · HECHO EN ESPAÑA · ESTÉTICA MOTERA · USO DIARIO';

export const processSteps = [
  { num: '01', title: 'Piel', text: 'Cuero con cuerpo, elegido por tacto, color y presencia.' },
  { num: '02', title: 'Corte', text: 'Plantillas de acero templado para medidas exactas.' },
  { num: '03', title: 'Montaje', text: 'Costuras limpias y herrajes sólidos para uso diario.' },
] as const;
