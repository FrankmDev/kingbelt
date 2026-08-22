import {
  LEGAL_ACTIVITY,
  LEGAL_EMAIL,
  LEGAL_NAME,
  LEGAL_PHONE_DISPLAY,
  LEGAL_REGISTERED_ADDRESS,
  LEGAL_REGISTRY_DATA,
  LEGAL_TAX_ID,
} from '@config/business';
import { currentTechnologies, externalResources } from './legal-technologies';

export type LegalInline =
  | string
  | {
      href: string;
      label: string;
      external?: boolean;
    };

export type LegalBlock =
  | { type: 'p'; children: readonly LegalInline[] }
  | { type: 'ul'; items: readonly (readonly LegalInline[])[] }
  | { type: 'h3'; text: string }
  | { type: 'address'; lines: readonly string[] }
  | { type: 'dl'; items: readonly { term: string; description: string }[] }
  | { type: 'template'; lines: readonly string[] }
  | {
      type: 'table';
      caption?: string;
      headers: readonly string[];
      rows: readonly (readonly string[])[];
    };

export interface LegalDocumentBody {
  intro?: readonly LegalBlock[];
  sections: Record<string, readonly LegalBlock[]>;
}

const p = (...children: LegalInline[]): LegalBlock => ({ type: 'p', children });
const ul = (...items: Array<LegalInline | readonly LegalInline[]>): LegalBlock => ({
  type: 'ul',
  items: items.map((item) => (Array.isArray(item) ? item : [item])),
});
const h3 = (text: string): LegalBlock => ({ type: 'h3', text });
const address = (...lines: string[]): LegalBlock => ({ type: 'address', lines });
const dl = (...items: Array<{ term: string; description: string }>): LegalBlock => ({ type: 'dl', items });
const table = (
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  caption?: string
): LegalBlock => ({ type: 'table', headers, rows, ...(caption ? { caption } : {}) });
export const template = (...lines: string[]): LegalBlock => ({ type: 'template', lines });

const mail = (value: string): LegalInline => ({ href: `mailto:${value}`, label: value });
const tel = (value: string): LegalInline => ({
  href: `tel:+34${value.replace(/\D/g, '')}`,
  label: value,
});
const page = (href: string, label: string): LegalInline => ({ href, label });
const ext = (href: string, label: string): LegalInline => ({ href, label, external: true });

export const LEGAL_CONTACT_EMAIL = LEGAL_EMAIL;
export const LEGAL_CONTACT_PHONE = LEGAL_PHONE_DISPLAY;
const LEGAL_REGISTERED_ADDRESS_SINGLE_LINE = LEGAL_REGISTERED_ADDRESS.replace(/\s*\n\s*/g, ', ');
const SHOPIFY_CONSUMER_PRIVACY = 'https://www.shopify.com/legal/privacy/customers';
const SHOPIFY_PRIVACY_PORTAL = 'https://privacy.shopify.com/en';
const EDPB_MEMBERS = 'https://www.edpb.europa.eu/about-edpb/about-edpb/members_es';

const flattenInlines = (parts: readonly LegalInline[]): string =>
  parts.map((part) => (typeof part === 'string' ? part : part.label)).join('');

export const flattenLegalBlocks = (blocks: readonly LegalBlock[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case 'p':
          return flattenInlines(block.children);
        case 'ul':
          return block.items.map((item) => flattenInlines(item)).join(' ');
        case 'h3':
          return block.text;
        case 'address':
        case 'template':
          return block.lines.join(' ');
        case 'dl':
          return block.items.map((item) => `${item.term}: ${item.description}`).join(' ');
        case 'table':
          return [
            block.caption,
            block.headers.join(' '),
            ...block.rows.map((row) => row.join(' ')),
          ]
            .filter(Boolean)
            .join(' ');
      }
    })
    .join('\n');

export const flattenLegalBodySections = (
  bodies: Record<string, LegalDocumentBody>
): Record<string, Record<string, string>> =>
  Object.fromEntries(
    Object.entries(bodies).map(([key, body]) => [
      key,
      Object.fromEntries(
        Object.entries(body.sections).map(([id, blocks]) => [id, flattenLegalBlocks(blocks)])
      ),
    ])
  );

