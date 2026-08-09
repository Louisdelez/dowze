import { describe, it, expect } from 'vitest';
import { normalizeAnswer, matchesAccepted, gradeCloze } from './grade';
import { countdownAt, sessionMinutesForAge } from '../planning/timer';

describe('correction d’exercices (tolérante)', () => {
  it('normalise casse, accents, ponctuation, espaces', () => {
    expect(normalizeAnswer('  Éléphant! ')).toBe('elephant');
    expect(normalizeAnswer('l’Eau')).toBe('l eau');
  });

  it('accepte les synonymes déclarés', () => {
    expect(matchesAccepted('Paris', ['paris'])).toBe(true);
    expect(matchesAccepted('vélo', ['bicyclette', 'velo'])).toBe(true);
    expect(matchesAccepted('', ['x'])).toBe(false);
    expect(matchesAccepted('faux', ['vrai'])).toBe(false);
  });

  it('corrige un cloze trou par trou', () => {
    const g = gradeCloze(['le', 'chat'], [{ acceptedAnswers: ['le'] }, { acceptedAnswers: ['chien'] }]);
    expect(g.perGap).toEqual([true, false]);
    expect(g.correct).toBe(1);
    expect(g.total).toBe(2);
  });
});

describe('compte à rebours de séance', () => {
  it('décompte depuis l’heure de départ et signale la fin', () => {
    const start = 1_000_000;
    expect(countdownAt(start, 45, start).remainingSec).toBe(45 * 60);
    expect(countdownAt(start, 45, start + 60_000).remainingSec).toBe(44 * 60);
    const fin = countdownAt(start, 45, start + 45 * 60_000);
    expect(fin.remainingSec).toBe(0);
    expect(fin.done).toBe(true);
  });

  it('adapte la durée à l’âge', () => {
    expect(sessionMinutesForAge(8)).toBe(20);
    expect(sessionMinutesForAge(15)).toBe(45);
    expect(sessionMinutesForAge(30)).toBe(45);
    expect(sessionMinutesForAge(null)).toBe(45);
  });
});
