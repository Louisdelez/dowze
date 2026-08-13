import { describe, it, expect } from 'vitest';
import { assignClasses, balancedSizes, MIN_SIZE, MAX_SIZE, type Candidate } from './assign';

function make(n: number, level: number, lang: string, age: number | null): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({
    profileId: `${lang}-${level}-${age}-${i}`,
    level,
    lang,
    age,
  }));
}

describe('balancedSizes', () => {
  it('répartit équitablement', () => {
    expect(balancedSizes(62, 3)).toEqual([21, 21, 20]);
    expect(balancedSizes(20, 1)).toEqual([20]);
  });
});

describe('assignClasses', () => {
  it('ne mélange jamais deux niveaux (contrainte dure)', () => {
    const cands = [...make(20, 1, 'fr', 14), ...make(20, 2, 'fr', 14)];
    const classes = assignClasses(cands);
    for (const c of classes) {
      const levels = new Set(
        cands.filter((x) => c.memberIds.includes(x.profileId)).map((x) => x.level),
      );
      expect(levels.size).toBe(1);
    }
  });

  it('forme des classes mono-âge quand il y a assez de monde', () => {
    const cands = make(20, 1, 'fr', 14);
    const classes = assignClasses(cands);
    expect(classes.every((c) => c.reason === 'mono-age')).toBe(true);
    expect(
      classes.every((c) => c.memberIds.length >= MIN_SIZE && c.memberIds.length <= MAX_SIZE),
    ).toBe(true);
  });

  it("l'âge n'exclut jamais : peu de monde d'âges variés reste ensemble (même langue)", () => {
    // 14 apprenants même (niveau,langue) mais âges très variés (< MIN par tranche) → une classe same-lang.
    const cands = [
      ...make(3, 1, 'fr', 10),
      ...make(3, 1, 'fr', 14),
      ...make(3, 1, 'fr', 16),
      ...make(5, 1, 'fr', 30),
    ];
    const classes = assignClasses(cands);
    expect(classes).toHaveLength(1);
    expect(classes[0]?.reason).toBe('same-lang');
    expect(classes[0]?.memberIds.length).toBe(14);
  });

  it('fusionne en classe multilingue quand une langue est trop peu nombreuse', () => {
    // Même niveau, 3 langues à 5 chacune (< MIN) → fusion multilingue.
    const cands = [...make(5, 1, 'fr', 14), ...make(5, 1, 'de', 14), ...make(5, 1, 'it', 14)];
    const classes = assignClasses(cands);
    expect(classes).toHaveLength(1);
    expect(classes[0]?.isMultilingual).toBe(true);
    expect(classes[0]?.reason).toBe('multilingual');
    expect(classes[0]?.memberIds.length).toBe(15);
  });

  it('ne laisse personne isolé (multi-niveau adjacent en dernier recours)', () => {
    const cands = [...make(4, 1, 'fr', 14), ...make(3, 2, 'de', 30)];
    const classes = assignClasses(cands);
    const placed = classes.flatMap((c) => c.memberIds);
    expect(placed.length).toBe(7); // tout le monde est placé
  });

  it('respecte les bornes de taille sur un grand effectif', () => {
    const cands = make(62, 1, 'fr', 14);
    const classes = assignClasses(cands);
    expect(classes.length).toBe(3);
    for (const c of classes) {
      expect(c.memberIds.length).toBeGreaterThanOrEqual(MIN_SIZE);
      expect(c.memberIds.length).toBeLessThanOrEqual(MAX_SIZE);
    }
  });
});
