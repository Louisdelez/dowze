/**
 * Détection de modération (PURE, testable) — première ligne « IA de modération » de Dowze.
 * Règle-based multilingue (FR/EN/DE) : détecte insultes, menaces, harcèlement, contenu inapproprié.
 * Conçu pour être remplacé/complété par un modèle LLM dédié (boîte noire) quand la techno sera mûre
 * (doc 26 §7.0/§7.3). Ne SANCTIONNE jamais : il suspecte et signale.
 */
export type ModerationCategory = 'insulte' | 'menace' | 'harcelement' | 'inapproprie';
export type ModerationSeverity = 'moyen' | 'grave' | 'critique';

export interface ClassifyResult {
  flagged: boolean;
  category: ModerationCategory | null;
  reason: string; // explication lisible (pour le modérateur et le parent)
  severity: ModerationSeverity;
  match: string | null;
}

interface Rule {
  re: RegExp;
  category: ModerationCategory;
  severity: ModerationSeverity;
  label: string;
}

// Motifs (frontières de mots quand pertinent). Volontairement sobres et extensibles.
const RULES: Rule[] = [
  // Menaces (grave/critique)
  { re: /\b(je vais te (tuer|frapper|défoncer|casser)|tu vas (mourir|le regretter)|je te retrouve|je sais où tu habites)\b/i, category: 'menace', severity: 'critique', label: 'menace explicite' },
  { re: /\b(i('| a)?m gonna kill you|i will kill you|kill yourself|kys)\b/i, category: 'menace', severity: 'critique', label: 'menace / incitation' },
  // Contenu inapproprié envers un mineur (grave)
  { re: /\b(envoie( |-)?(moi )?(une |des )?(photo|nude)s?|t('| es| e)s bonne|montre( |-)?toi|on se voit en vrai\b.*\bseul)/i, category: 'inapproprie', severity: 'grave', label: 'sollicitation inappropriée' },
  // Insultes (moyen)
  { re: /\b(connard|conasse|salope|pute|enculé|enfoiré|fdp|ntm|ta gueule|ferme ta gueule|tg|débile|abruti|crétin|attardé)\b/i, category: 'insulte', severity: 'moyen', label: 'insulte' },
  { re: /\b(fuck you|asshole|bitch|retard|moron|stupid idiot|shut the fuck up|stfu)\b/i, category: 'insulte', severity: 'moyen', label: 'insulte (EN)' },
  { re: /\b(arschloch|halt('s| die) (maul|klappe)|hurensohn|schlampe)\b/i, category: 'insulte', severity: 'moyen', label: 'insulte (DE)' },
  // Harcèlement (moyen/grave)
  { re: /\b(t('| es| e)s (nul|moche|gros|grosse|useless)|personne (ne )?t('| e)aime|tue( |-)?toi|va(-| )te (pendre|tuer)|dégage de (l('| )?école|ici))\b/i, category: 'harcelement', severity: 'grave', label: 'harcèlement' },
];

export function classifyText(text: string): ClassifyResult {
  const t = text.normalize('NFKC');
  for (const rule of RULES) {
    const m = rule.re.exec(t);
    if (m) {
      return {
        flagged: true,
        category: rule.category,
        reason: `Détection automatique : ${rule.label}. Extrait : « ${m[0]} ».`,
        severity: rule.severity,
        match: m[0],
      };
    }
  }
  return { flagged: false, category: null, reason: '', severity: 'moyen', match: null };
}
