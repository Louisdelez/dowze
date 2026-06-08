/**
 * Identifiants de jobs **idempotents** (PURS) : un même travail produit le même
 * `jobId` → BullMQ déduplique (un digest/notification n'est pas envoyé deux fois).
 */
export function digestJobId(minorAccountId: string, periodIso: string): string {
  return `digest:${minorAccountId}:${periodIso}`;
}

export function peerNotifyJobId(skillId: string, learnerId: string): string {
  return `peer-notify:${skillId}:${learnerId}`;
}
