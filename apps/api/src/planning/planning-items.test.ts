import { describe, it, expect } from 'vitest';
import { buildPlanningItems } from './planning-items';

describe('planning — priorisation des tâches', () => {
  it('met les révisions en premier, puis l’apprentissage', () => {
    const items = buildPlanningItems({ dueSkillIds: ['a', 'b'], nextSkillId: 'c' });
    expect(items.map((i) => i.kind)).toEqual(['revision', 'revision', 'apprentissage']);
    expect(items[2]?.skillId).toBe('c');
  });

  it('sans révision due ni prochaine compétence : liste vide', () => {
    expect(buildPlanningItems({ dueSkillIds: [], nextSkillId: null })).toEqual([]);
  });

  it('respecte les durées fournies', () => {
    const items = buildPlanningItems({
      dueSkillIds: ['a'],
      nextSkillId: 'b',
      reviewMin: 10,
      learnMin: 30,
    });
    expect(items[0]?.durationMin).toBe(10);
    expect(items[1]?.durationMin).toBe(30);
  });
});
