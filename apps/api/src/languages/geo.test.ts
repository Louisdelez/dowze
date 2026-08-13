import { describe, it, expect } from 'vitest';
import { countryFromLocale, proposeLanguages } from './geo';

describe('countryFromLocale', () => {
  it('extrait le pays d’une locale type fr-CH', () => {
    expect(countryFromLocale('fr-CH')).toBe('CH');
    expect(countryFromLocale('fr')).toBeNull();
    expect(countryFromLocale(null)).toBeNull();
  });
});

describe('proposeLanguages', () => {
  it('propose l’allemand en priorité à un romand (langue nationale + voisin)', () => {
    const props = proposeLanguages('CH', 'fr', []);
    expect(props[0]?.lang).toBe('de');
    expect(props.map((p) => p.lang)).toContain('it');
  });

  it('propose le néerlandais à un belge francophone', () => {
    const props = proposeLanguages('BE', 'fr', []);
    expect(props[0]?.lang).toBe('nl');
  });

  it('exclut la langue maternelle et les langues déjà apprises', () => {
    const props = proposeLanguages('CH', 'fr', ['de']);
    const langs = props.map((p) => p.lang);
    expect(langs).not.toContain('fr');
    expect(langs).not.toContain('de');
  });

  it('retombe sur un repli mondial si le pays est inconnu', () => {
    const props = proposeLanguages(null, 'fr', []);
    expect(props.length).toBeGreaterThan(0);
    expect(props[0]?.lang).toBe('en');
  });

  it('chaque proposition a un pitch non vide', () => {
    for (const p of proposeLanguages('FR', 'fr', [])) expect(p.pitch.length).toBeGreaterThan(0);
  });
});
