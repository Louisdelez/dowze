import { describe, expect, it } from 'vitest';
import { classifyCompanionActivity } from './companion-activity';

describe('classifyCompanionActivity', () => {
  it('ignore les lectures et les routes sensibles ou déjà journalisées', () => {
    expect(classifyCompanionActivity('GET', '/v1/results')).toBeNull();
    expect(classifyCompanionActivity('POST', '/auth/session')).toBeNull();
    expect(classifyCompanionActivity('POST', '/companion/orchestrate')).toBeNull();
  });

  it('rattache les mutations académiques à la mémoire Académie sans query string', () => {
    expect(classifyCompanionActivity('PATCH', '/v1/exercises/42?token=secret')).toEqual({
      domain: 'exercises',
      space: 'academie',
      path: '/v1/exercises/42',
    });
  });

  it('conserve aussi les nouveaux domaines dans la continuité générale', () => {
    expect(classifyCompanionActivity('DELETE', '/future/item/7')).toEqual({
      domain: 'future',
      space: 'dowze',
      path: '/future/item/7',
    });
  });
});
