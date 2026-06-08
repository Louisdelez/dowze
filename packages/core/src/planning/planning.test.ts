import { describe, it, expect } from 'vitest';
import { planningEntrySchema } from '@dowze/schemas';
import { computeWeeklyPlanning, type PlanningItem } from './planning';

const PROFILE = '22222222-2222-4222-8222-222222222222';
const id = (n: number): string => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);
const WEEK = '2026-06-08T00:00:00.000Z'; // traité comme lundi 00:00

const items: PlanningItem[] = [
  { kind: 'revision', skillId: id(1), durationMin: 25 },
  { kind: 'apprentissage', skillId: id(2), durationMin: 25 },
  { kind: 'apprentissage', skillId: id(3), durationMin: 30 },
];

describe('planning déterministe', () => {
  it('agence les tâches dans les créneaux en respectant la priorité', () => {
    const out = computeWeeklyPlanning({
      profileId: PROFILE,
      weekStartIso: WEEK,
      slots: [
        { dayOfWeek: 1, startMinute: 540, durationMin: 60 }, // lundi 09:00, 60 min
        { dayOfWeek: 2, startMinute: 540, durationMin: 30 }, // mardi 09:00, 30 min
      ],
      items,
      idFactory: (i) => id(i + 4),
    });

    expect(out.entries).toHaveLength(3);
    expect(out.unscheduled).toHaveLength(0);

    // 25 + 25 dans le créneau de lundi, 30 dans celui de mardi.
    expect(out.entries[0]?.dateIso).toBe('2026-06-08T09:00:00.000Z');
    expect(out.entries[1]?.dateIso).toBe('2026-06-08T09:25:00.000Z');
    expect(out.entries[2]?.dateIso).toBe('2026-06-09T09:00:00.000Z');

    // Tout est conforme au schéma.
    for (const e of out.entries) expect(planningEntrySchema.parse(e)).toBeTruthy();
  });

  it('met de côté ce qui ne tient nulle part', () => {
    const out = computeWeeklyPlanning({
      profileId: PROFILE,
      weekStartIso: WEEK,
      slots: [{ dayOfWeek: 1, startMinute: 540, durationMin: 20 }],
      items: [{ kind: 'apprentissage', skillId: id(1), durationMin: 45 }],
      idFactory: (i) => id(i + 4),
    });
    expect(out.entries).toHaveLength(0);
    expect(out.unscheduled).toHaveLength(1);
  });

  it('est déterministe (mêmes entrées → mêmes ids/dates)', () => {
    const args = {
      profileId: PROFILE,
      weekStartIso: WEEK,
      slots: [{ dayOfWeek: 1, startMinute: 540, durationMin: 60 }],
      items,
      idFactory: (i: number) => id(i + 4),
    };
    expect(computeWeeklyPlanning(args)).toEqual(computeWeeklyPlanning(args));
  });
});
