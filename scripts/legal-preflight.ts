import { evaluateCurrentLegalReadiness, type LegalReadinessReport } from '../src/config/legal-readiness.ts';

export class LegalPreflightError extends Error {
  readonly name = 'LegalPreflightError';

  constructor(message: string) {
    super(message);
  }
}

export interface LegalPreflightIO {
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
}

const list = (heading: string, items: readonly string[]): string[] => {
  if (items.length === 0) return [`${heading}:`, '- none'];
  return [`${heading}:`, ...items.map((item) => `- ${item}`)];
};

const formatPublishedPlaceholders = (report: LegalReadinessReport): string[] => {
  if (report.publishedPlaceholders.length === 0) {
    return ['Published document placeholders:', '- none'];
  }
  return [
    'Published document placeholders:',
    ...report.publishedPlaceholders.map((item) => `- ${item.document}: "${item.match}"`),
  ];
};

const formatPendingSections = (report: LegalReadinessReport): string[] => {
  if (report.publishedPendingSections.length === 0) {
    return ['Published pending sections:', '- none'];
  }
  return [
    'Published pending sections:',
    ...report.publishedPendingSections.map(
      (item) => `- ${item.document}: ${item.sectionIds.join(', ')}`
    ),
  ];
};

const formatEmptySections = (report: LegalReadinessReport): string[] => {
  if (report.publishedEmptySections.length === 0) {
    return ['Published empty sections:', '- none'];
  }
  return [
    'Published empty sections:',
    ...report.publishedEmptySections.map(
      (item) => `- ${item.document}: ${item.sectionIds.join(', ')}`
    ),
  ];
};

export const formatLegalPreflightSuccess = (report: LegalReadinessReport): string =>
  [
    'Legal preflight passed',
    'Required business facts: confirmed',
    'Required legal documents: published',
    'Published documents: no placeholders or pending sections',
    'Public navigation: published only',
    'Sitemap: unpublished excluded',
    '',
    ...list('Payment QA remaining (does not block this gate)', report.paymentQaManualDecisions),
    '',
    ...list('Optional pending claims', report.optionalPendingFacts),
  ].join('\n');

export const formatLegalPreflightFailure = (report: LegalReadinessReport): string =>
  [
    'Legal preflight failed',
    '',
    ...list('Pending business facts', report.pendingRequiredFacts),
    '',
    ...list('Draft required documents', report.draftRequiredDocuments),
    '',
    ...list('Inactive required documents', report.inactiveRequiredDocuments),
    '',
    ...formatPublishedPlaceholders(report),
    '',
    ...formatPendingSections(report),
    '',
    ...formatEmptySections(report),
    '',
    ...list('Draft in public navigation', report.draftInPublicNav),
    '',
    ...list('Unresolved manual decisions', report.unresolvedManualDecisions),
    '',
    ...list('Payment QA remaining', report.paymentQaManualDecisions),
    '',
    ...list('Optional pending claims', report.optionalPendingFacts),
    '',
    `Privacy first layer complete: ${report.incompletePrivacyFirstLayer ? 'NO' : 'YES'}`,
  ].join('\n');

export const runLegalPreflight = (): LegalReadinessReport => evaluateCurrentLegalReadiness();

export const runLegalPreflightCli = (
  io: LegalPreflightIO = {}
): number => {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  try {
    const report = runLegalPreflight();
    if (report.ok) {
      stdout.write(`${formatLegalPreflightSuccess(report)}\n`);
      return 0;
    }
    stderr.write(`${formatLegalPreflightFailure(report)}\n`);
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown legal preflight error.';
    stderr.write(`Legal preflight failed\n${message}\n`);
    return 1;
  }
};
