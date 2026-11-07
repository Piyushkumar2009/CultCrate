// Single source of truth for every public contact link.
export const SUPPORT_EMAIL = 'piyushmourya927@gmail.com';

export const GITHUB_URL = 'https://github.com/Piyushkumar2009';

const mail = (subject: string, body?: string): string => {
  const params = new URLSearchParams({ subject });
  if (body) params.set('body', body);
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${SUPPORT_EMAIL}?${params.toString().replace(/\+/g, '%20')}`;
};

export const SUPPORT_MAILTO = mail('CultCrate support');
export const BUG_MAILTO = mail(
  'CultCrate bug report',
  'What happened:\n\nWhat I expected:\n\nSteps to reproduce:\n\nDevice / browser:\n'
);
export const FEATURE_MAILTO = mail(
  'CultCrate feature request',
  'The feature I would love to see:\n\nWhy it would help:\n'
);
