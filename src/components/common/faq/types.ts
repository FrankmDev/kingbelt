import type { IconName } from '../../ui/icon-paths';

export interface FAQItem {
  question: string;
  answer: string;
  category: string;
  icon: IconName;
}

export interface FAQCTA {
  title: string;
  description: string;
  buttonLabel: string;
  buttonHref: string;
}
