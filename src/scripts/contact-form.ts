type Cleanup = () => void;

const fieldMessages: Record<string, string> = {
  name: 'Introduce tu nombre (mínimo 2 caracteres).',
  email: 'Introduce un email válido.',
  subject: 'Selecciona el tipo de consulta.',
  message: 'Escribe un mensaje de al menos 10 caracteres.',
  privacy: 'Debes aceptar la política de privacidad.',
};

const setFieldState = (
  field: HTMLElement,
  message: string | null,
  errorId: string
) => {
  const invalid = Boolean(message);
  field.toggleAttribute('aria-invalid', invalid);
  if (invalid) field.setAttribute('aria-errormessage', errorId);
  else field.removeAttribute('aria-errormessage');

  const errorNode = document.getElementById(errorId);
  if (errorNode) {
    errorNode.textContent = message ?? '';
    errorNode.hidden = !message;
  }
};

const announceStatus = (status: HTMLElement | null, message: string, isError = false) => {
  if (!status) return;
  status.textContent = message;
  status.setAttribute('role', isError ? 'alert' : 'status');
  status.focus();
};

export const initContactForm = (form: HTMLFormElement): Cleanup => {
  if (form.dataset.contactBound === 'true') return () => {};

  const status = form.querySelector<HTMLElement>('#contact-form-status');
  const fields = {
    name: form.querySelector<HTMLInputElement>('#contact-name'),
    email: form.querySelector<HTMLInputElement>('#contact-email'),
    subject: form.querySelector<HTMLSelectElement>('#contact-subject'),
    message: form.querySelector<HTMLTextAreaElement>('#contact-message'),
    privacy: form.querySelector<HTMLInputElement>('#contact-privacy'),
  };

  if (!fields.name || !fields.email || !fields.subject || !fields.message || !fields.privacy) {
    return () => {};
  }
  const nameField = fields.name;
  const emailField = fields.email;
  const subjectField = fields.subject;
  const messageField = fields.message;
  const privacyField = fields.privacy;
  const fieldElements = [nameField, emailField, subjectField, messageField, privacyField];

  form.dataset.contactBound = 'true';
  const controller = new AbortController();
  const { signal } = controller;

  const validate = (): boolean => {
    let firstInvalid: HTMLElement | null = null;
    let valid = true;

    const checks: Array<{ field: HTMLElement; id: string; test: () => boolean }> = [
      { field: nameField, id: 'contact-name-error', test: () => nameField.value.trim().length >= 2 },
      {
        field: emailField,
        id: 'contact-email-error',
        test: () => emailField.validity.valid && emailField.value.trim().length > 0,
      },
      { field: subjectField, id: 'contact-subject-error', test: () => subjectField.value !== '' },
      { field: messageField, id: 'contact-message-error', test: () => messageField.value.trim().length >= 10 },
      { field: privacyField, id: 'contact-privacy-error', test: () => privacyField.checked },
    ];

    for (const { field, id, test } of checks) {
      const fieldName = field.dataset.contactField ?? '';
      const message = test() ? null : fieldMessages[fieldName] ?? 'Revisa este campo.';
      setFieldState(field, message, id);
      if (message) {
        valid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    }

    if (!valid) {
      announceStatus(status, 'Revisa los campos marcados antes de enviar.', true);
      firstInvalid?.focus();
    }

    return valid;
  };

  form.addEventListener(
    'invalid',
    (event) => {
      event.preventDefault();
      validate();
    },
    { signal, capture: true }
  );

  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      if (!validate()) {
        return;
      }
      announceStatus(
        status,
        'El formulario todavía no está conectado. Escríbenos por email para enviar tu consulta.',
        true
      );
    },
    { signal }
  );

  fieldElements.forEach((field) => {
    field.addEventListener(
      'input',
      () => {
        const fieldName = field.dataset.contactField ?? '';
        const errorId = `${field.id}-error`;
        setFieldState(field, null, errorId);
        if (status?.textContent && fieldName) status.textContent = '';
      },
      { signal }
    );
  });

  return () => {
    controller.abort();
    delete form.dataset.contactBound;
  };
};

export const initContactForms = (): void => {
  document.querySelectorAll<HTMLFormElement>('#contact-form').forEach(initContactForm);
};
