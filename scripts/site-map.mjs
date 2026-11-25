// Old Webflow addresses for shadestrategy.com and what each becomes on this site.
// Source of truth: docs/superpowers/specs/2026-11-18-webflow-exit-design.md

export const SITE_ORIGIN = 'https://shadestrategy.com';

// Old addresses that keep working at the same path.
export const KEPT = [
  '/',
  '/published/privacy-policy',
  '/published/terms-and-conditions',
  '/blog/chatgpt-for-window-treatment-businesses',
  '/blog/how-to-increase-revenue-for-your-window-treatment-business',
  '/blog/how-to-start-a-window-treatment-business',
  '/blog/why-window-treatment-companies-need-seo',
];

// Old addresses that 301 to their closest new page. Paths are case-sensitive.
export const REDIRECTS = [
  { from: '/services/local-search-seo', to: '/services/window-treatment-seo/' },
  { from: '/services/ai-google-ads-for-window-treatment-businesses', to: '/services/google-ads-for-window-treatment-companies/' },
  { from: '/services/smart-websites', to: '/services/window-treatment-website-design/' },
  { from: '/windows-treatment-marketing-for-retailers', to: '/industries/marketing-for-window-treatment-retailers/' },
  { from: '/windows-treatment-for-Manufacturers', to: '/industries/marketing-for-window-treatment-manufacturers/' },
  { from: '/project/marketing-for-window-treatment-retailers', to: '/industries/marketing-for-window-treatment-retailers/' },
  { from: '/project/marketing-for-window-treatment-manufacturers', to: '/industries/marketing-for-window-treatment-manufacturers/' },
  { from: '/project/marketing-for-window-treatment-installers', to: '/industries/marketing-for-window-treatment-retailers/' },
  { from: '/published/contact-us', to: '/contact/' },
  { from: '/published/window-treatment-marketing-blog', to: '/resources/' },
  { from: '/published/window-treatment-industry-marketing', to: '/' },
  { from: '/published/thank-you', to: '/' },
  { from: '/utility-pages/coming-soon', to: '/' },
  { from: '/pricing', to: '/full-service/' },
  { from: '/services/workflow-automations-for-window-treatment-businesses', to: '/' },
];

export const OLD_URLS = [...KEPT, ...REDIRECTS.map((r) => r.from)];
