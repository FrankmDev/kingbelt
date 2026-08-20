const genericAssignment =
  /(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?token|password)[ \t]*[:=][ \t]*["']?([A-Za-z0-9_./+=-]{16,})/i;

const placeholderPattern = /^(?:example|placeholder|replace|redacted|changeme|not-a-real|test)[-_]/i;

export const findCredentialAssignment = (text) => {
  const match = text.match(genericAssignment);
  return match && !placeholderPattern.test(match[1]) ? match : null;
};
