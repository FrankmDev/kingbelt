import type { IconName } from '../components/ui/icon-paths';

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
