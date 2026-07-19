# Le Copilote Dowze — l'IA interne orchestratrice (par API)

> *Deux IA, deux rôles. **Ton IA** (ChatGPT / Claude, ton abonnement) **enseigne**. Une **petite IA
> interne à Dowze** (par API, peu chère) **orchestre** : elle écrit les prompts lisibles, lit le
> résumé de ta séance et le transforme en mémoire de suivi. **Tu ne vois jamais de `.json`.***
>
> *Principe inchangé — [l'app tient la structure, l'IA enseigne](02-cerveau-pedagogique.md) — mais on
> ajoute un **cerveau d'orchestration** qui rend l'expérience simple et humaine.*

---

## 1. Pourquoi ce changement (ce que le test réel a montré)

L'ancien [pont `.json`](10-pont-json.md) demandait à **l'IA de l'élève** de renvoyer un JSON strict
(enveloppe `{bridgeVersion, requestId, operation, payload}`). Testé **en conditions réelles** (Claude live) :

1. **Format** — une vraie IA renvoie le *contenu* (`{report:{…}}`), **pas** l'enveloppe technique → Dowze
   **rejette** (« expected "1", requestId Required… »). Le va-et-vient `.json` ne marche pas avec une IA réelle.
2. **Honnêteté** — sommée de « noter » sans séance réelle, une IA sérieuse **refuse** (« aucune observation,
   ce serait inventé »). Le bilan n'a de sens qu'**après** une vraie séance.
3. **UX** — coller des blocs `.json` est **incompréhensible** pour un élève.

**Conclusion : on ne demande plus de JSON à l'IA de l'élève.** Elle rend du **texte** (un résumé de séance
en langage naturel). C'est **le Copilote interne de Dowze** qui transforme ce texte en état structuré.

---

## 2. L'architecture : deux IA, un orchestrateur

```
                         ┌───────────────────────── DOWZE (l'app) ─────────────────────────┐
                         │  Source de vérité : graphe de compétences + état d'apprenant     │
                         │  (BKT, FSRS, carnet)  →  voir 02-cerveau-pedagogique             │
                         │                                                                  │
   ①  « Voici quoi faire »│  ┌─────────────── COPILOTE (IA interne, API) ───────────────┐   │
   prompt LISIBLE  ◄──────┼──┤ compose le prompt du jour (état → texte clair)           │   │
        │                 │  │ ingère le résumé de séance (texte → état structuré)      │   │
        ▼                 │  └──────────────────────────────────────────────────────────┘   │
┌──────────────────┐      │                      ▲  ⑤ recalcule BKT/FSRS + met à jour carnet │
│ TON IA (ChatGPT/  │      └──────────────────────┼───────────────────────────────────────────┘
│ Claude)           │  ② tu colles le prompt      │
│ = LE PROF         │─────► ③ tu apprends (mode   │  ④ tu colles le RÉSUMÉ (texte libre)
│ mode Étude,       │        Étude, flashcards,   │
│ flashcards, quiz, │        socratique…)         │
│ artifacts         │  « à la fin, résume où j'en suis » ─────────────────────────────────────┘
└──────────────────┘
```

- **Le Copilote n'enseigne pas.** Il fait **2 tâches utilitaires** : (a) écrire le bon prompt, (b) lire le
  résumé de séance et en extraire des **faits typés**. C'est une tâche de *rédaction + extraction*, pas de
  raisonnement lourd → un **petit modèle pas cher** suffit.
- **Dowze reste la mémoire et la vérité.** Le Copilote **propose** un état extrait ; l'app **valide, recalcule
  la maîtrise elle-même** (ne fait jamais confiance à un score inventé par un LLM) et archive le résumé brut.

---

## 3. Le modèle du Copilote (recherche 2025-2026)

Rôle = générer du français lisible + extraire du JSON conforme à un schéma. Le critère décisif n'est pas la
puissance mais : **structured outputs fiables + français + prix bas + latence**.

