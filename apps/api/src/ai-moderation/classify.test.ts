import { describe, it, expect } from 'vitest';
import { classifyText } from './classify';

describe('classifyText', () => {
  it('laisse passer un message normal', () => {
    expect(classifyText('Bonjour, on révise les fractions ce soir ?').flagged).toBe(false);
  });

  it('détecte une insulte', () => {
    const r = classifyText('mais quel connard celui-là');
    expect(r.flagged).toBe(true);
    expect(r.category).toBe('insulte');
  });

  it('détecte une menace (critique)', () => {
    const r = classifyText('je vais te frapper demain');
    expect(r.flagged).toBe(true);
    expect(r.category).toBe('menace');
    expect(r.severity).toBe('critique');
  });

  it('détecte du harcèlement grave', () => {
    const r = classifyText('personne ne t’aime, tue-toi');
    expect(r.flagged).toBe(true);
    expect(['harcelement', 'menace']).toContain(r.category);
    expect(r.severity).toBe('grave');
  });

  it('détecte une sollicitation inappropriée', () => {
    const r = classifyText('envoie-moi une photo de toi');
    expect(r.flagged).toBe(true);
    expect(r.category).toBe('inapproprie');
  });

  it('détecte en anglais', () => {
    expect(classifyText('fuck you idiot').flagged).toBe(true);
  });
});
