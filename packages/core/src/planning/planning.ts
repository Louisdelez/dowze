import type { PlanningEntry, PlanningEntryKind, Slot } from '@dowze/schemas';
import { atWeekdayMinute } from '../util/date';

/**
 * Calcul de planning **déterministe** (cf. docs/10-APP-WEB/11-planning-regularite.md).
 * L'intra agence des tâches (déjà priorisées : révisions dues d'abord, puis
 * nouvel apprentissage) dans les créneaux de disponibilité de la semaine.
 * L'IA génère le « quoi » ; ici on calcule seulement le « quand ».
 */

export interface PlanningItem {
  kind: PlanningEntryKind;
  skillId?: string | null;
  expeditionId?: string | null;
  durationMin: number;
}

export interface PlanningInput {
  profileId: string;
  /** Lundi 00:00 UTC de la semaine visée. */
  weekStartIso: string;
  slots: readonly Slot[];
  /** Tâches déjà priorisées (l'ordre est respecté). */
  items: readonly PlanningItem[];
  /** Fournit un id d'entrée déterministe (l'intra n'invente rien d'aléatoire). */
  idFactory: (index: number) => string;
}

export interface PlanningOutput {
  entries: PlanningEntry[];
  /** Tâches qui n'ont pas trouvé de place cette semaine. */
  unscheduled: PlanningItem[];
}

function slotStart(weekStartIso: string, slot: Slot): string {
  return atWeekdayMinute(weekStartIso, slot.dayOfWeek, slot.startMinute);
}

/** Agence les tâches dans les créneaux, en respectant la priorité. */
export function computeWeeklyPlanning(input: PlanningInput): PlanningOutput {
  const slots = [...input.slots].sort(
    (a, b) =>
      new Date(slotStart(input.weekStartIso, a)).getTime() -
      new Date(slotStart(input.weekStartIso, b)).getTime(),
  );

  const queue: PlanningItem[] = [...input.items];
  const unscheduled: PlanningItem[] = [];
  const entries: PlanningEntry[] = [];
  let index = 0;

  for (const slot of slots) {
    let remaining = slot.durationMin;
    let cursorIso = slotStart(input.weekStartIso, slot);

    while (queue.length > 0) {
      const head = queue[0] as PlanningItem;
      if (head.durationMin <= remaining) {
        queue.shift();
        entries.push({
          id: input.idFactory(index),
          profileId: input.profileId,
          dateIso: cursorIso,
          kind: head.kind,
          skillId: head.skillId ?? null,
          expeditionId: head.expeditionId ?? null,
          durationMin: head.durationMin,
          status: 'prevu',
        });
        index += 1;
        cursorIso = new Date(new Date(cursorIso).getTime() + head.durationMin * 60_000).toISOString();
        remaining -= head.durationMin;
      } else if (head.durationMin > slot.durationMin) {
        // Ne tiendra dans aucun créneau de cette taille → non planifiable ici.
        unscheduled.push(queue.shift() as PlanningItem);
      } else {
        break; // ne tient pas dans le reste de CE créneau → créneau suivant
      }
    }
  }

  unscheduled.push(...queue);
  return { entries, unscheduled };
}
