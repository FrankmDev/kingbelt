import { projectConfig } from '../../project.config';

export interface NavigationItem {
  label: string;
  href: `/${string}`;
}

export const primaryNavigation: NavigationItem[] = projectConfig.pages.map((page) => ({
  label: page.name,
  href: page.path,
}));
