/**
 * Traitements des jobs (exécutés par les workers, voir worker.ts).
 * Volontairement simples ici : l'envoi réel d'email/digest se branche ensuite.
 */
export interface DigestJob {
  minorAccountId: string;
  periodIso: string;
}

export interface PeerNotifyJob {
  skillId: string;
  learnerId: string;
}

export async function processDigest(data: DigestJob): Promise<{ ok: true }> {
  // Construire la synthèse parentale et l'envoyer (email). Idempotent via jobId.
  void data;
  return { ok: true };
}

export async function processPeerNotify(data: PeerNotifyJob): Promise<{ ok: true }> {
  // Notifier les pairs qu'une soumission attend une revue.
  void data;
  return { ok: true };
}
