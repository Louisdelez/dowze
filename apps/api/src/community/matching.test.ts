import { describe, it, expect } from 'vitest';
import { formClasses, type Candidate } from './matching';

function cand(id: string, level: number, locale = 'fr', tz = 'Europe/Zurich'): Candidate {
  return { profileId: id, locale, timezone: tz, type: 'tronc-commun', level };
}

describe('formation des classes', () => {
  it('sépare par contraintes dures (langue/fuseau/type)', () => {
    const classes = formClasses([cand('a', 1), cand('b', 1, 'en')]);
    expect(classes).toHaveLength(2); // langues différentes → classes différentes
  });

  it('découpe en classes de taille cible', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => cand(`p${i}`, i));
    const classes = formClasses(candidates, 3);
    expect(classes).toHaveLength(2);
    expect(classes[0]?.memberIds.length).toBe(3);
    expect(classes[1]?.memberIds.length).toBe(3);
  });

  it('rend les niveaux hétérogènes DANS une classe (round-robin)', () => {
    // niveaux 0..5, 2 classes de 3 → chaque classe contient des niveaux variés
    const candidates = Array.from({ length: 6 }, (_, i) => cand(`p${i}`, i));
    const classes = formClasses(candidates, 3);
    // classe 0 reçoit les indices triés 0,2,4 ; classe 1 reçoit 1,3,5
    const levelsByClasse = classes.map((c) =>
      c.memberIds.map((id) => Number(id.replace('p', ''))),
    );
    for (const levels of levelsByClasse) {
      expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThanOrEqual(2);
    }
  });

  it('une seule classe si peu de candidats', () => {
    expect(formClasses([cand('a', 1), cand('b', 2)], 24)).toHaveLength(1);
  });
});
