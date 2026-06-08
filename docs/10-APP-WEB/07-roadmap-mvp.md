# Roadmap de l'application

> *Par quoi commencer, quoi différer. Principe : **prouver d'abord, étendre ensuite** — fonctionner à
> 1 utilisateur, ajouter la complexité seulement quand elle est justifiée.*

---

## Le MVP minimal (ce qui doit exister au lancement)

L'objectif : **un élève seul, avec son abonnement IA, apprend réellement** — sur un seul domaine.

| # | Brique | Détail | Réf. |
|---|--------|--------|------|
| 1 | **Compte + profil** | Auth Supabase, objectif, IA choisie | [06](06-stack-et-conformite.md) |
| 2 | **Carte d'UN domaine** | DAG en SQL, amorcé sur un référentiel (ESCO/curriculum) | [02 §1](02-cerveau-pedagogique.md) |
| 3 | **Diagnostic initial** | CAT structurel (~15-30 questions) | [02 §7](02-cerveau-pedagogique.md) |
| 4 | **Suivi de maîtrise** | BKT 4 paramètres, seuil 0,95 | [02 §2](02-cerveau-pedagogique.md) |
| 5 | **Séquencement** | Outer fringe (le prochain pas) | [02 §3](02-cerveau-pedagogique.md) |
| 6 | **Pont `.json`** | `.json` aller (prompt+schéma+exemple) → import/validation (Ajv, jsonrepair) | [10](10-pont-json.md) |
| 7 | **Carnet de bord** | Mémoire reconstituée depuis les `.json` retour | [03](03-prompts-et-continuite.md) |
| 8 | **Tableau de bord + parcours** | Un seul prochain pas, paliers de maîtrise | [04](04-produit-ux.md) |
| 9 | **Validation par paliers** | Auto-validation (débloque) + file de validation par les pairs | [09](09-validation.md) |
| 10 | **Révision espacée** | SM-2 | [02 §6](02-cerveau-pedagogique.md) |

**Pont** : fichiers `.json` à la main (zéro API, zéro coût). **Public** : adultes d'abord. **Communauté** :
aucune requise au départ — l'auto-validation débloque, la validation par les pairs vient avec la communauté
([05](05-systeme-communautaire/)). **Aucun QCM** (grilles uniquement).

---

## Ce qu'on diffère volontairement

| Différé | Pourquoi |
|---------|----------|
| Intégration **API** | **Écartée par conception** — le pont reste le fichier `.json` (zéro API, zéro clé) |
| **Deep Knowledge Tracing**, IRT, FSRS | Sur-ingénierie ; BKT + SM-2 + CAT structurel suffisent |
| **Communauté riche** (forums, guildes) | Émergente ; commencer par le binôme quand n ≥ 2 |
| **Ouverture aux mineurs** | Exige le dispositif de sûreté complet |
| **Multidomaine, multilingue** | Après preuve sur un domaine |
| **Passeport vérifiable** (VC/Open Badges) | Vient avec la reconnaissance ([couche 5](../03-ARCHITECTURE/05-preuve-passeport.md)) |

---

## Les phases (alignées sur la feuille de route du projet)

Cohérent avec la [feuille de route générale](../08-MISE-EN-OEUVRE/01-feuille-de-route.md) :

- **Phase A — MVP (1 domaine, adultes, pont `.json`).** Prouver qu'un élève apprend réellement. Mesurer la
  maîtrise durable et la persévérance.
- **Phase B — Continuité & rétention.** Affiner le carnet de bord, la révision espacée, le planning ;
  introduire le **binôme de redevabilité** dès qu'il y a quelques élèves.
- **Phase C — Communauté & multidomaine.** Validation par les pairs à pleine échelle, mentorat « qui
  maîtrise enseigne », guildes par domaine ; ouvrir d'autres domaines/langues.
- **Phase D — Preuve.** Passeport vérifiable (Open Badges / VC) ; ouverture aux mineurs avec sûreté
  complète. *(Toujours pas d'API : le pont reste le `.json`.)*

> Chaque phase est conditionnée à la **preuve** de la précédente (culture RCT —
> [métriques](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md)), pas à un calendrier.

---

## Le « moat » à construire dès le départ

Ne pas être « un wrapper de plus » (risque d'absorption par l'IA de base — leçon Jasper). La défensibilité
se construit dès le MVP :

1. **L'état pédagogique accumulé** par élève (carte, maîtrise, progression, carnet) — la donnée, pas le
   prompt.
2. **L'orchestration** (séquencement, planning, révision) qu'aucun chat brut ne fournit.
3. **La portabilité multi-IA** (l'élève garde son IA ; on ne dépend d'aucun fournisseur).
4. **Plus tard, la communauté et les preuves** (effets de réseau + reconnaissance du Passeport).

---

## Les risques produit (rappel)

| Risque | Parade |
|--------|--------|
| Friction du va-et-vient `.json` | UX soignée (copier/télécharger, glisser-déposer, validation au collage) ; **pas** d'API |
| Triche sur le `.json` | Le `.json` ne porte qu'une auto-validation ; preuve forte = **pairs** ([09](09-validation.md)) |
| Dérive de l'état | `.json` retour obligatoire, validé par schéma (Ajv) à l'import |
| Dépendance fournisseur IA | Multi-IA, état canonique chez nous |
| Absorption par l'IA de base | Moat = données + orchestration + communauté |
| Communauté vide | L'IA comme communauté de 1 ; jamais afficher du vide ; seeding de contenu (pas de faux comptes) |
| Sécurité mineurs | Adultes d'abord, puis dispositif complet |

---

## En une phrase

> **MVP = un élève + son IA apprennent réellement sur un domaine ; l'app tient la carte, le niveau et la
> mémoire, reliée à l'IA par un simple fichier `.json` (pas d'API). Le reste (communauté, validation par
> les pairs, mineurs, multidomaine, preuve) s'ajoute par la preuve, pas par ambition.**
