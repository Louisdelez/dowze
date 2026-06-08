import { describe, it, expect } from 'vitest';
import { buildResumePrompt } from './resume-prompt';

describe('prompt de reprise (carnet)', () => {
  it('inclut la prochaine compétence et le nombre d’acquis', () => {
    const p = buildResumePrompt({ nextSkillTitle: 'Additionner', masteredCount: 3 });
    expect(p).toContain('Additionner');
    expect(p).toContain('3');
    expect(p).toContain('socratique');
  });

  it('inclut la dernière note si présente', () => {
    const p = buildResumePrompt({ nextSkillTitle: 'X', masteredCount: 0, lastNote: 'revoir les fractions' });
    expect(p).toContain('revoir les fractions');
  });

  it('gère le tronc commun terminé', () => {
    const p = buildResumePrompt({ nextSkillTitle: null, masteredCount: 50 });
    expect(p).toContain('spécialisation');
  });
});
