import { projectConfig } from '../../project.config';

const fallbackName = projectConfig.identity.projectName || 'New project';
const fallbackCompany = projectConfig.identity.companyName || fallbackName;
const fallbackDomain = projectConfig.identity.domain || 'https://example.com';

export const siteConfig = {
  name: fallbackName,
  companyName: fallbackCompany,
  domain: fallbackDomain,
  language: projectConfig.identity.language,
  locale: projectConfig.identity.locale,
  description:
    projectConfig.business.primaryGoal ||
    'Project foundation awaiting its final content and visual system.',
} as const;
