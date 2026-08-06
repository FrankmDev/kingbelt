export const blogCategories = [
  { label: 'Estilo', slug: 'estilo' },
  { label: 'Cuero y materiales', slug: 'cuero-y-materiales' },
  { label: 'Guías de compra', slug: 'guias-de-compra' },
  { label: 'Cuidados', slug: 'cuidados' },
  { label: 'Cultura y carretera', slug: 'cultura-y-carretera' },
  { label: 'Accesorios', slug: 'accesorios' },
] as const;

type BlogCategory = (typeof blogCategories)[number]['label'];

export interface BlogSection {
  id: string;
  title: string;
  paragraphs: string[];
  points?: string[];
}

export interface BlogPost {
  title: string;
  slug: string;
  category: BlogCategory;
  excerpt: string;
  date: string;
  dateLabel: string;
  readingTime: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  status: 'featured' | 'normal';
  introduction: string;
  sections: BlogSection[];
}

export const blogPosts: BlogPost[] = [
  {
    title: 'Cómo elegir el ancho correcto de un cinturón',
    slug: 'como-elegir-ancho-correcto-cinturon',
    category: 'Guías de compra',
    excerpt:
      'Una referencia práctica para relacionar trabillas, hebilla y proporción sin depender de reglas rígidas.',
    date: '2026-07-10',
    dateLabel: '10 julio 2026',
    readingTime: '6 min',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Cinturón negro enrollado frente a una motocicleta',
    imagePosition: 'center 68%',
    status: 'featured',
    introduction:
      'El ancho de un cinturón cambia cómo se relacionan la hebilla, las trabillas y la silueta del pantalón. No existe una medida universal, pero sí una forma sencilla de elegir con criterio.',
    sections: [
      {
        id: 'empieza-por-las-trabillas',
        title: 'Empieza por las trabillas',
        paragraphs: [
          'La primera comprobación es física: el cinturón debe pasar con holgura por todas las trabillas. Si entra demasiado justo, el uso diario será incómodo y el roce se concentrará siempre en los mismos puntos.',
          'Una trabilla amplia admite más opciones, pero eso no significa que el cinturón más ancho sea siempre el mejor. La proporción del pantalón sigue marcando el conjunto.',
        ],
      },
      {
        id: 'relaciona-ancho-y-formalidad',
        title: 'Relaciona ancho y formalidad',
        paragraphs: [
          'Los anchos contenidos suelen integrarse mejor en conjuntos formales o limpios. Los anchos con más presencia funcionan bien con denim, tejidos resistentes y prendas de construcción marcada.',
          'La clave es que el cinturón acompañe al pantalón. Si domina visualmente el conjunto antes que cualquier otra pieza, probablemente hay un desajuste de escala.',
        ],
      },
      {
        id: 'mira-la-hebilla',
        title: 'Mira también la hebilla',
        paragraphs: [
          'Una correa ancha con una hebilla mínima puede quedar desequilibrada; una correa estrecha con una hebilla pesada puede concentrar demasiado peso visual en el centro.',
          'Comprueba las tres piezas juntas —trabilla, correa y hebilla— y elige la combinación que se lea como una unidad.',
        ],
        points: ['Pasa sin rozar en exceso.', 'Guarda proporción con el pantalón.', 'Equilibra el tamaño de la hebilla.'],
      },
    ],
  },
  {
    title: 'Qué diferencia existe entre los distintos tipos de cuero',
    slug: 'diferencias-entre-tipos-de-cuero',
    category: 'Cuero y materiales',
    excerpt:
      'Vocabulario esencial para leer una descripción de material y entender qué información importa de verdad.',
    date: '2026-07-07',
    dateLabel: '7 julio 2026',
    readingTime: '8 min',
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Selección de tiras de cuero en un espacio de trabajo',
    imagePosition: 'center',
    status: 'normal',
    introduction:
      'Las palabras que describen el cuero pueden ayudar a comparar piezas, pero también pueden generar confusión. Conviene separar el origen del material, su acabado y la información que realmente explica cómo se comportará.',
    sections: [
      {
        id: 'que-describe-el-nombre',
        title: 'Qué describe realmente el nombre',
        paragraphs: [
          'Términos como plena flor, flor corregida o serraje hablan de la capa utilizada y del tratamiento de la superficie. No sustituyen a una explicación completa sobre grosor, acabado o mantenimiento.',
          'Una descripción útil debe permitir entender el tacto, la estructura y el uso previsto, no limitarse a una etiqueta atractiva.',
        ],
      },
      {
        id: 'acabado-y-comportamiento',
        title: 'El acabado cambia el comportamiento',
        paragraphs: [
          'Aceites, ceras, pigmentos y capas protectoras modifican el aspecto y la respuesta frente al roce o la humedad. Dos piezas de una materia prima similar pueden envejecer de forma distinta por su acabado.',
          'Si buscas una evolución visible con el uso, fíjate en cómo se describe la superficie. Si priorizas uniformidad, busca un acabado más estable y fácil de limpiar.',
        ],
      },
      {
        id: 'preguntas-utiles',
        title: 'Las preguntas que sí ayudan',
        paragraphs: ['Antes de decidir, reúne información concreta y comparable.'],
        points: ['Qué parte del cuero se utiliza.', 'Qué acabado lleva la superficie.', 'Qué cuidados recomienda la marca.', 'Cómo está construida la pieza.'],
      },
    ],
  },
  {
    title: 'Cinco errores al combinar cinturón y calzado',
    slug: 'errores-combinar-cinturon-calzado',
    category: 'Estilo',
    excerpt:
      'Cómo coordinar tono, textura y nivel de formalidad sin convertir el conjunto en un uniforme.',
    date: '2026-07-03',
    dateLabel: '3 julio 2026',
    readingTime: '5 min',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón marrón junto a una motocicleta',
    imagePosition: 'center 66%',
    status: 'normal',
    introduction:
      'Combinar cinturón y calzado no consiste en encontrar dos tonos idénticos. El objetivo es que compartan un nivel de formalidad y una relación de color suficientemente clara.',
    sections: [
      {
        id: 'buscar-una-copia-exacta',
        title: '1. Buscar una copia exacta del color',
        paragraphs: [
          'Cuero, ante y textiles responden de forma distinta a la luz. Forzar una coincidencia perfecta suele ser innecesario; basta con que ambos elementos pertenezcan a una familia de color compatible.',
        ],
      },
      {
        id: 'ignorar-textura-formalidad',
        title: '2. Ignorar textura y formalidad',
        paragraphs: [
          'Un zapato pulido y fino pide un cinturón contenido. Una bota robusta admite más grano, grosor y presencia. La textura puede unir mejor el conjunto que el color exacto.',
          'También conviene evitar que la hebilla introduzca un lenguaje mucho más llamativo que el resto de accesorios.',
        ],
      },
      {
        id: 'otros-tres-errores',
        title: '3. Tres errores fáciles de evitar',
        paragraphs: ['Revisa el conjunto completo antes de salir, no las piezas por separado.'],
        points: ['Añadir demasiados tonos de cuero.', 'Usar un cinturón muy casual con calzado formal.', 'Convertir la combinación en una regla rígida.'],
      },
    ],
  },
  {
    title: 'Cómo conservar un cinturón de piel',
    slug: 'como-conservar-cinturon-piel',
    category: 'Cuidados',
    excerpt:
      'Limpieza, descanso y almacenamiento: una rutina sencilla para evitar deformaciones y desgaste prematuro.',
    date: '2026-06-28',
    dateLabel: '28 junio 2026',
    readingTime: '7 min',
    image: '/images/blog/cinturon-marron-oscuro.jpg',
    imageAlt: 'Cinturón marrón oscuro extendido frente a una rueda de motocicleta',
    imagePosition: 'center 65%',
    status: 'normal',
    introduction:
      'Un cinturón de piel no necesita una rutina complicada. La constancia, un almacenamiento correcto y productos adecuados suelen importar más que intervenir con frecuencia.',
    sections: [
      {
        id: 'limpieza-habitual',
        title: 'Limpieza habitual',
        paragraphs: [
          'Retira el polvo con un paño suave y seco después de los usos más exigentes. Si la pieza se humedece, deja que se seque a temperatura ambiente antes de guardarla.',
          'Evita fuentes directas de calor: aceleran el secado y pueden endurecer o deformar el material.',
        ],
      },
      {
        id: 'acondicionar-con-medida',
        title: 'Acondicionar con medida',
        paragraphs: [
          'Aplica únicamente productos compatibles con el acabado del cinturón y prueba primero en una zona poco visible. Una cantidad pequeña, bien extendida, permite controlar mejor el resultado.',
          'Más producto no significa más protección. El exceso puede alterar el tono, dejar residuos o cambiar el tacto.',
        ],
      },
      {
        id: 'guardar-sin-deformar',
        title: 'Guardar sin deformar',
        paragraphs: ['Guárdalo lejos de humedad persistente y sin pliegues cerrados.'],
        points: ['Colgado por la hebilla o enrollado con amplitud.', 'Sin peso encima.', 'En un espacio seco y ventilado.'],
      },
    ],
  },
  {
    title: 'El cinturón como parte del conjunto',
    slug: 'cinturon-como-parte-del-conjunto',
    category: 'Estilo',
    excerpt:
      'Una pieza discreta puede ordenar silueta, color y proporción sin reclamar toda la atención.',
    date: '2026-06-21',
    dateLabel: '21 junio 2026',
    readingTime: '4 min',
    image: '/images/blog/cinturon-negro.jpg',
    imageAlt: 'Detalle de cinturón negro y hebilla metálica',
    imagePosition: 'center 72%',
    status: 'normal',
    introduction:
      'El cinturón ocupa poco espacio, pero atraviesa el centro visual del conjunto. Su función es cerrar y ordenar, no necesariamente convertirse en el punto protagonista.',
    sections: [
      {
        id: 'una-linea-en-la-silueta',
        title: 'Una línea en la silueta',
        paragraphs: [
          'El contraste entre pantalón, cinturón y parte superior puede dividir la figura o darle continuidad. Un tono próximo al pantalón produce una transición discreta; uno más contrastado marca la cintura.',
        ],
      },
      {
        id: 'repetir-sin-clonar',
        title: 'Repetir sin clonar',
        paragraphs: [
          'Repetir una familia de color o un acabado metálico crea coherencia. No es necesario que reloj, calzado y cinturón sean idénticos: una relación reconocible resulta más natural.',
          'En conjuntos sencillos, textura y hebilla aportan matiz sin añadir otra prenda o color.',
        ],
      },
      {
        id: 'decidir-en-orden',
        title: 'Decidir en el orden correcto',
        paragraphs: ['Parte del pantalón y del calzado; después elige el cinturón que complete la relación.'],
        points: ['Nivel de formalidad.', 'Familia de color.', 'Escala de correa y hebilla.'],
      },
    ],
  },
  {
    title: 'Accesorios masculinos que no dependen de tendencias',
    slug: 'accesorios-masculinos-sin-tendencias',
    category: 'Accesorios',
    excerpt:
      'Pocas piezas, funciones claras y materiales que ganan presencia con el uso.',
    date: '2026-06-15',
    dateLabel: '15 junio 2026',
    readingTime: '6 min',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Detalle frontal de un cinturón marrón',
    imagePosition: 'center 62%',
    status: 'normal',
    introduction:
      'Los accesorios más útiles no necesitan cambiar cada temporada. Resuelven una función concreta, se integran con facilidad y soportan el uso sin depender de un gesto de moda muy marcado.',
    sections: [
      {
        id: 'menos-piezas-mas-claras',
        title: 'Menos piezas, decisiones más claras',
        paragraphs: [
          'Un cinturón versátil, una cartera compacta y un bolso adecuado a la rutina cubren más situaciones que una colección de objetos difíciles de combinar.',
          'La selección mejora cuando cada pieza tiene un contexto real de uso y no duplica una función ya resuelta.',
        ],
      },
      {
        id: 'material-y-construccion',
        title: 'Material y construcción antes que tendencia',
        paragraphs: [
          'Observa uniones, cantos, cierres y zonas de esfuerzo. Son detalles menos llamativos en una fotografía, pero determinan cómo se siente el accesorio al usarlo.',
        ],
      },
      {
        id: 'una-base-practica',
        title: 'Una base práctica',
        paragraphs: ['Empieza por piezas neutras y añade carácter solo donde tenga sentido para tu forma de vestir.'],
        points: ['Cinturón proporcionado a tus pantalones habituales.', 'Cartera que no añada volumen innecesario.', 'Bolso o mochila ajustado a lo que transportas.'],
      },
    ],
  },
  {
    title: 'Cómo medir un cinturón que ya te queda bien',
    slug: 'como-medir-un-cinturon',
    category: 'Guías de compra',
    excerpt:
      'El método más directo para obtener una referencia útil antes de elegir talla.',
    date: '2026-06-08',
    dateLabel: '8 junio 2026',
    readingTime: '4 min',
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Tiras de cuero sostenidas en un taller',
    imagePosition: '60% center',
    status: 'normal',
    introduction:
      'Medir un cinturón que ya utilizas evita depender solo de la talla escrita. La referencia más útil es la distancia que realmente usas al abrocharlo.',
    sections: [
      {
        id: 'elige-la-referencia',
        title: 'Elige una buena referencia',
        paragraphs: [
          'Usa un cinturón que te resulte cómodo con el tipo de pantalón para el que buscas reemplazo. Extiéndelo sobre una superficie plana sin tensarlo ni curvarlo.',
        ],
      },
      {
        id: 'mide-hasta-el-agujero',
        title: 'Mide hasta el agujero que utilizas',
        paragraphs: [
          'Toma la medida desde el punto donde la hebilla se une a la correa hasta el agujero habitual. No midas la longitud total: incluye material que no determina el ajuste.',
          'Anota la cifra y compárala con la guía específica del producto, porque el criterio de tallaje puede variar entre marcas.',
        ],
      },
      {
        id: 'evita-errores',
        title: 'Evita estos errores',
        paragraphs: ['Una medición sencilla es suficiente si mantienes siempre los mismos puntos.'],
        points: ['Medir desde el extremo exterior de la hebilla.', 'Incluir toda la punta del cinturón.', 'Tomar como referencia una pieza que ya queda mal.'],
      },
    ],
  },
  {
    title: 'Hebillas: proporción, acabado y presencia',
    slug: 'hebillas-proporcion-acabado-presencia',
    category: 'Accesorios',
    excerpt:
      'Tres criterios para entender por qué una hebilla cambia la lectura completa de un cinturón.',
    date: '2026-05-30',
    dateLabel: '30 mayo 2026',
    readingTime: '5 min',
    image: '/images/blog/cinturon-marron-oscuro.jpg',
    imageAlt: 'Hebilla metálica sobre un cinturón marrón oscuro',
    imagePosition: 'center 72%',
    status: 'normal',
    introduction:
      'La hebilla define el centro del cinturón y concentra buena parte de su carácter. Su tamaño, acabado y forma deben leerse junto a la correa y al conjunto.',
    sections: [
      {
        id: 'proporcion',
        title: 'Proporción',
        paragraphs: [
          'Una hebilla amplia necesita una correa con presencia suficiente para sostenerla visualmente. En pantalones formales, una escala más contenida suele integrarse con mayor facilidad.',
        ],
      },
      {
        id: 'acabado',
        title: 'Acabado',
        paragraphs: [
          'Los acabados pulidos reflejan más luz y llaman antes la atención. Los cepillados o envejecidos de forma sobria reducen el contraste y funcionan bien en conjuntos cotidianos.',
          'No hace falta igualar todos los metales, pero sí evitar que compitan entre ellos.',
        ],
      },
      {
        id: 'presencia',
        title: 'Presencia',
        paragraphs: ['Piensa en la hebilla como un acento: debe tener intención sin imponer un tema al conjunto.'],
        points: ['Escala acorde a la correa.', 'Acabado relacionado con el uso.', 'Forma cómoda al sentarse y moverse.'],
      },
    ],
  },
  {
    title: 'Cuándo descansar un cinturón entre usos',
    slug: 'cuando-descansar-un-cinturon',
    category: 'Cuidados',
    excerpt:
      'Alternar piezas ayuda a que el material recupere su forma y envejezca de manera más regular.',
    date: '2026-05-14',
    dateLabel: '14 mayo 2026',
    readingTime: '3 min',
    image: '/images/blog/cinturon-marron.jpg',
    imageAlt: 'Cinturón marrón enrollado sobre una superficie oscura',
    imagePosition: 'center 70%',
    status: 'normal',
    introduction:
      'Alternar cinturones no es una regla obligatoria, pero puede ayudar cuando una pieza recibe uso intenso. El descanso permite que el material pierda humedad y recupere parte de su forma.',
    sections: [
      {
        id: 'cuando-conviene-alternar',
        title: 'Cuándo conviene alternar',
        paragraphs: [
          'Si el cinturón se ha mojado, ha soportado calor o ha permanecido muchas horas bajo tensión, déjalo reposar antes del siguiente uso. No lo guardes todavía húmedo.',
        ],
      },
      {
        id: 'como-dejarlo-descansar',
        title: 'Cómo dejarlo descansar',
        paragraphs: [
          'Desabróchalo, retíralo del pantalón y colócalo extendido o enrollado sin apretar. Un espacio ventilado y alejado de radiadores facilita un secado gradual.',
          'Revisa especialmente la zona de los agujeros y la curva próxima a la hebilla, donde se concentra el esfuerzo.',
        ],
      },
      {
        id: 'senales-de-uso',
        title: 'Señales para observar',
        paragraphs: ['El uso deja marcas normales; lo importante es distinguirlas de una deformación continuada.'],
        points: ['Curvatura que no se relaja.', 'Humedad o tacto frío persistente.', 'Tensión visible alrededor del agujero habitual.'],
      },
    ],
  },
];

export const getBlogPostPath = (post: Pick<BlogPost, 'slug'>) => `/blog/${post.slug}`;

export const blogPage = {
  meta: {
    title: 'Revista KingBelt — Estilo, cuero y cultura de carretera',
    description:
      'Guías y lecturas sobre estilo masculino, cinturones, materiales, cuidados, accesorios y cultura de carretera.',
  },
  hero: {
    eyebrow: 'Revista KingBelt',
    title: 'Objetos, estilo y cultura <em>para el camino.</em>',
    lede:
      'Una revista sobre las piezas que usamos, cómo elegirlas y la cultura que las acompaña. Lecturas directas, sin ruido.',
    issue: 'Cuaderno 01 · Verano 2026',
    image: '/images/brand/cinturones-en-taller.jpg',
    imageAlt: 'Selección de tiras de cuero en un espacio de trabajo',
    imagePosition: 'center 48%',
  },
} as const;
