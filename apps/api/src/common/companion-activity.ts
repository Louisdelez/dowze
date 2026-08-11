const DOMAIN_SPACES: Record<string, string> = {
  accounts: 'identity',
  onboarding: 'orientation',
  placement: 'orientation',
  planning: 'planning',
  schedule: 'planning',
  calendar: 'planning',
  progression: 'academie',
  skills: 'academie',
  carnet: 'academie',
  fsrs: 'academie',
  exercises: 'academie',
  tests: 'academie',
  results: 'academie',
  'rank-jump': 'academie',
  validation: 'academie',
  xp: 'academie',
  expeditions: 'expeditions',
  community: 'community',
  social: 'community',
  classes: 'community',
  messages: 'community',
  moderation: 'community',
  protections: 'community',
  translation: 'community',
  languages: 'learning-path',
  electives: 'learning-path',
  specialization: 'learning-path',
  plugins: 'services',
  ai: 'services',
  copilote: 'services',
  bridge: 'services',
};

export interface CompanionActivity {
  domain: string;
  space: string;
  path: string;
}

/** Classifie une mutation métier sans conserver paramètres, corps ou secrets. */
export function classifyCompanionActivity(
  method: string,
  rawUrl: string,
): CompanionActivity | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return null;
  const path = (rawUrl.split('?', 1).at(0) ?? '/').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  const first = parts[0];
  const domain = first === 'v1' ? parts[1] : first;
  if (!domain || ['auth', 'health', 'companion'].includes(domain)) return null;
  return { domain, space: DOMAIN_SPACES[domain] ?? 'dowze', path };
}