| Modèle | Prix in/out (/M tok) | Contexte | JSON schéma strict | Adéquation |
|---|---|---|---|---|
| **GPT-4o-mini** (défaut reco) | $0.15 / $0.60 | 128k | **Natif (0 invalide)** | ★★★★★ |
| **Gemini 2.5 Flash-Lite** | $0.10 / $0.40 | ~1M | `responseSchema` (>95 %) | ★★★★★ (le moins cher) |
| **Mistral Small 3.2** | $0.10 / $0.30 | 128k | JSON valide (pas strict) | ★★★★ (FR natif, **RGPD/UE**) |
| DeepSeek V3/V4-flash | ~$0.14 / $0.28 | 128k | JSON valide | ★★★ (API en Chine → RGPD) |
| Claude Haiku 4.5 | $1 / $5 | 200k | strict | ★★★ (5-10× trop cher ici) |

**Choix produit : le Copilote est multi-fournisseurs (l'élève choisit son modèle).** On ne verrouille pas un
seul modèle : on expose un **catalogue** de modèles (OpenAI, Anthropic, Google, Mistral, DeepSeek, +
d'autres) et l'élève/l'app sélectionne. Techniquement c'est **une seule abstraction** — le **Vercel AI SDK**
(`generateObject` + Zod) parle à tous les fournisseurs via un provider commun ; on ne réécrit rien par modèle.

**Catalogue au lancement** (chacun activable/désactivable, prix affiché en « crédits ») :

| Fournisseur | Modèle | Prix in/out (/M) | JSON | Note |
|---|---|---|---|---|
| OpenAI | **GPT-4o-mini** (défaut reco) | $0.15 / $0.60 | strict natif | valeur sûre, 0 invalide |
| Google | **Gemini 2.5 Flash-Lite** | $0.10 / $0.40 | `responseSchema` | le moins cher, ~1M ctx |
| Mistral | **Mistral Small 3.2** | $0.10 / $0.30 | JSON valide | FR natif, **UE/RGPD** |
| DeepSeek | **DeepSeek V3** | ~$0.14 / $0.28 | JSON valide | très bon marché (API en Chine → RGPD) |
| Anthropic | **Claude Haiku 4.5** | $1 / $5 | strict | premium, qualité rédaction |

- **Défaut** : GPT-4o-mini en **Structured Outputs (`strict:true`)** — schéma garanti, répare le bug de format.
- **Filet commun** pour les modèles à JSON non-strict (Mistral/DeepSeek) : `jsonrepair → Zod → 1 retry`
  (réinjecte l'erreur). Appliqué uniformément via le SDK.
- **Registre de modèles en base** (`ai_model` : provider, model_id, prix, actif, strict?) → ajouter un modèle
  = une ligne, sans redéploiement.
- **Phase 2 confidentialité** : auto-héberger (Ollama : Qwen/Mistral) avec **Outlines/XGrammar** (~100 % JSON).

**Coût par séance** (~6k tokens in + 3k out) : **≈ 0,15 à 0,27 centime**. 100 000 séances/mois ≈ **$150-300**,
encore divisible par le *prompt caching*. → Un système de **crédits prépayés** rend ça soutenable (§7).

**Implémentation** : un seul schéma **Zod** par tâche = source unique, exposé à l'IA via **Vercel AI SDK
`generateObject`** et réutilisé pour les DTO NestJS (`nestjs-zod`).

---

## 4. La nouvelle boucle (côté élève : simple et humaine)

1. **« Aujourd'hui »** — Dowze affiche : *« Séance du jour : Comparer des quantités. »* Bouton **« Démarrer ma
   séance »** → le Copilote compose un **prompt lisible** (pas de JSON) et l'élève le **copie**.
2. **Il le colle dans son IA** (ChatGPT/Claude). Le prompt **active le mode Étude**, pose le cadre socratique,
   demande flashcards/quiz si utile, et se termine par : *« Quand j'ai fini, écris-moi un court **résumé de
   séance** : ce qu'on a vu, ce que j'ai réussi, ce qui bloque, la prochaine étape. »*
3. **Il apprend** — vrai cours, à son rythme, avec les outils de son IA.
4. **Clôture** — l'élève **copie le résumé** (texte libre) que son IA a écrit et le **colle dans Dowze**
   (« Coller mon résumé de séance »). Aucun format à respecter.
5. **Dowze absorbe** — le Copilote extrait un **snapshot structuré** (§5) ; l'app **recalcule BKT/FSRS**,
   met à jour le **carnet**, planifie les révisions. Le lendemain, le prompt du jour contient **tout le
   contexte** (là où on s'est arrêté + révisions dues) → *reprendre exactement où on en était*, comme un
   vrai prof.

> **Deux copier-coller par séance, en texte clair.** C'est le prix du « sans API côté prof » — et c'est
> intuitif. Le structuré est invisible, géré par le Copilote.

---

## 5. Les deux schémas (internes, jamais montrés à l'élève)

### a) L'état d'apprenant (la mémoire, source de vérité — dans Postgres)
Trois granularités, la **compétence (KC)** au centre :
- **Profil stable** : objectifs, préférences, affect de base.
- **État par KC** : `p_known` (BKT), `status` (`locked|ready|in_progress|mastered`), `evidence`
  (essais/réussites/streak), **`typical_errors`** (erreurs *typées* : code + remédiation), **`affect`**
  ∈[0,1] lissé (EMA), bloc **`srs`** (algo, stability, difficulty, due, lapses), `next_step`.
- **Trace de séance** append-only = déjà le rôle de `carnet_entries`.

### b) Le snapshot de séance (ce que le Copilote extrait du résumé texte)
Schéma **strict** rempli par le Copilote (pas par l'IA de l'élève) :
```jsonc
{
  "kc_touched": [
    { "skillId": "…", "outcome": "maitrise|progres|bloque",
      "evidence": "cite un fait observable de la séance",   // interdiction d'inventer
      "errors": ["code-erreur"], "confidence": 0.0 }
  ],
  "affect": "positif|neutre|frustre",
  "covered": ["…"], "not_covered_planned": ["…"],
  "blockers": ["…"], "next_step": "…", "open_questions": ["…"],
  "uncertainty": "ce que le résumé ne permet pas de conclure (null autorisé)"
}
```
**Règles d'or** :
- Le Copilote **extrait des faits**, il ne **note pas** : c'est **Dowze qui recalcule `p_known` (BKT)** à
  partir de l'`evidence`. On ne fait jamais confiance à un score sorti d'un LLM.
- **`uncertainty` obligatoire** — si le résumé ne dit rien d'une KC, on ne conclut pas (anti-hallucination).
- On **archive le résumé brut** (auditable) + le snapshot structuré.

---

## 6. Mémoire & continuité (recherche sciences de l'apprentissage)

- **BKT** = maîtrise *intra-séance* (« avancer ? », seuil 0,95). **FSRS** = calendrier *inter-séances*
  (« quand réviser ? »). Une KC `acquise` entre en file **FSRS** ; un `lapse` la rouvre en BKT.
- **SM-2 → FSRS** : garder SM-2 en cold-start/repli, **migrer vers FSRS** (`ts-fsrs`) dès qu'il y a de
  l'historique — **−20 à −30 % de révisions** à rétention égale (défaut Anki depuis 2023). Voir
  [02 §6](02-cerveau-pedagogique.md#6-la-révision-espacée-contre-loubli).
- **Ne jamais ré-résumer un résumé** (dérive sémantique) : le prompt de reprise est **régénéré
  déterministiquement depuis l'état structuré**, jamais depuis le texte du prompt précédent.
- **Pédagogie de la reprise** : commencer par un **rappel actif** (testing effect) + **feedback immédiat**,
  **intercaler** 1-2 KC anciennes **dues** (interleaving). Info critique en **tête et pied** du prompt
  (biais de position + hallucinations concentrées en fin de génération).
- **Budget contexte** : n'injecter que les KC **actives + dues** et le cours du jour, pas tout l'historique.

---

## 7. Exploiter les modes éducation de l'IA de l'élève

Le prompt composé par le Copilote doit **activer et exploiter** ce que l'abonnement de l'élève offre déjà :
- **ChatGPT Study Mode** (« Étudier », 2025, tous plans dont Plus) : tuteur socratique, **flashcards
  (export CSV Anki/Quizlet)**, quiz, plans de révision espacée. + **Canvas**.
- **Claude — style « Learning »** (tous, dont Pro) : socratique ; **Artifacts** = flashcards/quiz
  **interactifs jouables** sans code.
- **Déclenchement fiable par texte** : (a) phrase d'activation du mode, (b) règle *« interroge-moi une
  question à la fois, ne donne pas la réponse »*, (c) demande d'outil précis (flashcards/quiz/artifact).
- **Limites assumées** (donc Dowze tient la mémoire) : le « mode Étude » ne s'active pas toujours par texte
  seul, peut être coupé, et la **mémoire inter-sessions de l'IA est faible**. Ce qui marche sûrement par
  copier-coller : génération de flashcards/quiz/plans + artifacts.

---

## 8. Économie : crédits prépayés (recharge)

**Les deux modes cohabitent** (choix de l'élève) :

**A. Crédits prépayés** (défaut, « recharger avec de l'argent ») — Dowze fournit l'IA :
- **Ledger applicatif maison** (Postgres/Supabase) : table `credit_ledger` append-only + vue
  `user_balances`. **Stripe** seulement pour **encaisser** (Checkout/Payment Intent + **webhook idempotent**
  sur l'`event.id`).
- **Décrément atomique AVANT l'appel LLM** (`UPDATE … WHERE balance >= cost RETURNING`) → anti double-dépense
  et **garde-fou anti-runaway** ; **réconciliation après** avec les tokens réels (`usage` du provider).
- Abstraire le token en **« crédit Dowze »** pour absorber la volatilité des prix et piloter la marge
  (cible ~70 % brut). Rejet à solde 0 ; plafonds req/min et tokens/req.
- Solde en direct : `GET /me/balance` + Supabase Realtime.

**B. BYOK — l'élève fournit sa propre clé** (gratuit pour Dowze) :
- L'élève colle **sa clé API** (OpenAI/Google/Mistral/…) dans ses réglages ; elle est **chiffrée au repos**
  (jamais en clair, jamais loggée) et n'est utilisée que pour **ses** appels.
- **Pas de décrément de crédits** en BYOK (il paie son fournisseur directement). Le catalogue reste le même.
- Sert la marge SaaS prévisible **et** une voie « gratuite » cohérente avec l'esprit commun de Dowze.

**Commun aux deux** : **rate-limiting** `@nestjs/throttler` (clé `user_id`) + Cloudflare (Supabase n'a pas de
rate-limit natif) ; plafond tokens/req ; le modèle choisi vient du **catalogue `ai_model`**.

**Coût réel** : à ~0,2 centime/séance, **5 € de crédit ≈ 2 000+ séances**. Trivial pour l'élève, soutenable
pour l'app.

---

## 9. Tension avec la philosophie « bien commun gratuit »

La doc fondatrice décrit Dowze comme un **commun gratuit, sans clé**. Une IA interne à tokens payants
**introduit un coût** (quelqu'un paie) et fait **transiter** le résumé de séance par un fournisseur.
Positionnement honnête :
- **Le cœur reste gratuit** : le graphe, le suivi, le carnet, la validation par les pairs, et le **mode
  BYO-AI** (l'élève apprend avec son propre abonnement — déjà le cas).
- Le **Copilote est un confort payant** (recharge) OU **gratuit en BYOK** (l'élève fournit sa clé API).
- On **n'externalise jamais l'état pédagogique** : la mémoire canonique reste dans Dowze (portable,
  auditable, multi-IA).

---

## 10. Ce que ça remplace / migration

- **Remplace** le [pont `.json`](10-pont-json.md) **côté élève** : plus de JSON à coller ; l'élève colle du
  **texte** (le prompt d'un côté, son résumé de l'autre). Le schéma `rapport-seance` **devient interne**
  (le Copilote le remplit, pas l'IA de l'élève).
- **Garde** le pont `.json` en **outil d'auteur** (générer/valider une ossature de compétences), non exposé
  à l'élève.
- **Réutilise** l'existant : `carnet_entries`, BKT (`packages/core`), le séquencement outer-fringe, la
  validation par paliers. On **ajoute** : le service Copilote (API LLM + Zod + crédits) et FSRS.

**Suite** : [prompts & continuité](03-prompts-et-continuite.md) · [le cerveau pédagogique](02-cerveau-pedagogique.md)
· [le pont `.json` (révisé)](10-pont-json.md) · [stack & conformité](06-stack-et-conformite.md).

**Sources** (recherche détaillée) : voir le dépôt d'infrastructure `04-recherche/dowze/` (LLM orchestrateur,
modes éducation IA, mémoire & continuité, structured outputs & crédits) — chaque affirmation y est sourcée.
