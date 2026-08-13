import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { CopiloteService } from '../copilote/copilote.service';

/**
 * Boîte à outils des abeilles-agents (boucle ReAct) — MVP « sûr » : AUCUN effet de bord,
 * aucune clé externe, aucun sandbox. Une abeille passe de « répond de mémoire » à « va
 * chercher / calcule / s'ancre puis répond ». Les outils dangereux (code, fichiers, réseau,
 * API tierces) viendront plus tard, derrière des portes d'approbation (surtout enfants).
 */

// --- Calculatrice SÛRE : parseur d'expression maison (JAMAIS eval / Function) ---
// Grammaire (récursive descendante) :
//   expr   = term (('+'|'-') term)*
//   term   = unary (('*'|'/'|'%') unary)*
//   unary  = ('+'|'-') unary | power
//   power  = primary ('^' unary)?            (^ associatif à droite)
//   primary= number | const | func '(' expr ')' | '(' expr ')'
const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

export function evalExpression(input: string): number {
  // Normalisation légère : symboles usuels + virgule décimale française.
  const src = input
    .replace(/π/g, 'pi')
    .replace(/×/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/(\d),(\d)/g, '$1.$2')
    .trim();
  if (!src) throw new Error('Expression vide.');
  if (src.length > 200) throw new Error('Expression trop longue.');

  let i = 0;
  const skip = () => {
    while (i < src.length && /\s/.test(src[i]!)) i++;
  };

  function parseExpr(): number {
    let v = parseTerm();
    for (;;) {
      skip();
      const c = src[i];
      if (c === '+') {
        i++;
        v += parseTerm();
      } else if (c === '-') {
        i++;
        v -= parseTerm();
      } else break;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseUnary();
    for (;;) {
      skip();
      const c = src[i];
      if (c === '*') {
        i++;
        v *= parseUnary();
      } else if (c === '/') {
        i++;
        const d = parseUnary();
        if (d === 0) throw new Error('Division par zéro.');
        v /= d;
      } else if (c === '%') {
        i++;
        const d = parseUnary();
        if (d === 0) throw new Error('Modulo par zéro.');
        v %= d;
      } else break;
    }
    return v;
  }
  function parseUnary(): number {
    skip();
    if (src[i] === '+') {
      i++;
      return parseUnary();
    }
    if (src[i] === '-') {
      i++;
      return -parseUnary();
    }
    return parsePower();
  }
  function parsePower(): number {
    const base = parsePrimary();
    skip();
    if (src[i] === '^') {
      i++;
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  }
  function parsePrimary(): number {
    skip();
    const c = src[i];
    if (c === '(') {
      i++;
      const v = parseExpr();
      skip();
      if (src[i] !== ')') throw new Error('Parenthèse fermante manquante.');
      i++;
      return v;
    }
    const rest = src.slice(i);
    const num = /^[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/.exec(rest);
    if (num) {
      i += num[0].length;
      return parseFloat(num[0]);
    }
    const id = /^[a-zA-Z][a-zA-Z0-9]*/.exec(rest);
    if (id) {
      const name = id[0].toLowerCase();
      i += id[0].length;
      skip();
      if (src[i] === '(') {
        const fn = FUNCS[name];
        if (!fn) throw new Error(`Fonction inconnue : ${name}.`);
        i++;
        const arg = parseExpr();
        skip();
        if (src[i] !== ')') throw new Error('Parenthèse fermante manquante.');
        i++;
        return fn(arg);
      }
      const k = CONSTS[name];
      if (k === undefined) throw new Error(`Terme inconnu : ${name}.`);
      return k;
    }
    throw new Error('Expression invalide.');
  }

  const result = parseExpr();
  skip();
  if (i < src.length) throw new Error('Caractères en trop.');
  if (!Number.isFinite(result)) throw new Error('Résultat non défini (infini ou invalide).');
  // Arrondi propre des erreurs de flottant (ex : 0.1+0.2).
  return Math.round(result * 1e10) / 1e10;
}

/** Libellés lisibles des outils (pour la caption « a utilisé : … » côté client). */
export const TOOL_LABELS: Record<string, string> = {
  calculatrice: 'la calculatrice',
  date_heure: 'la date/heure',
  chercher_connaissances: 'tes connaissances',
  chercher_connaissances_entreprise: 'la base de l’organisation',
  chercher_memoire_ruche: 'la mémoire de la Ruche',
  deleguer_dans_la_ruche: 'une abeille spécialiste',
  recherche_web: 'le web',
};

/** Instance SearXNG (interne au réseau docker par défaut : pas d'auth ni TLS depuis l'API). */
const SEARXNG_URL = (process.env.DOWZE_SEARXNG_INTERNAL_URL || 'http://searxng:8080').replace(
  /\/$/,
  '',
);

/** Recherche web via SearXNG (JSON). Renvoie les meilleurs résultats normalisés ; [] en cas d'échec. */
async function searchWeb(
  query: string,
): Promise<{ title: string; url: string; snippet: string }[]> {
  const u = new URL(`${SEARXNG_URL}/search`);
  u.searchParams.set('q', query);
  u.searchParams.set('format', 'json');
  u.searchParams.set('language', 'fr');
  u.searchParams.set('safesearch', '1');
  const res = await fetch(u, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`searxng ${res.status}`);
  const j = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string }[];
  };
  return (j.results ?? [])
    .filter((r) => r.title && r.url)
    .slice(0, 5)
    .map((r) => ({ title: r.title!, url: r.url!, snippet: (r.content ?? '').slice(0, 300) }));
}

/**
 * Construit la boîte à outils d'une abeille pour un profil donné. Les `execute` sont purs
 * (calcul / lecture) ; on lit les outils réellement appelés via `result.steps`, pas via un
 * effet de bord ici.
 */
export function buildAgentTools(deps: {
  copilote: CopiloteService;
  profileId: string;
  /** Si l'agent appartient à une organisation (open-space), fournit la recherche dans SA base de connaissances. */
  orgSearch?: (
    query: string,
  ) => Promise<{ id: string; title: string; content: string; citation: string; score: number }[]>;
  /** Bibliothèque universelle transverse aux sessions et canaux, déjà filtrée par le profil. */
  memorySearch?: (
    query: string,
  ) => Promise<{ kind: string; content: string; occurredAt: string }[]>;
  /** Sous-délégation bornée par le run courant ; absente hors contexte d'exécution Ruche. */
  delegate?: (objective: string) => Promise<{
    target: string;
    result: string;
    route: string[];
  }>;
  /** Dépose un contenu dans l'application virtuelle Mail ou Messages de l'utilisateur. */
  sendToApp?: (input: {
    canal: 'email' | 'messages';
    contenu: string;
    objet?: string;
  }) => Promise<{ envoye: true; canal: 'email' | 'messages'; contenu: string }>;
}): ToolSet {
  const { copilote, profileId, orgSearch, memorySearch, delegate, sendToApp } = deps;
  const tools: ToolSet = {
    calculatrice: tool({
      description:
        "Calcule le résultat exact d'une expression mathématique (+, -, *, /, %, ^, parenthèses ; fonctions sqrt, abs, ln, log, sin, cos, tan, exp, round, floor, ceil ; constantes pi, e). Utilise-le DÈS qu'un calcul est nécessaire — ne calcule jamais de tête.",
      parameters: z.object({
        expression: z
          .string()
          .max(200)
          .describe("L'expression à calculer, ex : « (3+4)*2 » ou « sqrt(2)^2 »."),
      }),
      execute: async ({ expression }) => {
        try {
          return { expression, resultat: evalExpression(expression) };
        } catch (e) {
          return { expression, erreur: (e as Error).message };
        }
      },
    }),
    date_heure: tool({
      description:
        "Donne la date et l'heure actuelles (fuseau de l'utilisateur, Europe/Zurich). Utilise-le pour toute question sur le jour, la date, l'heure, ou pour calculer une durée / une échéance.",
      parameters: z.object({}),
      execute: async () => {
        const now = new Date();
        const lisible = new Intl.DateTimeFormat('fr-CH', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: 'Europe/Zurich',
        }).format(now);
        return { iso: now.toISOString(), lisible };
      },
    }),
    chercher_connaissances: tool({
      description:
        "Cherche dans la base de connaissances de l'utilisateur (les compétences / notions déjà cartographiées) les éléments proches d'une requête. Utilise-le pour ANCRER ta réponse dans ce que l'utilisateur apprend, avant de répondre de mémoire.",
      parameters: z.object({
        requete: z.string().max(200).describe('Ce que tu cherches, en quelques mots.'),
      }),
      execute: async ({ requete }) => {
        const hits = await copilote.searchKnowledge(profileId, requete, 5).catch(() => []);
        if (!hits.length)
          return { resultats: [], note: 'Aucune connaissance indexée pour cette requête.' };
        return { resultats: hits };
      },
    }),
    recherche_web: tool({
      description:
        "Cherche sur le WEB (actualité, faits récents, chiffres à jour, infos que tu ne connais pas de façon fiable) et renvoie les meilleurs résultats (titre, extrait, lien). Utilise-le DÈS que la question porte sur quelque chose de récent, de factuel, de vérifiable, ou dont tu n'es pas certain — ne réponds jamais de mémoire sur l'actualité.",
      parameters: z.object({
        requete: z
          .string()
          .max(200)
          .describe(
            'La requête de recherche, en quelques mots (comme dans un moteur de recherche).',
          ),
      }),
      execute: async ({ requete }) => {
        const resultats = await searchWeb(requete).catch(() => []);
        if (!resultats.length) return { resultats: [], note: 'Aucun résultat web.' };
        return { resultats };
      },
    }),
  };
  if (sendToApp) {
    tools.envoyer_dans_application = tool({
      description:
        "Envoie réellement un contenu dans l'application virtuelle Mail ou Messages de l'utilisateur. Utilise TOUJOURS cet outil quand il demande « envoie-moi ça », « mets ça dans mes messages », « par mail » ou une formulation équivalente. Choisis email pour un courriel structuré avec objet, salutation et signature ; messages pour un texte bref et conversationnel. Ne dis jamais que tu ne peux pas envoyer.",
      parameters: z.object({
        canal: z.enum(['email', 'messages']),
        objet: z.string().max(160).optional(),
        contenu: z.string().min(1).max(5000),
      }),
      execute: sendToApp,
    });
  }
  if (delegate) {
    tools.deleguer_dans_la_ruche = tool({
      description:
        "Délègue UNE sous-tâche précise à une autre abeille quand son expertise apporte plus que le coût de coordination. N'utilise pas cet outil pour une tâche triviale ni pour contourner ton propre rôle. Le moteur impose profondeur, fan-out, budget total et anti-cycle.",
      parameters: z.object({
        objectif: z
          .string()
          .min(3)
          .max(1000)
          .describe('Le livrable précis attendu, avec le contexte utile.'),
      }),
      execute: async ({ objectif }) => delegate(objectif),
    });
  }
  if (memorySearch) {
    tools.chercher_memoire_ruche = tool({
      description:
        "Cherche dans la MÉMOIRE UNIVERSELLE de la Ruche : demandes, décisions, conversations, délégations et événements antérieurs, même issus d'un autre canal. Utilise-la quand l'utilisateur évoque un souvenir, une décision passée, une date, un projet ancien ou dit « je t'avais parlé de… ». Ne prétends jamais te souvenir sans la consulter.",
      parameters: z.object({
        requete: z
          .string()
          .max(300)
          .describe('Les indices disponibles, même vagues ou approximatifs.'),
      }),
      execute: async ({ requete }) => {
        const resultats = await memorySearch(requete).catch(() => []);
        return resultats.length
          ? { resultats }
          : { resultats: [], note: 'Aucun souvenir correspondant trouvé.' };
      },
    });
  }
  // Outil scopé à l'organisation : consulté AVANT de répondre pour tout ce qui touche au projet/à l'entreprise.
  if (orgSearch) {
    tools.chercher_connaissances_entreprise = tool({
      description:
        "Cherche dans la BASE DE CONNAISSANCES de TON organisation (les documents, faits, règles et décisions propres à cette entreprise/école/projet). Utilise-le EN PRIORITÉ pour toute question qui concerne le projet, les règles internes, les données ou l'historique de l'organisation — avant de répondre de mémoire ou de chercher sur le web.",
      parameters: z.object({
        requete: z
          .string()
          .max(200)
          .describe(
            'Ce que tu cherches dans les connaissances de l’organisation, en quelques mots.',
          ),
      }),
      execute: async ({ requete }) => {
        const resultats = await orgSearch(requete).catch(() => []);
        if (!resultats.length)
          return { resultats: [], note: 'Rien dans la base de l’organisation pour cette requête.' };
        return { resultats };
      },
    });
  }
  return tools;
}
