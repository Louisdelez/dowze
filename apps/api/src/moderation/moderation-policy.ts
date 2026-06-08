import type { IncidentSeverity } from '@dowze/schemas';

/**
 * Politique de modération (PURE). Décide, pour un incident, s'il faut une revue
 * humaine et/ou une alerte parentale. Les bots priorisent ; **un humain tranche**.
 * Si un mineur est auteur OU victime d'un incident grave → alerte parent.
 * (cf. docs/10-APP-WEB/05-systeme-communautaire/06-systeme-parental-et-moderation.md)
 */
export interface IncidentInput {
  severity: IncidentSeverity;
  authorIsMinor: boolean;
  victimIsMinor: boolean;
}

export interface EscalationDecision {
  /** Un modérateur humain doit revoir (jamais d'auto-bannissement). */
  humanReview: boolean;
  /** Une alerte parentale doit être préparée (validée par un humain avant envoi). */
  alertParent: boolean;
}

export function decideEscalation(incident: IncidentInput): EscalationDecision {
  const severe = incident.severity === 'grave' || incident.severity === 'critique';
  const humanReview = severe || incident.severity === 'moyen';
  const alertParent = severe && (incident.authorIsMinor || incident.victimIsMinor);
  return { humanReview, alertParent };
}