export const avisoLegalBody: LegalDocumentBody = {
  intro: [
    p(
      'El presente Aviso Legal regula el acceso, navegación y utilización del sitio web de Kingbelt, sin perjuicio de que determinadas funcionalidades, servicios o compras se encuentren sometidos adicionalmente a condiciones específicas.'
    ),
  ],
  sections: {
    'informacion-general': [
      p(
        'En cumplimiento de la normativa aplicable a los servicios de la sociedad de la información y al comercio electrónico, se informa de que el presente sitio web es titularidad de:'
      ),
      address(
        LEGAL_NAME,
        'Nombre comercial: Kingbelt',
        `NIF: ${LEGAL_TAX_ID}`,
        `Domicilio social: ${LEGAL_REGISTERED_ADDRESS_SINGLE_LINE}`,
        `Correo electrónico: ${LEGAL_CONTACT_EMAIL}`,
        `Teléfono: ${LEGAL_CONTACT_PHONE}`,
        LEGAL_REGISTRY_DATA
      ),
      p(`Actividad: ${LEGAL_ACTIVITY}`),
      p('En adelante, “Kingbelt”, “CintuElx S.L.” o el “Titular”.'),
    ],
    objeto: [
      p(
        'El sitio web de Kingbelt tiene como finalidad proporcionar información sobre la marca y sus productos, permitir la consulta de su catálogo y posibilitar, cuando las correspondientes funcionalidades estén disponibles, la adquisición online de productos y la utilización de servicios relacionados con la compra.'
      ),
      p(
        'Las operaciones de compraventa realizadas a través de la tienda se regulan específicamente mediante las ',
        page('/condiciones', 'Condiciones Generales de Contratación y Uso'),
        ', así como mediante las políticas aplicables a envíos, devoluciones y demás aspectos de la relación contractual.'
      ),
    ],
    'condiciones-acceso': [
      p(
        'El acceso al sitio web implica que el usuario acepta utilizarlo de conformidad con la legislación vigente, el presente Aviso Legal y las demás condiciones que resulten aplicables.'
      ),
      p(
        'El acceso general al contenido público del sitio web tiene carácter libre, sin perjuicio de que determinadas funcionalidades puedan requerir la identificación del usuario, la creación o utilización de una cuenta, la realización de una compra o el cumplimiento de requisitos específicos.'
      ),
      p('El usuario se compromete a realizar un uso lícito, diligente y adecuado del sitio web.'),
      p('En particular, queda prohibido utilizar el sitio web con la finalidad de:'),
      ul(
        'desarrollar actividades ilícitas, fraudulentas o contrarias a la buena fe;',
        'introducir, transmitir o difundir virus, malware o cualquier otro código destinado a alterar, dañar o interferir con sistemas informáticos;',
        'intentar acceder sin autorización a sistemas, cuentas, datos o áreas restringidas;',
        'suplantar la identidad de otras personas;',
        'manipular, alterar o interferir deliberadamente con el funcionamiento normal de la tienda;',
        'utilizar los sistemas de Kingbelt para realizar actividades que vulneren derechos de terceros;',
        'o realizar cualquier actuación que pueda causar daños injustificados al sitio web, a Kingbelt, a sus proveedores o a otros usuarios.'
      ),
      p(
        'Kingbelt podrá adoptar las medidas técnicas y organizativas razonablemente necesarias para prevenir y responder a usos abusivos, fraudulentos o que comprometan la seguridad del sitio web.'
      ),
    ],
    'propiedad-intelectual': [
      p(
        'Los contenidos que forman parte del sitio web, incluyendo, entre otros, su diseño, estructura, textos, fotografías, imágenes, gráficos, vídeos, elementos audiovisuales, logotipos, signos distintivos, nombres comerciales, tipografías cuando corresponda, interfaces, composiciones visuales y demás contenidos protegibles son propiedad de CintuElx S.L. o se utilizan legítimamente con autorización, licencia o título suficiente de sus respectivos titulares.'
      ),
      p(
        'Estos contenidos se encuentran protegidos por la normativa aplicable en materia de propiedad intelectual e industrial.'
      ),
      p(
        'El acceso al sitio web no supone la cesión al usuario de ningún derecho de propiedad intelectual o industrial sobre sus contenidos.'
      ),
      p(
        'El usuario podrá visualizar y utilizar el contenido exclusivamente en la medida necesaria para hacer un uso normal y legítimo del sitio web.'
      ),
      p(
        'Salvo que exista autorización previa del titular correspondiente o que la legislación permita expresamente dicha utilización, queda prohibida la reproducción, distribución, comunicación pública, transformación, explotación comercial, extracción o reutilización sustancial de los contenidos del sitio web.'
      ),
    ],
    marca: [
      p(
        'La denominación Kingbelt, su identidad visual, logotipos y demás signos distintivos utilizados en el sitio web pertenecen a sus respectivos titulares y están protegidos en la medida prevista por la normativa aplicable.'
      ),
      p(
        'La presencia de estos elementos en el sitio web no concede al usuario ninguna licencia o autorización para utilizarlos con fines comerciales, publicitarios o de cualquier otra naturaleza ajena al uso ordinario del sitio.'
      ),
      p(
        'No está permitido utilizar signos idénticos o similares de forma que pueda generarse confusión sobre la identidad, procedencia empresarial, patrocinio o vinculación con Kingbelt.'
      ),
    ],
    contenidos: [
      p(
        'Kingbelt procura mantener la información publicada en el sitio web correctamente actualizada y revisar los errores que puedan detectarse.'
      ),
      p('No obstante, la información general o editorial contenida en el sitio puede ser modificada cuando resulte necesario.'),
      p(
        'La información contractual relativa a productos, precios, impuestos, disponibilidad, envío y demás condiciones aplicables a una compra será la que se comunique al cliente durante el correspondiente proceso de contratación.'
      ),
      p(
        'En caso de discrepancia entre información puramente informativa del sitio web y las condiciones específicamente aceptadas durante una compra, se estará a lo establecido en el contrato y en la legislación aplicable.'
      ),
      p(
        'Nada de lo dispuesto en este apartado limita los derechos que correspondan a consumidores y usuarios respecto de información comercial incorrecta, engañosa o contractual.'
      ),
    ],
    disponibilidad: [
      p('Kingbelt procurará mantener el sitio web disponible y en correcto funcionamiento.'),
      p(
        'No obstante, el acceso podrá verse temporalmente interrumpido como consecuencia de operaciones de mantenimiento, actualizaciones, incidencias técnicas, problemas de comunicaciones, actuaciones de proveedores tecnológicos, necesidades de seguridad o circunstancias ajenas al control razonable de Kingbelt.'
      ),
      p(
        'Cuando resulte necesario, Kingbelt podrá suspender temporalmente determinadas funcionalidades para realizar tareas técnicas o garantizar la seguridad e integridad de los sistemas.'
      ),
      p(
        'Estas interrupciones no afectarán a los derechos que legalmente correspondan al cliente respecto de pedidos o contratos ya celebrados.'
      ),
    ],
    seguridad: [
      p(
        'Kingbelt adopta medidas razonables destinadas a proteger el sitio web y reducir el riesgo de accesos no autorizados, alteraciones, pérdida de información y otros incidentes de seguridad.'
      ),
      p('No obstante, ningún sistema conectado a Internet puede garantizar una seguridad absoluta.'),
      p(
        'El usuario deberá adoptar asimismo medidas razonables para proteger sus propios dispositivos, sistemas de acceso y credenciales.'
      ),
      p(
        'En caso de detectar una vulnerabilidad, comportamiento anómalo o posible incidencia de seguridad relacionada con el sitio web, puede comunicarlo a: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
    ],
    'enlaces-terceros': [
      p('El sitio web puede contener enlaces a páginas, plataformas o servicios gestionados por terceros.'),
      p(
        'La inclusión de dichos enlaces tiene normalmente una finalidad informativa, funcional o complementaria y no implica necesariamente que Kingbelt controle o apruebe todos los contenidos, condiciones o actuaciones del sitio externo.'
      ),
      p(
        'Kingbelt no puede controlar con carácter general las modificaciones que terceros realicen posteriormente en sus propios sitios web.'
      ),
      p(
        'Cuando el usuario abandone el sitio web de Kingbelt y acceda a una página externa, deberá consultar las condiciones legales, políticas de privacidad y demás normas establecidas por dicho tercero.'
      ),
      p(
        'Lo anterior se entiende sin perjuicio de la responsabilidad que pueda corresponder legalmente a Kingbelt cuando un tercero actúe como proveedor utilizado por Kingbelt para prestar servicios propios o ejecutar obligaciones contractuales.'
      ),
    ],
    'enlaces-hacia': [
      p(
        'Con carácter general, podrán establecerse enlaces hacia páginas públicas del sitio web de Kingbelt siempre que se realicen de forma lícita y no:'
      ),
      ul(
        'falseen la relación existente con Kingbelt;',
        'sugieran una asociación, autorización, colaboración o patrocinio inexistentes;',
        'dañen ilegítimamente la reputación o imagen de Kingbelt;',
        'reproduzcan el sitio de forma que pueda inducir a error sobre su titularidad;',
        'o se utilicen desde contenidos ilícitos o que vulneren derechos de terceros.'
      ),
      p(
        'El establecimiento de un enlace no supone por sí mismo la existencia de una relación comercial, contractual o de colaboración entre Kingbelt y el titular de la página desde la que se realiza.'
      ),
    ],
    'responsabilidad-usuario': [
      p(
        'El usuario será responsable de los daños directamente derivados de un uso ilícito del sitio web que le resulte imputable conforme a la legislación aplicable.'
      ),
      p(
        'El usuario responderá igualmente de la veracidad de los datos que proporcione cuando utilice funcionalidades que requieran información personal, de contacto, entrega, facturación u otros datos necesarios para prestar un servicio.'
      ),
      p(
        'Esta disposición no supone imponer al consumidor responsabilidades que no le correspondan legalmente ni limita sus derechos como consumidor o usuario.'
      ),
    ],
    'responsabilidad-kingbelt': [
      p('Kingbelt responderá en los términos establecidos por la legislación aplicable.'),
      p(
        'El presente Aviso Legal no excluye ni limita responsabilidades que legalmente no puedan excluirse o limitarse.'
      ),
      p('Kingbelt no será responsable de daños derivados exclusivamente de:'),
      ul(
        'actuaciones ilícitas del propio usuario;',
        'utilización del sitio web contraria a sus instrucciones o finalidad;',
        'contenidos externos completamente ajenos a su control cuando legalmente no le corresponda responsabilidad;',
        'o circunstancias extraordinarias ajenas a su control, en los términos admitidos por la legislación.'
      ),
      p(
        'Esta cláusula no afecta a los derechos derivados de contratos de compraventa celebrados con Kingbelt ni a las obligaciones legales aplicables en materia de consumidores y usuarios.'
      ),
    ],
    'comercio-electronico': [
      p(
        'La comercialización de productos a través del sitio web se encuentra sujeta a las ',
        page('/condiciones', 'Condiciones Generales de Contratación y Uso'),
        ' vigentes en el momento de realizar el pedido.'
      ),
      p(
        'Antes de finalizar una compra, el cliente podrá acceder a la información contractual exigible, incluyendo las características esenciales de los productos, precio, impuestos, gastos adicionales aplicables, modalidades de pago, condiciones de entrega y derechos que le correspondan.'
      ),
      p('Las políticas comerciales relevantes se encuentran asimismo disponibles de forma independiente en el sitio web, incluyendo:'),
      ul(
        [page('/condiciones', 'Condiciones Generales de Contratación y Uso'), ';'],
        [page('/envios-y-devoluciones', 'Política de envíos'), ';'],
        [page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'), ';'],
        [page('/privacidad', 'Política de privacidad'), ';'],
        ['y ', page('/cookies', 'Política de cookies'), '.']
      ),
    ],
    'proteccion-datos': [
      p(
        'Los datos personales obtenidos a través del sitio web serán tratados conforme a la normativa vigente en materia de protección de datos.'
      ),
      p(
        'La información detallada sobre la identidad del responsable, finalidades del tratamiento, bases jurídicas, destinatarios, transferencias internacionales cuando existan, periodos de conservación y derechos de los interesados se encuentra disponible en la ',
        page('/privacidad', 'Política de privacidad'),
        ' de Kingbelt.'
      ),
    ],
    cookies: [
      p(
        'El sitio web puede utilizar cookies y otras tecnologías necesarias para su funcionamiento y, cuando corresponda, tecnologías adicionales sujetas a consentimiento.'
      ),
      p(
        'El usuario puede obtener información detallada sobre las tecnologías utilizadas, sus finalidades, duración, terceros intervinientes y mecanismos disponibles para gestionar sus preferencias consultando la ',
        page('/cookies', 'Política de cookies'),
        '.'
      ),
      p(
        'Cuando la normativa exija consentimiento previo para una determinada tecnología, esta no deberá activarse hasta que el usuario haya realizado la elección correspondiente.'
      ),
    ],
    proveedores: [
      p(
        'Kingbelt puede utilizar proveedores tecnológicos externos necesarios para operar determinadas funcionalidades del sitio web, como infraestructura de comercio electrónico, alojamiento, pagos, logística, comunicaciones, analítica u otros servicios.'
      ),
      p(
        'La intervención de estos proveedores no modifica la identidad del titular del sitio web ni, cuando Kingbelt sea el vendedor, la identidad de la parte con la que el cliente celebra el contrato de compraventa.'
      ),
      p(
        'El tratamiento de datos personales realizado en relación con estos proveedores se detalla, cuando corresponda, en la ',
        page('/privacidad', 'Política de privacidad'),
        '.'
      ),
    ],
    comunicaciones: [
      p(
        'Kingbelt podrá enviar comunicaciones comerciales por medios electrónicos únicamente en los supuestos permitidos por la legislación aplicable.'
      ),
      p(
        'Cuando el tratamiento dependa del consentimiento del usuario, este podrá retirar dicho consentimiento mediante los mecanismos facilitados al efecto.'
      ),
      p(
        'Cuando la legislación permita realizar determinadas comunicaciones comerciales sobre la base de una relación contractual previa, el usuario tendrá en todo caso la posibilidad de oponerse a seguir recibiéndolas a través de un procedimiento sencillo y gratuito.'
      ),
    ],
    modificacion: [
      p(
        'Kingbelt podrá modificar el presente Aviso Legal para adaptarlo a cambios legislativos, técnicos, organizativos o relacionados con la evolución del sitio web.'
      ),
      p(
        'La versión vigente estará disponible permanentemente en esta página e indicará la fecha de su última actualización.'
      ),
      p(
        'Las modificaciones del Aviso Legal no alterarán retroactivamente los derechos y obligaciones derivados de contratos de compraventa ya celebrados.'
      ),
    ],
    legislacion: [
      p('El presente Aviso Legal se regirá por la legislación española.'),
      p(
        'Cuando el usuario tenga la consideración de consumidor o usuario, cualquier controversia se resolverá ante los juzgados y tribunales que resulten competentes conforme a la normativa aplicable, sin que este Aviso Legal imponga al consumidor una jurisdicción distinta de la que legalmente le corresponda.'
      ),
    ],
    contacto: [
      p('Para cualquier consulta relacionada con el presente Aviso Legal o con el funcionamiento del sitio web:'),
      address(
        `${LEGAL_NAME} – Kingbelt`,
        `NIF: ${LEGAL_TAX_ID}`,
        ...LEGAL_REGISTERED_ADDRESS.split('\n')
      ),
      p('Correo electrónico: ', mail(LEGAL_CONTACT_EMAIL)),
      p('Teléfono: ', tel(LEGAL_CONTACT_PHONE)),
    ],
  },
};

export const privacidadBody: LegalDocumentBody = {
  intro: [
    p(
      'KingBelt gestiona esta tienda y este sitio web, incluidos los datos, el contenido, las funciones, las herramientas, los productos y los servicios para ofrecerle a usted, el cliente, una experiencia de compra seleccionada (los “Servicios”). KingBelt cuenta con tecnología de Shopify que nos permite ofrecerle los Servicios. Esta Política de privacidad describe cómo recopilamos, utilizamos y divulgamos su información personal cuando visita, utiliza o realiza una compra u otra transacción a través de los Servicios o cuando se comunica con nosotros por cualquier otro medio. En caso de conflicto entre nuestros Términos del Servicio y esta Política de privacidad, prevalecerá esta Política de privacidad en lo que respecta a la recopilación, el tratamiento y la divulgación de su información personal.'
    ),
    p(
      'Le rogamos que lea atentamente esta Política de privacidad. Al utilizar y acceder a cualquiera de los Servicios, usted reconoce haber leído esta Política de privacidad y entender la forma en que se recopila, utiliza y divulga su información personal, de conformidad con lo establecido en la presente Política de privacidad.'
    ),
  ],
  sections: {
    'informacion-personal': [
      p(
        'Cuando utilizamos el término "información personal", nos referimos a cualquier dato que le identifique o que pueda vincularse razonablemente con usted o con otra persona. La información personal no incluye los datos recopilados de forma anónima ni aquellos que hayan sido desidentificados, de modo que no puedan identificarle ni vincularse razonablemente con usted. Podemos recopilar o tratar las siguientes categorías de información personal —incluidas las inferencias obtenidas a partir de dicha información—, en función de cómo interactúe con los Servicios, del lugar en el que resida y de lo que permita o exija la legislación aplicable:'
      ),
      dl(
        {
          term: 'Detalles de contacto',
          description:
            'incluidos su nombre, dirección, dirección de facturación, dirección de envío, número de teléfono y dirección de correo electrónico.',
        },
        {
          term: 'Información financiera',
          description:
            'incluidos los números de tarjeta de crédito, tarjeta de débito y cuentas financieras, la información de las tarjetas de pago, los datos de cuentas financieras, los detalles de las transacciones, la forma de pago, la confirmación del pago y otra información relacionada con el pago.',
        },
        {
          term: 'Información de la cuenta',
          description:
            'incluidos su nombre de usuario, contraseña, preguntas de seguridad, preferencias y configuración.',
        },
        {
          term: 'Información sobre transacciones',
          description:
            'incluidos los artículos que consulta, añade a su carrito, guarda en su lista de deseos o compra, devuelve, cambia o cancela, así como sus transacciones anteriores.',
        },
        {
          term: 'Comunicaciones con nosotros',
          description:
            'incluida la información que nos facilite en sus comunicaciones con nosotros, por ejemplo, al enviar una reclamación al servicio de atención al cliente.',
        },
        {
          term: 'Información del dispositivo',
          description:
            'incluida información sobre su dispositivo, navegador o conexión de red, su dirección IP y otros identificadores únicos.',
        },
        {
          term: 'Información sobre el uso',
          description:
            'incluida la información relativa a su interacción con los Servicios, como el modo y el momento en que los utiliza o navega por ellos.',
        }
      ),
    ],
    fuentes: [
      p('Podemos recopilar información personal de las siguientes fuentes:'),
      dl(
        {
          term: 'Directamente de usted',
          description:
            'incluido cuando crea una cuenta, visita o utiliza los Servicios, se comunica con nosotros o nos proporciona su información personal por cualquier otro medio.',
        },
        {
          term: 'Automáticamente a través de los Servicios',
          description:
            'incluida la información procedente de su dispositivo cuando utiliza nuestros productos o servicios o visita nuestros sitios web, así como mediante el uso de cookies y tecnologías similares.',
        },
        {
          term: 'De nuestros proveedores de servicios',
          description:
            'incluido cuando los contratamos para habilitar determinada tecnología o cuando recopilan o tratan su información personal en nuestro nombre.',
        },
        {
          term: 'De nuestros partners o de otros terceros',
          description: 'cuando nos facilitan información necesaria para prestar o mejorar los Servicios.',
        }
      ),
    ],
    usos: [
      p(
        'Según cómo interactúe con nosotros o qué Servicios utilice, podemos utilizar su información personal para los siguientes fines:'
      ),
      h3('Prestar, personalizar y mejorar los Servicios'),
      p(
        'Utilizamos su información personal para prestarle los Servicios, lo que incluye cumplir el contrato celebrado con usted, procesar sus pagos, gestionar sus pedidos, recordar sus preferencias y los artículos que le interesan, enviarle notificaciones relacionadas con su cuenta, tramitar compras, devoluciones, cambios u otras transacciones, crear, mantener y gestionar su cuenta, organizar el envío, facilitar devoluciones y cambios, permitirle publicar reseñas y ofrecerle una experiencia de compra personalizada, como recomendarle productos relacionados con sus compras. Esto puede incluir el uso de su información personal para personalizar y mejorar los Servicios.'
      ),
      h3('Marketing y publicidad'),
      p(
        'Utilizamos su información personal con fines de marketing y promoción, como enviarle comunicaciones comerciales, publicitarias y promocionales por correo electrónico, mensaje de texto o correo postal, así como mostrarle anuncios en línea sobre productos o servicios en los propios Servicios o en otros sitios web, incluso en función de artículos que haya comprado previamente, añadido al carrito u otras actividades realizadas en los Servicios.'
      ),
      h3('Seguridad y prevención de fraudes'),
      p(
        'Utilizamos su información personal para autenticar su cuenta, ofrecer una experiencia de compra y pago segura, detectar, investigar o actuar ante posibles actividades fraudulentas, ilegales, peligrosas o malintencionadas, proteger la seguridad pública y garantizar la seguridad de nuestros servicios. Si decide utilizar los Servicios y registrar una cuenta, usted es responsable de mantener la confidencialidad de sus credenciales de acceso. Le recomendamos encarecidamente que no comparta su nombre de usuario, contraseña ni otra información con nadie.'
      ),
      h3('Comunicaciones con usted'),
      p(
        'Utilizamos su información personal para ofrecerle atención al cliente, responder a sus solicitudes, prestarle servicios de forma eficaz y mantener nuestra relación comercial con usted.'
      ),
      h3('Motivos legales'),
      p(
        'Utilizamos su información personal para cumplir con la legislación aplicable o responder a procedimientos legales válidos, incluidas solicitudes de organismos encargados del cumplimiento de la legislación o de autoridades gubernamentales, así como para investigar o participar en procesos de descubrimiento civil, litigios potenciales o reales u otros procedimientos legales de carácter contencioso, y para hacer cumplir o investigar posibles infracciones de nuestros términos o políticas.'
      ),
    ],
    divulgacion: [
      p(
        'En determinadas circunstancias, podemos divulgar su información personal a terceros por motivos legítimos, de conformidad con esta Política de privacidad. Tales circunstancias pueden incluir:'
      ),
      ul(
        'Con Shopify, proveedores y otros terceros que prestan servicios en nuestro nombre (por ejemplo, gestión de TI, procesamiento de pagos, análisis de datos, atención al cliente, almacenamiento en la nube, gestión de pedidos y envíos).',
        'Con partners comerciales y de marketing para prestar servicios de marketing y mostrarle publicidad. Por ejemplo, utilizamos Shopify para respaldar la publicidad personalizada mediante servicios de terceros, basada en su actividad en línea con distintos comercios y sitios web. Nuestros partners comerciales y de marketing utilizarán su información de acuerdo con sus propios avisos de privacidad. Según el lugar en el que resida, es posible que tenga derecho a indicarnos que no compartamos información sobre usted con fines de publicidad y marketing personalizados, basados en su actividad en línea con distintos emprendedores y sitios web.',
        'Cuando usted nos lo indique, lo solicite o consienta de otro modo la divulgación de determinada información a terceros, por ejemplo, para enviarle productos o mediante el uso de widgets de redes sociales o integraciones de inicio de sesión.',
        'Con nuestros afiliados o, en general, dentro de nuestro grupo empresarial.',
        'En relación con una transacción comercial, como una fusión o un proceso de insolvencia, para cumplir con las obligaciones legales aplicables (incluida la respuesta a citaciones judiciales, órdenes de registro u otras solicitudes similares), para hacer cumplir los Términos del Servicio o políticas correspondientes, y para proteger o defender los Servicios, nuestros derechos y los derechos de nuestros usuarios u otras personas.'
      ),
    ],
    shopify: [
      p(
        'Los Servicios se alojan en Shopify, que recopila y procesa información personal sobre su acceso y uso de los Servicios, a fin de proporcionarle y mejorar los Servicios para usted. Con el objetivo de ofrecerle y mejorar los Servicios, la información que usted envíe a los Servicios se transmitirá y compartirá con Shopify y con terceros que podrían estar ubicados en países diferentes al suyo. Además, para ayudar a proteger, desarrollar y mejorar nuestro negocio, utilizamos determinadas funciones avanzadas de Shopify que incorporan datos e información obtenidos a partir de sus interacciones con nuestra tienda, con otros emprendedores y con la propia plataforma de Shopify. Para ofrecer estas funciones avanzadas, Shopify puede utilizar información personal recopilada sobre sus interacciones con nuestra tienda, con otros emprendedores y con la propia plataforma de Shopify. En estas circunstancias, Shopify es responsable del tratamiento de su información personal, incluida la respuesta a sus solicitudes para ejercer sus derechos sobre el uso de dicha información para dichos fines.'
      ),
      p(
        'Para obtener más información sobre cómo Shopify utiliza su información personal y sobre los derechos que pueda tener, puede consultar la ',
        ext(SHOPIFY_CONSUMER_PRIVACY, 'Política de privacidad del consumidor de Shopify'),
        '. Según el lugar en el que resida, puede ejercer determinados derechos respecto a su información personal en el ',
        ext(SHOPIFY_PRIVACY_PORTAL, 'portal de privacidad de Shopify'),
        '.'
      ),
    ],
    'sitios-terceros': [
      p(
        'Los Servicios pueden incluir enlaces a sitios web u otras plataformas en línea gestionadas por terceros. Si accede a enlaces que dirigen a sitios no afiliados ni controlados por nosotros, le recomendamos que revise sus políticas de privacidad y seguridad y demás términos y condiciones. No garantizamos ni nos hacemos responsables de la privacidad o la seguridad de dichos sitios, incluida la exactitud, integridad o fiabilidad de la información que contengan. La información que proporcione en espacios públicos o semipúblicos —incluida la que comparta en plataformas de redes sociales de terceros— también puede ser visible para otros usuarios de los Servicios y para usuarios de dichas plataformas de terceros, sin que existan limitaciones respecto a su uso por parte nuestra o de terceros. La inclusión de dichos enlaces no implica por sí sola ningún respaldo del contenido de esas plataformas ni de sus propietarios o responsables, salvo que se indique expresamente en los propios Servicios.'
      ),
    ],
    menores: [
      p(
        'Los Servicios no están destinados a ser utilizados por menores, y no recopilamos conscientemente información personal de menores de edad según la legislación aplicable en su jurisdicción. Si usted es padre, madre o tutor legal de un menor que nos haya facilitado su información personal, puede ponerse en contacto con nosotros a través de los datos que se indican más abajo para solicitar su eliminación. A fecha de entrada en vigor de esta Política de privacidad, no tenemos conocimiento efectivo de que "compartamos" o "vendamos" (según la definición de estos términos en la legislación aplicable) información personal de personas menores de 16 años.'
      ),
    ],
    'seguridad-retencion': [
      p(
        'Tenga en cuenta que ninguna medida de seguridad es perfecta o infalible, y no podemos garantizar una "seguridad absoluta". Además, cualquier información que nos envíe puede no estar protegida durante la transmisión. Le recomendamos que no utilice canales no seguros para enviarnos información sensible o confidencial.'
      ),
      p(
        'El tiempo durante el cual conservamos su información personal depende de varios factores, como la necesidad de mantener su cuenta, prestarle los Servicios, cumplir con obligaciones legales, resolver conflictos o hacer cumplir otros contratos y políticas aplicables.'
      ),
    ],
    derechos: [
      p(
        'Según el lugar en el que resida, es posible que tenga algunos o todos los derechos que se enumeran a continuación en relación con su información personal. No obstante, estos derechos no son absolutos, pueden aplicarse solo en determinadas circunstancias y, en algunos casos, podemos rechazar su solicitud cuando así lo permita la legislación.'
      ),
      dl(
        {
          term: 'Derecho de acceso',
          description: 'Puede tener derecho a solicitar el acceso a la información personal que conservamos sobre usted.',
        },
        {
          term: 'Derecho de supresión',
          description:
            'Puede tener derecho a solicitarnos la supresión de la información personal que conservamos sobre usted.',
        },
        {
          term: 'Derecho de rectificación',
          description:
            'Puede tener derecho a solicitar que rectifiquemos la información personal inexacta que conservamos sobre usted.',
        },
        {
          term: 'Derecho a la portabilidad de los datos',
          description:
            'Puede tener derecho a recibir una copia de la información personal que conservamos sobre usted y a solicitar que la transfiramos a un tercero, en determinadas circunstancias y con ciertas excepciones.',
        },
        {
          term: 'Gestión de preferencias de comunicación',
          description:
            'Podemos enviarle correos electrónicos promocionales, y usted puede optar por no recibirlos en cualquier momento utilizando la opción de cancelación de suscripción que aparece en nuestros correos electrónicos. Si opta por no recibirlos, es posible que sigamos enviándole correos electrónicos no promocionales, como aquellos relacionados con su cuenta o con los pedidos que haya realizado.',
        }
      ),
      p(
        'Si reside en el Reino Unido o en el Espacio Económico Europeo (EEA), y con sujeción a las excepciones y limitaciones previstas en la legislación local, podrá ejercer los siguientes derechos además de los mencionados anteriormente:'
      ),
      dl(
        {
          term: 'Oposición al tratamiento y limitación del tratamiento',
          description:
            'Puede tener derecho a solicitarnos que interrumpamos o limitemos el tratamiento de su información personal para determinados fines.',
        },
        {
          term: 'Retirada del consentimiento',
          description:
            'Cuando el tratamiento de su información personal se base en su consentimiento, usted tiene derecho a retirar dicho consentimiento. Si retira su consentimiento, ello no afectará a la licitud del tratamiento realizado con base en su consentimiento antes de su retirada.',
        }
      ),
      p(
        'Podrá ejercer cualquiera de estos derechos en los lugares indicados en los Servicios o poniéndose en contacto con nosotros a través de los detalles de contacto que se proporcionan más abajo. Para obtener más información sobre cómo Shopify utiliza su información personal y sobre los derechos que pueda tener —incluidos los relacionados con los datos tratados por Shopify—, puede visitar ',
        ext(SHOPIFY_PRIVACY_PORTAL, SHOPIFY_PRIVACY_PORTAL),
        '.'
      ),
      p(
        'No le discriminaremos por ejercer ninguno de estos derechos. Es posible que necesitemos verificar su identidad antes de poder tramitar sus solicitudes, según lo permita o exija la legislación aplicable. De conformidad con la legislación aplicable, usted puede designar a un representante autorizado para que presente solicitudes en su nombre con el fin de ejercer sus derechos. Antes de aceptar una solicitud presentada por un representante, exigiremos que este proporcione una prueba de que le ha autorizado a actuar en su nombre, y es posible que necesitemos que usted verifique su identidad directamente con nosotros. Responderemos a su solicitud en un plazo razonable, según lo establecido por la legislación aplicable.'
      ),
    ],
    reclamaciones: [
      p(
        'Si tiene alguna reclamación sobre cómo tratamos su información personal, le rogamos que se ponga en contacto con nosotros a través de los detalles de contacto que se indican más abajo. Según el lugar en el que resida, es posible que tenga derecho a recurrir nuestra decisión poniéndose en contacto con nosotros a través de los detalles de contacto que se indican más abajo, o a presentar una reclamación ante la autoridad local de protección de datos. Para el EEA, puedes encontrar una lista con las autoridades encargadas de la protección de datos ',
        ext(EDPB_MEMBERS, 'aquí'),
        '.'
      ),
    ],
    transferencias: [
      p(
        'Tenga en cuenta que podemos transferir, almacenar y tratar su información personal fuera del país en el que reside.'
      ),
      p(
        'Si transferimos su información personal fuera del Espacio Económico Europeo (EEA) o del Reino Unido, utilizaremos mecanismos de transferencia reconocidos, como las cláusulas contractuales estándar (SCC) de la Comisión Europea o cualquier contrato equivalente emitido por la autoridad competente del Reino Unido, según corresponda, salvo que la transferencia se realice a un país que haya sido reconocido como garante de un nivel adecuado de protección.'
      ),
    ],
    cambios: [
      p(
        'Podemos actualizar esta Política de privacidad ocasionalmente, incluso para reflejar cambios en nuestras prácticas o por motivos operativos, legales o normativos. Publicaremos la versión actualizada de esta Política de privacidad en este sitio web, actualizaremos la fecha de "Última actualización" y notificaremos los cambios conforme a lo exigido por la legislación aplicable.'
      ),
    ],
    contacto: [
      p(
        'Si tiene alguna pregunta sobre nuestras prácticas de privacidad o sobre esta Política de privacidad, o si desea ejercer cualquiera de los derechos que le corresponden, llámenos al ',
        tel(LEGAL_CONTACT_PHONE),
        ', envíenos un correo electrónico a ',
        mail(LEGAL_CONTACT_EMAIL),
        `. El responsable del tratamiento es ${LEGAL_NAME}, con domicilio social en ${LEGAL_REGISTERED_ADDRESS_SINGLE_LINE}.`
      ),
    ],
  },
};

export const enviosBody: LegalDocumentBody = {
  intro: [
    p(
      'La presente Política de envíos regula las condiciones aplicables a la preparación, expedición y entrega de los pedidos realizados a través de la tienda online Kingbelt.'
    ),
  ],
  sections: {
    vendedor: [
      p('Los productos comercializados a través de Kingbelt son vendidos por:'),
      address(
        LEGAL_NAME,
        'Nombre comercial: Kingbelt',
        `NIF: ${LEGAL_TAX_ID}`,
        `Domicilio social: ${LEGAL_REGISTERED_ADDRESS_SINGLE_LINE}`,
        `Correo electrónico: ${LEGAL_CONTACT_EMAIL}`,
        `Teléfono: ${LEGAL_CONTACT_PHONE}`
      ),
    ],
    zonas: [
      p(
        'Kingbelt realiza envíos a los destinos que se encuentren habilitados para entrega durante el proceso de compra.'
      ),
      p(
        'La disponibilidad del envío podrá depender, entre otros factores, del país, territorio, código postal o dirección de destino.'
      ),
      p(
        'Antes de finalizar el pedido, el cliente podrá comprobar si la dirección indicada se encuentra dentro de una zona de entrega disponible y conocer las modalidades de envío que puedan aplicarse.'
      ),
      p(
        'Si no fuera posible realizar la entrega en una determinada dirección, el cliente será informado antes de completar la compra siempre que dicha limitación pueda determinarse en ese momento.'
      ),
      p(
        'Kingbelt podrá modificar las zonas a las que realiza envíos para futuros pedidos, sin que ello afecte a pedidos ya formalizados.'
      ),
    ],
    gastos: [
      p(
        'Kingbelt ofrece envíos gratuitos a los destinos habilitados durante el proceso de compra.'
      ),
      p(
        'El coste del transporte está incluido en el precio de los productos mostrado en la tienda. No se añaden gastos de envío aparte en la modalidad ordinaria de compra.'
      ),
      p(
        'Durante el proceso de compra, y antes de confirmar el pedido con obligación de pago, el cliente podrá comprobar que el envío ordinario es gratuito en las zonas cubiertas por esta política.'
      ),
      p(
        'No se añadirán posteriormente gastos ordinarios de transporte que no hayan sido comunicados al cliente antes de contratar.'
      ),
    ],
    preparacion: [
      p('Una vez confirmado el pedido y, cuando corresponda, autorizado el pago, Kingbelt procederá a su preparación.'),
      p('El plazo de preparación es distinto del plazo de transporte.'),
      p(
        'Cuando se indiquen por separado ambos periodos, el plazo estimado de entrega deberá entenderse teniendo en cuenta tanto el tiempo necesario para preparar el pedido como el tiempo de transporte correspondiente.'
      ),
      p(
        'Los pedidos realizados durante fines de semana, festivos u otros días no laborables podrán comenzar a procesarse el siguiente día laborable.'
      ),
      p(
        'En caso de producirse una circunstancia excepcional que impida preparar el pedido dentro del plazo previsto, Kingbelt informará al cliente cuando dicha incidencia pueda afectar de forma relevante a la entrega.'
      ),
    ],
    plazos: [
      p(
        'El plazo o fecha estimada de entrega aplicable al pedido se comunicará al cliente durante el proceso de compra, en la confirmación del pedido o mediante la información de envío correspondiente.'
      ),
      p('Los plazos indicados deberán interpretarse de acuerdo con la modalidad de envío seleccionada y el destino.'),
      p(
        'Salvo que se haya acordado expresamente un plazo diferente, Kingbelt entregará los bienes sin demora indebida y, en cualquier caso, dentro del plazo máximo establecido por la legislación aplicable.'
      ),
      p(
        'Actualmente, la normativa española establece, con carácter general y salvo acuerdo distinto entre las partes, un plazo máximo de 30 días naturales desde la celebración del contrato.'
      ),
    ],
    computo: [
      p(
        'Cuando el plazo de entrega se exprese en días laborables, no se computarán normalmente sábados, domingos ni festivos que afecten al proceso de preparación o transporte.'
      ),
      p(
        'Los plazos podrán verse afectados en periodos de elevada demanda, campañas promocionales, festivos, situaciones meteorológicas extraordinarias, incidencias logísticas u otras circunstancias fuera del funcionamiento ordinario.'
      ),
      p(
        'La existencia de una incidencia externa no elimina los derechos que legalmente correspondan al consumidor en caso de incumplimiento del plazo de entrega acordado.'
      ),
    ],
    seguimiento: [
      p(
        'Cuando la modalidad de transporte utilizada permita seguimiento, el cliente podrá recibir información para consultar el estado del envío.'
      ),
      p(
        'El seguimiento proporcionado por el transportista tiene carácter informativo y puede presentar retrasos en su actualización.'
      ),
      p(
        'Si existe una incidencia relevante o el pedido no ha sido recibido dentro del plazo comunicado, el cliente puede contactar con Kingbelt a través de: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
      p('Recomendamos indicar el número de pedido para facilitar la localización del envío.'),
    ],
    direccion: [
      p(
        'El cliente es responsable de facilitar una dirección de entrega completa, correcta y suficientemente precisa para permitir la entrega del pedido.'
      ),
      p('Antes de confirmar la compra, deberá revisar especialmente:'),
      ul(
        'nombre y apellidos del destinatario;',
        'calle y número;',
        'piso, puerta u otros datos necesarios;',
        'código postal;',
        'localidad;',
        'provincia o región;',
        'país;',
        'y datos de contacto requeridos para la entrega.'
      ),
      p(
        'Si el cliente detecta un error en la dirección después de realizar el pedido, deberá ponerse en contacto con Kingbelt lo antes posible.'
      ),
      p(
        'Kingbelt intentará modificar la información cuando el estado de preparación o transporte todavía lo permita, pero no puede garantizar que una dirección pueda ser modificada después de que el pedido haya sido expedido.'
      ),
    ],
    entrega: [
      p('El pedido será entregado en la dirección indicada por el cliente durante el proceso de compra.'),
      p(
        'La entrega podrá realizarse al comprador o a una tercera persona indicada por este y autorizada para recibir el pedido.'
      ),
      p(
        'Cuando el servicio de transporte lo permita, podrán existir opciones adicionales de entrega, como puntos de recogida, oficinas, establecimientos asociados o modalidades similares.'
      ),
      p('La disponibilidad y condiciones de estas opciones dependerán de la modalidad de transporte contratada.'),
    ],
    ausencia: [
      p(
        'Si el transportista intenta realizar la entrega y no encuentra al destinatario, podrá efectuar un nuevo intento, depositar el envío en un punto autorizado o facilitar instrucciones para concertar o gestionar una nueva entrega, dependiendo del servicio contratado.'
      ),
      p(
        'El cliente deberá seguir las instrucciones facilitadas por el transportista cuando sean razonables y compatibles con la modalidad de envío elegida.'
      ),
      p(
        'Si el pedido termina siendo devuelto a Kingbelt por causas directamente imputables al cliente, como una dirección incorrecta facilitada por este, la imposibilidad reiterada de entrega o la falta de recogida dentro del plazo comunicado por el transportista, Kingbelt se pondrá en contacto con el cliente para determinar cómo proceder.'
      ),
      p(
        'Cuando legalmente corresponda, podrán repercutirse únicamente los costes adicionales reales y razonables derivados directamente de una nueva expedición solicitada por el cliente.'
      ),
    ],
    retrasos: [
      p(
        'Si Kingbelt no pudiera entregar el pedido dentro del plazo acordado, el cliente conservará todos los derechos reconocidos por la legislación aplicable.'
      ),
      p(
        'Cuando proceda, el consumidor podrá requerir a Kingbelt para que efectúe la entrega dentro de un plazo adicional adecuado a las circunstancias.'
      ),
      p(
        'Si Kingbelt tampoco realiza la entrega dentro de dicho plazo adicional, el consumidor podrá tener derecho a resolver el contrato y obtener el reembolso de las cantidades abonadas.'
      ),
      p(
        'No será necesario conceder un plazo adicional cuando legalmente no sea exigible, por ejemplo, cuando Kingbelt haya rechazado la entrega o cuando el plazo pactado sea esencial atendiendo a las circunstancias o a la información comunicada antes de la compra.'
      ),
    ],
    perdido: [
      p(
        'Cuando Kingbelt haya organizado el transporte y exista constancia razonable de que un pedido se ha perdido antes de ser entregado al cliente, Kingbelt gestionará la incidencia con la empresa de transporte.'
      ),
      p(
        'El cliente no deberá asumir las consecuencias económicas de la pérdida de un pedido mientras el riesgo corresponda legalmente a Kingbelt.'
      ),
      p(
        'Dependiendo de las circunstancias, disponibilidad del producto y derechos del cliente, Kingbelt podrá gestionar un nuevo envío o el correspondiente reembolso.'
      ),
    ],
    danado: [
      p(
        'Recomendamos comprobar el estado exterior del paquete en el momento de la entrega y revisar los productos lo antes posible después de recibirlos.'
      ),
      p(
        'Si el pedido llega dañado, el producto presenta daños atribuibles al transporte o existe cualquier otra incidencia, el cliente deberá contactar con: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
      p('Para agilizar la investigación recomendamos aportar:'),
      ul(
        'número de pedido;',
        'descripción de la incidencia;',
        'fotografías del embalaje exterior;',
        'fotografías de los daños;',
        'y fotografías de la etiqueta de transporte, cuando resulte posible.'
      ),
      p(
        'La aportación de fotografías facilita la tramitación de la incidencia, pero no limita los derechos que legalmente correspondan al consumidor.'
      ),
    ],
    incorrecto: [
      p(
        'Si el cliente recibe un producto diferente al solicitado, falta algún producto incluido en el pedido o existe cualquier otro error imputable a Kingbelt, deberá ponerse en contacto con nosotros.'
      ),
      p(
        'Kingbelt comprobará la incidencia y adoptará las medidas necesarias para cumplir correctamente el contrato sin que el cliente tenga que asumir los costes derivados de un error imputable a Kingbelt.'
      ),
    ],
    riesgo: [
      p(
        'Cuando Kingbelt envíe los productos mediante una empresa de transporte propuesta, seleccionada o contratada por nosotros, el riesgo de pérdida o deterioro permanecerá a cargo de Kingbelt hasta que el cliente, o un tercero indicado por este distinto del transportista, adquiera la posesión material del pedido.'
      ),
      p(
        'Por tanto, la entrega del paquete por parte de Kingbelt a la empresa de transporte no supone por sí sola la transmisión del riesgo al consumidor.'
      ),
      p(
        'Si es el propio consumidor quien contrata por su cuenta a un transportista que no haya sido propuesto por Kingbelt, se aplicará el régimen de transmisión del riesgo previsto legalmente para ese supuesto.'
      ),
    ],
    divididos: [
      p(
        'En determinados casos, un pedido podrá ser enviado en más de un paquete cuando resulte necesario por razones logísticas o de disponibilidad.'
      ),
      p('Cuando esto ocurra, el cliente podrá recibir los productos en fechas distintas.'),
      p(
        'La división de un pedido realizada por decisión de Kingbelt no supondrá la aplicación de gastos de envío adicionales al cliente que no hubieran sido aceptados previamente.'
      ),
    ],
    aduanas: [
      p(
        'Determinados destinos internacionales o territorios con un régimen fiscal o aduanero específico pueden estar sujetos a procedimientos de importación, impuestos, aranceles, gastos aduaneros u otros conceptos establecidos por las autoridades correspondientes.'
      ),
      p(
        'Cuando estos costes sean conocidos y deban ser soportados por el cliente, Kingbelt facilitará la información exigida legalmente antes de la compra.'
      ),
      p(
        'Cuando no sea razonablemente posible calcular determinados costes de antemano por depender de autoridades o circunstancias externas, se informará de la posible existencia de dichos gastos cuando resulte aplicable.'
      ),
      p(
        'La disponibilidad de envíos a estos territorios dependerá de las zonas de entrega habilitadas por Kingbelt.'
      ),
    ],
    modificaciones: [
      p(
        'Si deseas modificar o cancelar un pedido después de realizarlo, ponte en contacto con nosotros lo antes posible en: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
      p(
        'Intentaremos atender la solicitud si el pedido todavía no ha empezado a prepararse o expedirse de un modo que impida razonablemente la modificación.'
      ),
      p(
        'La imposibilidad de cancelar un envío que ya se encuentre en tránsito no afecta al derecho de desistimiento que corresponda al consumidor después de recibirlo.'
      ),
      p(
        'Para conocer las condiciones del derecho de desistimiento y de las devoluciones, consulta nuestra ',
        page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
        '.'
      ),
    ],
    devoluciones: [
      p(
        'Los envíos de devolución se regulan específicamente en nuestra ',
        page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
        '.'
      ),
      p('Las condiciones y costes de una devolución dependerán de su causa.'),
      p(
        'Cuando se trate de una devolución voluntaria o del ejercicio del derecho de desistimiento, se aplicarán las condiciones comunicadas al cliente conforme a dicha política y a la legislación vigente.'
      ),
      p(
        'Cuando el producto sea defectuoso, incorrecto, se encuentre dañado o exista una falta de conformidad imputable a Kingbelt, los costes necesarios para solucionar la incidencia serán asumidos por Kingbelt cuando legalmente corresponda.'
      ),
    ],
    'fuerza-mayor': [
      p(
        'Pueden producirse circunstancias extraordinarias fuera del control razonable de Kingbelt que afecten temporalmente al transporte, como fenómenos meteorológicos graves, interrupciones de infraestructuras, conflictos laborales externos, restricciones de las autoridades u otros acontecimientos extraordinarios.'
      ),
      p(
        'Cuando una de estas situaciones afecte de forma significativa a un pedido, Kingbelt adoptará medidas razonables para minimizar sus efectos e informar al cliente cuando sea necesario.'
      ),
      p(
        'Estas circunstancias no limitarán los derechos imperativos que correspondan al consumidor conforme a la legislación aplicable.'
      ),
    ],
    relacion: [
      p(
        'Esta Política de envíos forma parte de la información contractual proporcionada por Kingbelt y debe interpretarse conjuntamente con:'
      ),
      ul(
        [page('/condiciones', 'las Condiciones Generales de Contratación y Uso'), ';'],
        [page('/devoluciones', 'la Política de devoluciones, desistimiento y reembolsos'), ';'],
        [page('/privacidad', 'la Política de privacidad'), ';'],
        'y las demás condiciones aplicables al pedido.'
      ),
      p(
        'En caso de contradicción con una norma imperativa de protección de consumidores y usuarios, prevalecerá la normativa legal aplicable.'
      ),
    ],
    contacto: [
      p('Para cualquier consulta relacionada con el envío o entrega de un pedido:'),
      address(
        `${LEGAL_NAME} – Kingbelt`,
        `NIF: ${LEGAL_TAX_ID}`,
        ...LEGAL_REGISTERED_ADDRESS.split('\n')
      ),
      p('Correo electrónico: ', mail(LEGAL_CONTACT_EMAIL)),
      p('Teléfono: ', tel(LEGAL_CONTACT_PHONE)),
    ],
  },
};

export const devolucionesBody: LegalDocumentBody = {
  intro: [
    p(
      'La presente Política de devoluciones, desistimiento y reembolsos regula las compras realizadas a través de la tienda online de Kingbelt, nombre comercial de CintuElx S.L.'
    ),
    p('Datos del vendedor:'),
    address(
      LEGAL_NAME,
      'Nombre comercial: Kingbelt',
      `NIF: ${LEGAL_TAX_ID}`,
      `Domicilio social: ${LEGAL_REGISTERED_ADDRESS_SINGLE_LINE}`,
      `Correo electrónico: ${LEGAL_CONTACT_EMAIL}`,
      `Teléfono: ${LEGAL_CONTACT_PHONE}`
    ),
  ],
  sections: {
    plazo: [
      p(
        'Kingbelt ofrece a sus clientes un plazo de 30 días naturales desde la recepción del pedido para solicitar la devolución de los productos adquiridos a través de nuestra tienda online.'
      ),
      p(
        'Esta política amplía voluntariamente el plazo mínimo legal de desistimiento de 14 días naturales establecido para las compras a distancia realizadas por consumidores y usuarios.'
      ),
      p(
        'Dentro de los primeros 14 días naturales desde la recepción del pedido, el consumidor podrá ejercer su derecho legal de desistimiento sin necesidad de indicar el motivo de la devolución.'
      ),
      p(
        'Kingbelt amplía voluntariamente este periodo hasta un total de 30 días naturales, aplicando las condiciones establecidas en esta política.'
      ),
      p(
        'Cuando un mismo pedido contenga varios productos entregados por separado, el plazo comenzará a contar desde el día en que el cliente, o un tercero indicado por este distinto del transportista, reciba el último de los productos.'
      ),
    ],
    estado: [
      p(
        'El cliente podrá examinar y manipular el producto únicamente en la medida necesaria para comprobar su naturaleza, características, talla, apariencia y funcionamiento, de manera similar a como podría hacerlo en un establecimiento físico.'
      ),
      p(
        'Recomendamos devolver el producto con sus etiquetas, accesorios y embalaje original siempre que sea posible, ya que ello facilita la correcta gestión de la devolución.'
      ),
      p(
        'La ausencia del embalaje original o de una etiqueta no supone automáticamente la pérdida del derecho legal de desistimiento.'
      ),
      p(
        'No obstante, el cliente podrá ser responsable de la disminución de valor del producto cuando esta se deba a una manipulación superior a la necesaria para comprobar su naturaleza, características o funcionamiento.'
      ),
      p(
        'Los productos que presenten signos evidentes de uso más allá de una mera prueba, daños imputables al cliente, manchas, modificaciones, alteraciones o un deterioro que exceda de lo razonablemente necesario para comprobar el producto podrán sufrir una reducción del importe reembolsado proporcional a la pérdida de valor ocasionada, cuando legalmente corresponda.'
      ),
    ],
    solicitar: [
      p('Para gestionar una devolución, puedes comunicarte con Kingbelt a través de:'),
      p(mail(LEGAL_CONTACT_EMAIL)),
      p('Te recomendamos indicar:'),
      ul(
        'número de pedido;',
        'nombre de la persona que realizó la compra;',
        'producto o productos que deseas devolver;',
        'y, cuando proceda, el motivo de la devolución, especialmente en caso de producto defectuoso, dañado o incorrecto.'
      ),
      p('No es obligatorio justificar el motivo cuando se ejerza el derecho legal de desistimiento.'),
      p(
        'Una vez recibida la solicitud, te facilitaremos las instrucciones y la dirección logística necesarias para efectuar la devolución. No envíes el producto al domicilio social salvo que esas instrucciones lo indiquen expresamente.'
      ),
      p(
        'La comunicación previa facilita la identificación y correcta tramitación de la devolución. No obstante, esta política no limita las demás formas legalmente válidas de comunicar el ejercicio del derecho de desistimiento mediante una declaración inequívoca.'
      ),
      p(
        'Una vez comunicado el desistimiento o devolución, los productos deberán enviarse sin demora indebida y, en los casos sometidos al derecho legal de desistimiento, como máximo dentro de los 14 días naturales siguientes a dicha comunicación.'
      ),
      p('Recomendamos conservar el justificante de envío hasta que la devolución haya sido recibida y procesada.'),
    ],
    gastos: [
      p(
        'Cuando la devolución se deba únicamente a un cambio de opinión, talla, color o cualquier otra circunstancia no imputable a Kingbelt, los costes directos de devolución serán asumidos por el cliente.'
      ),
      p(
        'Si Kingbelt pone a disposición del cliente una etiqueta de transporte prepagada para realizar este tipo de devolución, se informará previamente del coste de dicha etiqueta. Dicho importe podrá descontarse del reembolso correspondiente.'
      ),
      p(
        'El cliente también podrá realizar el envío de devolución por sus propios medios siguiendo las instrucciones facilitadas por Kingbelt.'
      ),
      p(
        'Cuando la devolución se deba a un producto defectuoso, dañado, incorrecto o a un error imputable a Kingbelt, los gastos necesarios para solucionar la incidencia serán asumidos por Kingbelt conforme a la legislación aplicable.'
      ),
    ],
    danados: [
      p('Revisa el pedido tan pronto como lo recibas.'),
      p(
        'Si el producto recibido presenta daños, defectos, una falta de conformidad o no se corresponde con el producto solicitado, ponte en contacto con nosotros en ',
        mail(LEGAL_CONTACT_EMAIL),
        ' para que podamos evaluar y solucionar la incidencia.'
      ),
      p(
        'Cuando sea posible, adjuntar fotografías del producto y del embalaje puede facilitar y acelerar la gestión, pero ello no limitará los derechos legalmente reconocidos al consumidor.'
      ),
      p(
        'Las incidencias relacionadas con productos defectuosos, incorrectos o no conformes no se consideran simples devoluciones por cambio de opinión y se encuentran sujetas a los derechos y garantías establecidos en la normativa de protección de consumidores y usuarios.'
      ),
      p(
        'Esta política de devoluciones no limita ni sustituye los derechos legales derivados de la garantía legal de conformidad.'
      ),
    ],
    excepciones: [
      p(
        'El derecho de desistimiento no resultará aplicable cuando concurra alguna de las excepciones previstas legalmente.'
      ),
      p(
        'En particular, no podrán devolverse mediante el derecho de desistimiento los productos que hayan sido confeccionados conforme a las especificaciones del cliente o claramente personalizados, cuando dicha personalización haga aplicable la excepción prevista legalmente.'
      ),
      p(
        'La mera elección entre las opciones estándar ofrecidas por Kingbelt —por ejemplo, seleccionar una talla o un color disponible en el catálogo— no convierte por sí sola el producto en un artículo personalizado.'
      ),
      p(
        'Si en el futuro se comercializan productos personalizados, Kingbelt informará claramente al cliente, antes de realizar la compra, cuando dichos productos se encuentren excluidos del derecho de desistimiento.'
      ),
    ],
    rebajados: [
      p(
        'Los productos adquiridos con descuento, en rebajas o mediante códigos promocionales podrán devolverse en las mismas condiciones establecidas en esta política.'
      ),
      p(
        'El hecho de que un producto se encuentre rebajado o en promoción no elimina por sí mismo los derechos legales del consumidor.'
      ),
      p(
        'El reembolso se realizará tomando como referencia el importe efectivamente abonado por el cliente por el producto devuelto.'
      ),
    ],
    cambios: [
      p(
        'Actualmente, la forma recomendada de realizar un cambio de talla, color o modelo es tramitar la devolución del producto recibido y realizar posteriormente un nuevo pedido del producto deseado.'
      ),
      p(
        'De esta forma no se bloquea stock y el nuevo producto puede adquirirse inmediatamente si continúa disponible.'
      ),
      p(
        'Esta operativa para cambios voluntarios no afecta a los derechos que correspondan al consumidor cuando el producto sea defectuoso, incorrecto o presente una falta de conformidad.'
      ),
    ],
    reembolsos: [
      p(
        'Una vez recibida la devolución, Kingbelt comprobará el estado del producto y tramitará el reembolso correspondiente.'
      ),
      p(
        'Cuando se ejerza el derecho de desistimiento, Kingbelt reembolsará las cantidades que legalmente correspondan sin demora indebida y, en cualquier caso, dentro de los 14 días naturales siguientes a la fecha en que haya sido informado de la decisión de desistir.'
      ),
      p(
        'No obstante, Kingbelt podrá retener el reembolso hasta haber recibido los productos devueltos o hasta que el cliente presente una prueba de haberlos enviado, lo que ocurra primero.'
      ),
      p(
        'El reembolso se realizará utilizando el mismo medio de pago utilizado para la compra, salvo que el cliente acuerde expresamente otro medio y siempre que ello no le genere gastos adicionales.'
      ),
      p(
        'Como el envío ordinario está incluido en el precio del producto y no se cobra aparte, el reembolso del desistimiento comprende el precio pagado por los productos. No existe un cargo de envío separado que reembolsar.'
      ),
      p(
        'Una vez emitido el reembolso por Kingbelt, el tiempo necesario para que el importe aparezca en la cuenta del cliente dependerá de la entidad bancaria o del proveedor del método de pago utilizado.'
      ),
      p(
        'Si consideras que existe cualquier incidencia con un reembolso, puedes contactar con nosotros en ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
    ],
    modelo: [
      p(
        'El uso de este modelo no es obligatorio. El consumidor podrá comunicar su decisión de desistir mediante cualquier declaración inequívoca que permita acreditar dicha decisión.'
      ),
      p('La declaración de desistimiento puede dirigirse a:'),
      address(
        LEGAL_NAME,
        ...LEGAL_REGISTERED_ADDRESS.split('\n'),
        `Correo electrónico: ${LEGAL_CONTACT_EMAIL}`
      ),
      template(
        'Por medio de la presente comunico mi decisión de desistir del contrato correspondiente a los siguientes productos:',
        'Producto/s:',
        'Número de pedido:',
        'Fecha del pedido:',
        'Fecha de recepción:',
        'Nombre y apellidos del consumidor:',
        'Dirección del consumidor:',
        'Fecha:',
        'Firma del consumidor únicamente cuando el formulario se presente en papel.'
      ),
    ],
    derechos: [
      p(
        'Nada de lo dispuesto en esta política limitará los derechos que correspondan a los consumidores y usuarios conforme a la legislación española y europea que resulte de aplicación.'
      ),
      p(
        'En caso de contradicción entre esta política y una norma imperativa de protección de consumidores y usuarios, prevalecerá la normativa legal aplicable.'
      ),
    ],
    contacto: [
      p(
        'Para cualquier consulta relacionada con devoluciones, desistimientos, incidencias o reembolsos puedes contactar con:'
      ),
      address(`${LEGAL_NAME} – Kingbelt`),
      p('Correo electrónico: ', mail(LEGAL_CONTACT_EMAIL)),
      p('Teléfono: ', tel(LEGAL_CONTACT_PHONE)),
    ],
  },
};

export const contactLegalBody: LegalDocumentBody = {
  intro: [
    p(
      'Si necesitas ayuda con un pedido, un producto, una devolución o cualquier otra cuestión relacionada con Kingbelt, puedes ponerte en contacto con nosotros a través de los siguientes medios.'
    ),
  ],
  sections: {
    datos: [
      address(
        LEGAL_NAME,
        'Nombre comercial: Kingbelt',
        `NIF: ${LEGAL_TAX_ID}`,
        `Domicilio social: ${LEGAL_REGISTERED_ADDRESS_SINGLE_LINE}`,
        `Correo electrónico: ${LEGAL_CONTACT_EMAIL}`,
        `Teléfono: ${LEGAL_CONTACT_PHONE}`
      ),
    ],
    pedidos: [
      p(
        'Para cualquier consulta relacionada con un pedido, recomendamos contactar por correo electrónico en: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
      p('Para poder localizar y gestionar la solicitud con mayor rapidez, indica siempre que sea posible:'),
      ul(
        'número de pedido;',
        'nombre y apellidos de la persona que realizó la compra;',
        'y una breve descripción de la consulta o incidencia.'
      ),
    ],
    devoluciones: [
      p(
        'Para solicitar una devolución, comunicar una incidencia con un producto o realizar una consulta sobre un reembolso, puedes escribir a: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
      p(
        'Las devoluciones están sujetas a las condiciones establecidas en nuestra ',
        page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
        '.'
      ),
      p(
        'No recomendamos enviar productos por tu cuenta antes de consultar las instrucciones de devolución correspondientes, ya que esto facilita la correcta identificación y gestión del envío.'
      ),
    ],
    defectuosos: [
      p(
        'Si has recibido un producto dañado, incorrecto o que presenta algún defecto, ponte en contacto con nosotros a través de: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
      p(
        'Indica el número de pedido y describe la incidencia. Cuando sea posible, puedes adjuntar fotografías del producto y del embalaje para facilitar la gestión.'
      ),
      p(
        'La aportación de fotografías puede agilizar la tramitación, pero no limita los derechos que legalmente correspondan al consumidor.'
      ),
    ],
    'proteccion-datos': [
      p(
        'Si deseas realizar una consulta relacionada con el tratamiento de tus datos personales o ejercer los derechos que te correspondan conforme a la normativa de protección de datos, puedes dirigirte a: ',
        mail(LEGAL_CONTACT_EMAIL),
        '.'
      ),
      p(
        'La información completa sobre el tratamiento de datos personales se encuentra disponible en nuestra ',
        page('/privacidad', 'Política de privacidad'),
        '.'
      ),
    ],
    empresarial: [
      p(
        'La tienda online Kingbelt es gestionada por CintuElx S.L., con NIF B42696716.'
      ),
      p('Las compras realizadas a través de Kingbelt se formalizan con CintuElx S.L. como vendedor de los productos.'),
      p(
        'Para consultar información jurídica adicional sobre el titular del sitio web, contratación, derechos de los consumidores y condiciones de compra, puedes consultar nuestro ',
        page('/aviso-legal', 'Aviso Legal'),
        ' y nuestras ',
        page('/condiciones', 'Condiciones Generales de Contratación y Uso'),
        '.'
      ),
    ],
  },
};

export const cookiesBody: LegalDocumentBody = {
  intro: [
    p(
      'Esta política describe las cookies y otras tecnologías de almacenamiento que el sitio de Kingbelt utiliza de forma demostrable en su código. No incluye cookies de analítica, publicidad ni marketing de primera parte.'
    ),
  ],
  sections: {
    'que-son': [
      p(
        'Las cookies son pequeños archivos de texto que un sitio web puede almacenar en tu navegador. El almacenamiento local (localStorage y sessionStorage) es una tecnología del navegador distinta de las cookies: no se envía automáticamente al servidor en cada petición.'
      ),
      p(
        'Kingbelt no utiliza cookies de analítica, publicidad ni marketing en este sitio. Esta política describe únicamente las tecnologías demostrables en el código.'
      ),
    ],
    'tecnologias-actuales': [
      p(
        'En el modo Shopify de producción, el carrito no usa localStorage: la persistencia va por la cookie de sesión opaca y el almacén del servidor. El almacenamiento kingbelt-cart-v4 aplica solo al modo de demostración.'
      ),
      table(
        ['Nombre', 'Tipo', 'Finalidad', 'Duración', 'Proveedor'],
        currentTechnologies.map((tech) => [
          tech.name,
          tech.type,
          tech.purpose,
          tech.duration,
          tech.provider,
        ]),
        'Tecnologías de almacenamiento utilizadas por Kingbelt'
      ),
    ],
    'recursos-externos': [
      p(
        'El sitio carga tipografías desde servicios externos. Estos recursos pueden generar peticiones a dominios de terceros.'
      ),
      ul(
        ...externalResources.map(
          (resource) =>
            `${resource.name} (${resource.domains.join(', ')}): ${resource.purpose} ${resource.cookieNote}` as LegalInline
        )
      ),
    ],
    gestion: [
      p('Puedes eliminar el almacenamiento local desde la configuración de tu navegador.'),
      p(
        'No existe un banner de consentimiento porque este sitio no utiliza cookies no esenciales de primera parte. El checkout y las cuentas de cliente se sirven en dominios de Shopify; sus cookies las establece Shopify y se rigen por su propia información.'
      ),
    ],
    actualizacion: [
      p(
        'Si se incorporan analítica, marketing u otros servicios de terceros, o cambian las tecnologías de primera parte, se actualizará esta política. Las cookies del checkout alojado en Shopify no se enumeran aquí porque no forman parte del código de este sitio.'
      ),
    ],
    contacto: [
      p('Para consultas sobre esta política, escríbenos a ', mail(LEGAL_CONTACT_EMAIL), '.'),
    ],
  },
};

export const condicionesBody: LegalDocumentBody = {
  intro: [
    p(
      'Las presentes Condiciones Generales de Contratación y Uso regulan la compraventa de productos a través de la tienda online de Kingbelt, nombre comercial de CintuElx S.L. Se interpretan juntamente con el ',
      page('/aviso-legal', 'Aviso Legal'),
      ', la ',
      page('/envios-y-devoluciones', 'Política de envíos'),
      ', la ',
      page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
      ', la ',
      page('/privacidad', 'Política de privacidad'),
      ' y la ',
      page('/cookies', 'Política de cookies'),
      '.'
    ),
    p(
      'En caso de contradicción con una norma imperativa de protección de consumidores y usuarios, prevalecerá la normativa legal aplicable.'
    ),
  ],
  sections: {
    identidad: [
      p('El vendedor es:'),
      address(
        LEGAL_NAME,
        'Nombre comercial: Kingbelt',
        `NIF: ${LEGAL_TAX_ID}`,
        `Domicilio social: ${LEGAL_REGISTERED_ADDRESS_SINGLE_LINE}`,
        `Correo electrónico: ${LEGAL_CONTACT_EMAIL}`,
        `Teléfono: ${LEGAL_CONTACT_PHONE}`
      ),
      p(
        'Las compras realizadas a través de Kingbelt se formalizan con CintuElx S.L. La intervención de proveedores tecnológicos, incluido Shopify, no modifica la identidad del vendedor.'
      ),
    ],
    objeto: [
      p(
        'Estas condiciones regulan la adquisición online de productos a través del sitio web de Kingbelt y los servicios relacionados con la compra.'
      ),
      p(
        'El acceso general al catálogo y a la información de la marca se rige además por el ',
        page('/aviso-legal', 'Aviso Legal'),
        '.'
      ),
    ],
    productos: [
      p(
        'Antes de finalizar una compra, el cliente podrá acceder a las características esenciales de los productos, precio, impuestos, gastos adicionales aplicables, modalidades de pago, condiciones de entrega y derechos que le correspondan.'
      ),
      p(
        'La información contractual relativa a una compra concreta será la que se comunique durante el proceso de contratación. En caso de discrepancia entre información puramente informativa del sitio y las condiciones aceptadas en una compra, se estará a lo establecido en el contrato y en la legislación aplicable.'
      ),
    ],
    'proceso-compra': [
      p(
        'El cliente selecciona el producto, revisa el carrito en este sitio y completa el pedido y el pago en el checkout de Shopify.'
      ),
      p(
        'Antes de confirmar el pago, el cliente puede comprobar la información contractual exigible, incluida la dirección de entrega y el importe total.'
      ),
    ],
    'correccion-errores': [
      p(
        'Antes de confirmar el pedido, el cliente puede modificar las líneas del carrito y los datos que el checkout solicite.'
      ),
      p(
        'Si detecta un error después de confirmar, puede contactar con ',
        mail(LEGAL_CONTACT_EMAIL),
        '. Intentaremos atender la solicitud si el pedido todavía no ha empezado a prepararse o expedirse de un modo que impida razonablemente la modificación.'
      ),
    ],
    idioma: [
      p('El contrato se formalizará en español, que será el idioma de referencia.'),
    ],
    'archivo-contrato': [
      p(
        'La confirmación del pedido y el registro de la transacción quedan archivados en el entorno de comercio electrónico. El cliente recibe confirmación al completar la compra.'
      ),
    ],
    precios: [
      p(
        'Los precios se muestran en las fichas de producto y se confirman durante el proceso de compra, antes de asumir la obligación de pago.'
      ),
      p(
        'Los impuestos aplicables se comunican durante el proceso de compra. Determinados destinos pueden estar sujetos a aranceles u otros conceptos fijados por las autoridades, según se indica en la ',
        page('/envios-y-devoluciones', 'Política de envíos'),
        '.'
      ),
    ],
    disponibilidad: [
      p(
        'La disponibilidad de cada producto y de las zonas de entrega se comprueba durante el proceso de compra. Si no fuera posible realizar la entrega en una determinada dirección, el cliente será informado antes de completar la compra siempre que dicha limitación pueda determinarse en ese momento.'
      ),
    ],
    pagos: [
      p(
        'Las modalidades de pago disponibles se muestran durante el proceso de compra, antes de confirmar el pedido.'
      ),
      p(
        'El reembolso se realizará utilizando el mismo medio de pago utilizado para la compra, salvo que el cliente acuerde expresamente otro medio y siempre que ello no le genere gastos adicionales, conforme a la ',
        page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
        '.'
      ),
    ],
    confirmacion: [
      p(
        'Una vez autorizado el pago, el cliente recibe confirmación del pedido. El contrato se entiende celebrado cuando el pedido queda confirmado.'
      ),
    ],
    entrega: [
      p(
        'La preparación, los plazos, el seguimiento y las incidencias de entrega se regulan en la ',
        page('/envios-y-devoluciones', 'Política de envíos'),
        '.'
      ),
      p(
        'El plazo máximo de entrega es de 30 días naturales, salvo otro acuerdo. El plazo o fecha estimada concreta se comunica durante el proceso de compra.'
      ),
    ],
    envio: [
      p(
        'Los envíos son gratuitos: el coste del transporte está incluido en el precio del producto. Antes de confirmar el pedido, el cliente podrá comprobar que el envío ordinario se muestra como gratuito.'
      ),
      p(
        'El transporte lo realiza una empresa de transporte propuesta, seleccionada o contratada por Kingbelt. La modalidad concreta se comunica durante el proceso de compra. El detalle operativo está en la ',
        page('/envios-y-devoluciones', 'Política de envíos'),
        '.'
      ),
    ],
    desistimiento: [
      p(
        'El consumidor puede desistir en los términos de la ',
        page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
        ': 14 días naturales de desistimiento legal desde la recepción, ampliados voluntariamente por Kingbelt hasta 30 días naturales.'
      ),
      p(
        'La comunicación puede realizarse a ',
        mail(LEGAL_CONTACT_EMAIL),
        '. El modelo de formulario está publicado en esa política. No es obligatorio utilizar un formulario electrónico específico.'
      ),
    ],
    devoluciones: [
      p(
        'Las devoluciones, el estado del producto, los gastos y los reembolsos se regulan en la ',
        page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
        '.'
      ),
    ],
    excepciones: [
      p(
        'El derecho de desistimiento no resultará aplicable cuando concurra alguna de las excepciones previstas legalmente, en los términos descritos en la ',
        page('/devoluciones', 'Política de devoluciones, desistimiento y reembolsos'),
        '.'
      ),
    ],
    conformidad: [
      p(
        'Nada de lo dispuesto en estas condiciones limita ni sustituye los derechos legales derivados de la garantía legal de conformidad.'
      ),
    ],
    atencion: [
      p('Para atención al cliente relativa a pedidos, incidencias o estas condiciones:'),
      p('Correo electrónico: ', mail(LEGAL_CONTACT_EMAIL)),
      p('Teléfono: ', tel(LEGAL_CONTACT_PHONE)),
    ],
    'propiedad-intelectual': [
      p(
        'Los contenidos del sitio y de los productos están protegidos por la normativa de propiedad intelectual e industrial, en los términos del ',
        page('/aviso-legal', 'Aviso Legal'),
        '.'
      ),
    ],
    'fuerza-mayor': [
      p(
        'Pueden producirse circunstancias extraordinarias fuera del control razonable de Kingbelt que afecten temporalmente al cumplimiento, en los términos descritos en la ',
        page('/envios-y-devoluciones', 'Política de envíos'),
        '.'
      ),
      p(
        'Estas circunstancias no limitarán los derechos imperativos que correspondan al consumidor conforme a la legislación aplicable.'
      ),
    ],
    'ley-aplicable': [
      p('Estas condiciones se rigen por la legislación española.'),
    ],
    'resolucion-conflictos': [
      p(
        'Cuando el cliente tenga la consideración de consumidor o usuario, cualquier controversia se resolverá ante los juzgados y tribunales que resulten competentes conforme a la normativa aplicable, sin imponerle una jurisdicción distinta de la que legalmente le corresponda.'
      ),
    ],
  },
};

export const legalBodies = {
  avisoLegal: avisoLegalBody,
  privacidad: privacidadBody,
  cookies: cookiesBody,
  condiciones: condicionesBody,
  envios: enviosBody,
  devoluciones: devolucionesBody,
} as const satisfies Record<string, LegalDocumentBody>;
