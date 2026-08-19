export const accountAccessPage = {
  title: 'Acceder — KingBelt',
  description:
    'Vista de demostración del acceso a cuenta. En producción, login y registro ocurren en Shopify Customer Accounts.',
  intents: {
    login: {
      id: 'login',
      label: 'Iniciar sesión',
      heading: 'Iniciar sesión',
      lede: 'Panel visual de demostración. En Shopify, el acceso ocurre en Customer Accounts.',
      submit: 'Continuar',
    },
    register: {
      id: 'register',
      label: 'Crear cuenta',
      heading: 'Crear cuenta',
      lede: 'Misma vista de demostración. En Shopify, el alta usa el mismo flujo alojado.',
      submit: 'Continuar',
    },
  },
  note: 'Modo demo: este formulario no autentica, no envía correo y no crea sesión.',
  helpLabel: '¿Necesitas ayuda?',
  helpHref: '/contacto',
} as const;
