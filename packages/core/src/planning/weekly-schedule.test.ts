import { describe, it, expect } from 'vitest';
import { SCHEDULE_PRESETS, weeklySchedule } from './weekly-schedule';

describe('weeklySchedule', () => {
  const base = {
    age: 14,
    activeDays: [1, 2, 3, 4, 5],
    dayStartMin: 8 * 60,
    dayEndMin: 17 * 60,
    intensity: 'moyen' as const,
    hasSecondary: true,
  };

  it('met la langue en premier bloc de chaque jour actif', () => {
    const blocks = weeklySchedule(base);
    for (const dow of base.activeDays) {
      const day = blocks.filter((b) => b.dayOfWeek === dow).sort((a, b) => a.startMin - b.startMin);
      expect(day[0]?.type).toBe('langue');
      expect(day[1]?.type).toBe('revision'); // révisions juste après
    }
  });

  it('ne planifie rien les jours de repos (non actifs)', () => {
    const blocks = weeklySchedule(base);
    expect(blocks.some((b) => b.dayOfWeek === 0 || b.dayOfWeek === 6)).toBe(false);
  });

  it('protège langue + révisions même dans un créneau du soir très court (compression)', () => {
    const soir = weeklySchedule({
      ...base,
      dayStartMin: 19 * 60,
      dayEndMin: 20 * 60,
      intensity: 'leger',
    });
    const mon = soir.filter((b) => b.dayOfWeek === 1).map((b) => b.type);
    expect(mon).toContain('langue');
    expect(mon).toContain('revision');
  });

  it('reste dans la fenêtre horaire (jamais après dayEnd)', () => {
    const blocks = weeklySchedule(base);
    for (const b of blocks) expect(b.startMin + b.durationMin).toBeLessThanOrEqual(base.dayEndMin);
  });

  it('la passion n’est jamais le premier bloc de la journée', () => {
    const blocks = weeklySchedule({ ...base, intensity: 'soutenu' });
    for (const dow of base.activeDays) {
      const first = blocks
        .filter((b) => b.dayOfWeek === dow)
        .sort((a, b) => a.startMin - b.startMin)[0];
      expect(first?.type).not.toBe('passion');
    }
  });

  it('expose 6 presets nommés', () => {
    expect(SCHEDULE_PRESETS.length).toBe(6);
    expect(SCHEDULE_PRESETS.map((p) => p.key)).toContain('soir');
  });
});

describe('weeklySchedule — orchestration multi-source (activités récurrentes de plugins)', () => {
  const base = {
    age: 20,
    activeDays: [1, 2, 3, 4, 5],
    dayStartMin: 8 * 60,
    dayEndMin: 18 * 60,
    intensity: 'moyen' as const,
    hasSecondary: false,
  };
  const workout = {
    key: 'fitness:w1',
    entryType: 'fitness.workout',
    label: 'Séance',
    durationMin: 50,
    frequencyPerWeek: 3,
    intensity: 'moderee' as const,
    sourceApp: 'fitness',
    color: 'emerald',
    icon: 'activity',
    appLabel: 'Dowze Fitness',
    href: 'https://fitness.dowze.ch',
  };

  it('inscrit « sport 3×/sem » sur exactement 3 jours ESPACÉS', () => {
    const blocks = weeklySchedule({
      ...base,
      recurring: [{ ...workout, cognitiveBoostBeforeStudy: true }],
    });
    const days = [
      ...new Set(blocks.filter((b) => b.type === 'plugin').map((b) => b.dayOfWeek)),
    ].sort();
    expect(days.length).toBe(3);
    // espacées : lun/mer/ven (pas 2 jours consécutifs)
    expect(days).toEqual([1, 3, 5]);
  });

  it('place la séance MODÉRÉE avant l’étude quand cognitiveBoostBeforeStudy (1er bloc du jour)', () => {
    const blocks = weeklySchedule({
      ...base,
      recurring: [{ ...workout, cognitiveBoostBeforeStudy: true }],
    });
    for (const dow of [1, 3, 5]) {
      const day = blocks.filter((b) => b.dayOfWeek === dow).sort((a, b) => a.startMin - b.startMin);
      expect(day[0]?.type).toBe('plugin'); // avant langue
      expect(day.some((b) => b.type === 'langue')).toBe(true); // l'étude reste présente
      expect(day.some((b) => b.type === 'revision')).toBe(true);
    }
  });

  it('place la séance INTENSE en fin de journée, jamais avant l’étude', () => {
    const blocks = weeklySchedule({ ...base, recurring: [{ ...workout, intensity: 'intense' }] });
    for (const dow of [1, 3, 5]) {
      const day = blocks.filter((b) => b.dayOfWeek === dow).sort((a, b) => a.startMin - b.startMin);
      if (day.length === 0) continue;
      expect(day[0]?.type).not.toBe('plugin'); // pas en premier
      expect(day[day.length - 1]?.type).toBe('plugin'); // en dernier
    }
  });

  it('respecte le cap OMS (weeklyCapMin) en réduisant la fréquence', () => {
    // 50 min × cap 100 ⇒ au plus 2 séances/sem.
    const blocks = weeklySchedule({
      ...base,
      recurring: [{ ...workout, frequencyPerWeek: 5, weeklyCapMin: 100 }],
    });
    const days = [...new Set(blocks.filter((b) => b.type === 'plugin').map((b) => b.dayOfWeek))];
    expect(days.length).toBe(2);
  });

  it('ne place jamais d’activité un jour de repos (non actif)', () => {
    const blocks = weeklySchedule({ ...base, recurring: [{ ...workout, frequencyPerWeek: 5 }] });
    expect(
      blocks.some((b) => b.type === 'plugin' && (b.dayOfWeek === 0 || b.dayOfWeek === 6)),
    ).toBe(false);
  });

  it('n’évince jamais langue + révisions (l’étude reste le socle)', () => {
    const blocks = weeklySchedule({
      ...base,
      recurring: [{ ...workout, frequencyPerWeek: 5, durationMin: 90 }],
    });
    for (const dow of base.activeDays) {
      const types = blocks.filter((b) => b.dayOfWeek === dow).map((b) => b.type);
      expect(types).toContain('langue');
      expect(types).toContain('revision');
    }
  });

  it('reste dans la fenêtre horaire avec les activités plugin', () => {
    const blocks = weeklySchedule({
      ...base,
      recurring: [{ ...workout, cognitiveBoostBeforeStudy: true }],
    });
    for (const b of blocks) expect(b.startMin + b.durationMin).toBeLessThanOrEqual(base.dayEndMin);
  });

  it('porte les métadonnées d’affichage sur les blocs plugin (couleur, icône, deep-link)', () => {
    const blocks = weeklySchedule({ ...base, recurring: [workout] });
    const plugin = blocks.find((b) => b.type === 'plugin');
    expect(plugin?.color).toBe('emerald');
    expect(plugin?.icon).toBe('activity');
    expect(plugin?.href).toBe('https://fitness.dowze.ch');
    expect(plugin?.appLabel).toBe('Dowze Fitness');
  });

  it('sans activité récurrente, la sortie est identique à avant (non-régression)', () => {
    const a = weeklySchedule(base);
    const b = weeklySchedule({ ...base, recurring: [] });
    expect(a).toEqual(b);
    // et l'étude commence toujours par langue → révision
    for (const dow of base.activeDays) {
      const day = a.filter((x) => x.dayOfWeek === dow).sort((p, q) => p.startMin - q.startMin);
      expect(day[0]?.type).toBe('langue');
      expect(day[1]?.type).toBe('revision');
    }
  });
});
