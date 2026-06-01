export const hero = {
  eyebrow: 'Hecho a mano en España',
  title: 'Cinturones con carácter para hombres que van por libre.',
  body: 'Piel seleccionada, herrajes sólidos y una estética motera depurada. Diseñados para durar, envejecer bien y acompañarte cada día.',
  image: 'https://picsum.photos/seed/motorcycle-highway/1920/1080',
  imageAlt: 'Moto en carretera al atardecer',
  primaryCta: { label: 'Ver colección', href: '#coleccion' },
  secondaryCta: { label: 'Comprar en Amazon', href: 'https://amazon.com/kingbelt' },
};

export const stats = [
  {
    icon: 'ruler',
    value: '4.5',
    unit: 'mm',
    label: 'Espesor del cuero',
    desc: 'Piel de búfalo seleccionada a mano. Sin rellenos ni sintéticos.',
  },
  {
    icon: 'shield',
    value: '316L',
    unit: '',
    label: 'Acero inoxidable',
    desc: 'Hebillas de grado quirúrgico. Resistentes a la corrosión y al paso del tiempo.',
  },
  {
    icon: 'engine',
    value: '7',
    unit: 'Modelos',
    label: 'En colección',
    desc: 'Cada pieza es una declaración de intenciones. Ninguna es igual.',
  },
  {
    icon: 'clock',
    value: '48h',
    unit: '',
    label: 'Tiempo de curado',
    desc: 'Cada cinturón pasa por un proceso de curtido y engrase antes de salir.',
  },
] as const;

export const bentoCards = [
  {
    id: 1,
    title: 'Diseño Brutal',
    text: 'Líneas agresivas inspiradas en la mecánica pesada. Cada hebilla es una declaración de intenciones.',
    image: 'https://picsum.photos/seed/motorcycle-engine/800/1000',
    spans: 'md:col-span-2 md:row-span-2',
  },
  {
    id: 2,
    title: 'Cuero Genuino',
    text: 'Piel de curtido vegetal que mejora con el tiempo.',
    image: 'https://picsum.photos/seed/leather-texture/600/600',
    spans: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 3,
    title: 'Acero 316L',
    text: 'Hebillas de acero inoxidable quirúrgico.',
    image: 'https://picsum.photos/seed/steel-detail/600/600',
    spans: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 4,
    title: 'Hecho a Mano',
    text: 'Cada pieza es ensamblada artesanalmente.',
    image: 'https://picsum.photos/seed/hand-craft/600/600',
    spans: 'md:col-span-1 md:row-span-1',
  },
  {
    id: 5,
    title: 'Garantía de por vida',
    text: 'Construidos para durar más que cualquier moto.',
    image: 'https://picsum.photos/seed/road-eternal/600/600',
    spans: 'md:col-span-1 md:row-span-1',
  },
] as const;

export const marqueeItems = [
  'CUERO REAL',
  'HERRAJES SÓLIDOS',
  'HECHO EN ESPAÑA',
  'ESTÉTICA MOTERA',
  'USO DIARIO',
] as const;

export const processSteps = [
  { num: '01', title: 'Selección', text: 'Cada piel se inspecciona a mano. Solo las mejores piezas pasan el corte.' },
  { num: '02', title: 'Corte', text: 'Cortada a medida exacta con plantillas de acero templado.' },
  { num: '03', title: 'Curtido', text: 'Proceso de curtido vegetal de 48 horas para máxima durabilidad.' },
  { num: '04', title: 'Ensamblaje', text: 'Costuras a doble aguja y herrajes de acero 316L.' },
] as const;

export const philosophyItems = [
  {
    title: 'Materiales que aguantan el ritmo',
    body: 'Seleccionamos pieles de curtido vegetal de grueso calibre y acero inoxidable 316L. No usamos aleaciones baratas. Esto es hardware de verdad.',
    image: 'https://picsum.photos/seed/leather-belt-close/1200/800',
    index: 1,
  },
  {
    title: 'Estética sin concesiones',
    body: 'No hacemos cinturones "para todos". Hacemos cinturones para ti. Líneas agresivas, hebillas con peso y un acabado que habla antes que tú.',
    image: 'https://picsum.photos/seed/moto-cafe-style/1200/800',
    index: 2,
  },
  {
    title: 'Construidos para durar décadas',
    body: 'Un KingBelt no es un accesorio. Es una herramienta. Con el tiempo, el cuero toma tu forma. La hebilla agarra carácter. Mejora con cada kilómetro.',
    image: 'https://picsum.photos/seed/asphalt-rider-back/1200/800',
    index: 3,
  },
] as const;

export const testimonials = [
  {
    name: 'Carlos M.',
    role: 'Propietario de Harley Davidson',
    text: 'Después de probar marcas caras que se deshacen en un año, encontré KingBelt. El cuero es otra liga. La hebilla tiene peso real. Se nota que está hecho por gente que entiende de motos.',
    image: 'https://picsum.photos/seed/rider-portrait-1/400/400',
  },
  {
    name: 'Andrés R.',
    role: 'Mecánico & Customizador',
    text: 'No soy de poner reseñas, pero este cinturón se merece el reconocimiento. La calidad del acero es quirúrgica y el cuero agarra un patina increíble con el uso diario.',
    image: 'https://picsum.photos/seed/rider-portrait-2/400/400',
  },
  {
    name: 'Javier L.',
    role: 'Amante del Cafe Racer',
    text: 'El diseño es agresivo sin ser estridente. Lo uso tanto en la moto como en el trabajo. Es la pieza que más me preguntan. KingBelt entiende el estilo motero moderno.',
    image: 'https://picsum.photos/seed/rider-portrait-3/400/400',
  },
] as const;
