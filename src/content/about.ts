export interface AboutPrinciple {
  number: string;
  label: string;
  title: string;
  text: string;
  meta: string;
}

export interface AboutContextPoint {
  number: string;
  label: string;
  title: string;
  text: string;
}

export interface AboutReadingLayer {
  number: string;
  label: string;
  text: string;
  meta: string;
}

export const aboutPage = {
  meta: {
    title: 'Sobre KingBelt — Criterio, producto y dirección',
    description:
      'KingBelt es una marca masculina que empieza por el cinturón y avanza desde la utilidad, el material y un diseño sin exceso.',
  },

  hero: {
    eyebrow: 'Sobre KingBelt',
    title: 'El cinturón no debería ser <em>lo último que eliges.</em>',
    lede:
      'KingBelt empieza por una pieza cotidiana para hacerla mejor: más consciente, más útil y con una identidad que no necesita levantar la voz.',
    image: '/images/imagen-cinturon-kingbelt-11.avif',
    imageAlt: 'Detalle de hebilla plateada y costura en contraste de un cinturón de cuero marrón KingBelt',
    imagePosition: 'center 54%',
    meta: 'Producto · Material · Uso',
  },

  origin: {
    eyebrow: 'El punto de partida',
    title: 'Un accesorio cotidiano con <em>intención de marca.</em>',
    body:
      'KingBelt nace revisando un básico que casi siempre va en segundo plano: el cinturón. La premisa es sencilla —que ajuste bien, tenga presencia y no dependa de adornos ni de una historia prestada— pero exige disciplina en cada decisión.',
    statement: 'Menos gesto. Más criterio en cada elección.',
    image: '/images/imagen-cinturon-kingbelt-3.avif',
    imageAlt: 'Artesano trabajando el cuero con martillo de talabartero en el taller',
    imageLabel: 'Material / Uso diario',
    imageCaption: 'El accesorio como punto de partida.',
  },

  standards: {
    eyebrow: 'Nuestro criterio',
    title: 'Tres preguntas que <em>filtran</em> cada decisión.',
    lede:
      'Antes de añadir algo al producto, estas preguntas ordenan el criterio. No son una campaña: son el filtro que evita resolver por inercia.',
    badge: '3 filtros de producto',
    principles: [
      {
        number: '01',
        label: 'Función',
        title: '¿Resuelve bien su trabajo?',
        text: 'El ajuste, la comodidad y el uso real van primero. Si una decisión no mejora cómo funciona la pieza, sobra.',
        meta: 'Uso / Ajuste',
      },
      {
        number: '02',
        label: 'Material',
        title: '¿Se entiende al tocarla?',
        text: 'Buscamos materiales y herrajes con presencia honesta: que se puedan mirar de cerca y que no necesiten disfraz.',
        meta: 'Cuero / Herraje',
      },
      {
        number: '03',
        label: 'Diseño',
        title: '¿Seguirá teniendo sentido?',
        text: 'Preferimos proporciones claras, acabados sobrios y una identidad reconocible antes que una tendencia pasajera.',
        meta: 'Forma / Identidad',
      },
    ] as AboutPrinciple[],
  },

  direction: {
    eyebrow: 'Material y construcción',
    title: 'Proporción, tacto y <em>cierre</em> en equilibrio.',
    lede:
      'La lectura empieza en la superficie: ancho, grosor, respuesta del herraje y cómo se comporta la pieza al usarla.',
    panel: {
      eyebrow: 'Capas de lectura',
      statement: 'Si no se entiende al tacto, no está resuelta.',
      layers: [
        {
          number: '01',
          label: 'Proporción',
          text: 'Ancho y caída equilibrados con la hebilla y el conjunto.',
          meta: 'Ancho / Caída',
        },
        {
          number: '02',
          label: 'Herraje',
          text: 'Peso, agarre y respuesta al cerrar sin distraer en el uso.',
          meta: 'Hebilla / Cierre',
        },
        {
          number: '03',
          label: 'Material',
          text: 'Grosor y tacto honestos que mejoran con el tiempo.',
          meta: 'Cuero / Uso',
        },
      ] as AboutReadingLayer[],
    },
    image: '/images/imagen-cinturon-kingbelt-7.avif',
    imageAlt: 'Manos cortando cuero coñac con cuchilla y regla metálica',
    imageLabel: 'Lectura de producto',
    imageCaption: 'Proporción, herraje y cuero en una sola pieza.',
  },

  context: {
    eyebrow: 'En el conjunto',
    title: 'Integrado en el <em>vestuario</em>, no aislado.',
    lede:
      'KingBelt entiende el cinturón como parte del conjunto: debe resolver su función, convivir con lo que ya tienes y aportar carácter sin dominar la silueta.',
    banner: {
      eyebrow: 'La medida',
      title: 'KingBelt',
      statement: 'Que se note por <em>cómo encaja</em>, no por cuánto reclama.',
      tags: ['Producto', 'Contexto', 'Identidad'] as const,
      image: '/images/imagen-cinturon-kingbelt-14.avif',
      imageAlt: 'Cinturones de cuero marrón y negro KingBelt enrollados sobre piedra',
      imagePosition: 'center 38%',
      imageCaption: 'Contexto / Uso real',
    },
    points: [
      {
        number: '01',
        label: 'Uso diario',
        title: 'Fácil de incorporar.',
        text: 'Una pieza debe funcionar en los días normales, acompañar distintas formas de vestir y no exigir una ocasión especial.',
      },
      {
        number: '02',
        label: 'Proporción',
        title: 'Presencia en su medida.',
        text: 'El cuero, la hebilla y el ancho deben sentirse equilibrados entre sí y mantener la atención donde corresponde.',
      },
      {
        number: '03',
        label: 'Conjunto',
        title: 'Pensado para convivir.',
        text: 'La identidad aparece en la forma y acompaña prendas diferentes sin convertir el accesorio en un disfraz.',
      },
    ] as AboutContextPoint[],
  },

  cta: {
    eyebrow: 'Lo que viene',
    title: 'La marca sigue <em>construyéndose</em>.',
    description:
      'Nuevas piezas, talleres y decisiones de producto van tomando forma. Si quieres seguir el proceso o preguntar por lo que viene, escríbenos.',
    label: 'Hablar con KingBelt',
    href: '/contacto',
  },
} as const;
