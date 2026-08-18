export const accountAccessPage = {
  title: 'Acceder — KingBelt',
  description:
    'Inicia sesión o crea tu cuenta con tu correo para consultar pedidos y agilizar tus compras.',
  intents: {
    login: {
      id: 'login',
      label: 'Iniciar sesión',
      heading: 'Iniciar sesión',
      lede: 'Introduce tu correo. Te enviaremos un código de un solo uso.',
      submit: 'Entrar',
    },
    register: {
      id: 'register',
      label: 'Crear cuenta',
      heading: 'Crear cuenta',
      lede: 'Usa tu correo. Si ya tienes cuenta, entrarás con el mismo código.',
      submit: 'Crear cuenta',
    },
  },
  note: 'Sin contraseña. Si no hay cuenta, se crea al verificar el correo.',
  helpLabel: '¿Necesitas ayuda?',
  helpHref: '/contacto',
} as const;
