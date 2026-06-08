# Stack technique & conformité

> *La pile la plus simple et la plus robuste pour construire le MVP par un petit projet, et les obligations
> de conformité — surtout pour les mineurs.*

---

## La stack recommandée (MVP solo)

**Next.js (React) + Supabase (PostgreSQL + Auth) + Vercel.** C'est le consensus 2025-2026 pour un MVP
full-stack rapide.

| Couche | Choix MVP | Pourquoi |
|--------|-----------|----------|
| Front + back | **Next.js (React)** sur **Vercel** | Full-stack, déploiement trivial, large écosystème |
| Base de données | **PostgreSQL** (via Supabase) | Données **fortement relationnelles** (compte, carte, progression, planning) |
| Auth & comptes | **Supabase Auth** | Intégré, gratuit, sur Postgres |
| Stockage / temps réel | Supabase Storage / Realtime | Selon besoin |

### Pourquoi relationnel et pas graphe
Malgré le « graphe de compétences », un **DAG se modélise parfaitement en SQL** (tables `skill` +
`prerequisite`, requêtes récursives `WITH RECURSIVE`). Une base graphe (Neo4j) n'est justifiée que pour du
parcours multi-sauts intensif — **sur-ingénierie au MVP**. Voir
[cerveau pédagogique](02-cerveau-pedagogique.md#1-la-carte-de-compétences-graphe-de-prérequis).

### Alternatives (et pourquoi on ne les retient pas au MVP)
- **Firebase** : bon pour le temps réel/mobile, mais NoSQL rend les requêtes relationnelles (parcours,
  prérequis) pénibles, et la facturation à l'usage peut surprendre.
- **No-code (Bubble…)** : le plus rapide pour *valider l'idée*, mais lock-in et plafond de complexité — la
  logique de parcours + prompts deviendra vite trop riche. Bon pour prototyper, pas pour le produit final.

---

## PWA, mobile & hors-ligne

- **Oui, une PWA** (Progressive Web App) : installable, mobile-first, moins chère qu'une app native, idéale
  pour l'éducation. Cohérent avec l'[offline-first du projet](../05-TECHNIQUE/05-offline-first.md).
- **Au MVP** : PWA installable + **responsive mobile-first** + **cache en lecture** (carte, parcours,
  bibliothèque de prompts, carnet consultables hors-ligne).
- **En V2** : synchronisation d'écriture hors-ligne (saisir une autoéval sans réseau).
- ⚠️ **iOS/Safari** est le maillon faible des PWA (notifications, installation, stockage limités) — tester
  tôt.
- Note : les **appels à l'IA externe nécessitent le réseau** par nature → prévoir un état « hors-ligne »
  gracieux (l'élève peut consulter et réviser, mais le « cours » live demande la connexion).

---

## Conformité — RGPD & mineurs (à ne pas improviser)

C'est le point le plus sérieux. Les seuils d'âge des fournisseurs (13/16 ans) concernent **leur** service ;
pour **vos** utilisateurs, **c'est vous le responsable de traitement**.

| Obligation | Détail |
|------------|--------|
| **Base légale & consentement** | RGPD : consentement parental requis pour les mineurs (13-16 ans selon l'État membre ; Suisse : nLPD). COPPA (US) : < 13 ans, consentement parental vérifiable. |
| **Résidence des données** | Choisir **explicitement** une région **UE/Suisse** chez Supabase/Vercel (ce n'est pas automatique). |
| **DPA signé** | Accord de traitement avec chaque sous-traitant (Supabase, Vercel… proposent un DPA). |
| **Minimisation** | Ne stocker que le nécessaire (niveau, parcours, autoéval). Pas de données superflues. |
| **Droits** | Accès, rectification, **effacement**, portabilité (cohérent avec « données possédées par l'apprenant », [principe 11](../00-FONDATIONS/03-principes-fondateurs.md)). |
| **Pas d'entraînement LLM sur données élèves** | Surtout pour mineurs (modèle Khanmigo). |
| **AI Act** | Éducation = usage « à haut risque » → supervision humaine, transparence, robustesse. |

Référence complète : [juridique & conformité](../06-GOUVERNANCE-ECONOMIE/03-juridique-conformite.md).

> 💡 **Décision MVP** : pour **éviter** la lourdeur du consentement parental au lancement, **cibler les
> adultes d'abord**. Ouvrir aux mineurs ensuite, avec le dispositif complet (région UE + DPA + consentement
> parental + modération + notification adulte). C'est aussi la recommandation du
> [système communautaire](05-systeme-communautaire.md#7-sûreté--modération).

---

## Sécurité technique

- **Pont `.json`, pas d'API** : aucune clé IA stockée, aucune connexion à un fournisseur → surface
  d'attaque minimale. Avantage de sécurité et de vie privée réel.
- **Import du `.json` retour** : valider strictement le schéma (Ajv, `additionalProperties:false`), réparer
  (`jsonrepair`) mais **ne jamais exécuter** le contenu ; vérifier types/bornes ; signer les payloads émis
  par l'intra (HMAC, secret **côté serveur**). Détail : [pont `.json`](10-pont-json.md).
- **Injection de prompt** : filtrer tout contenu élève réinjecté dans un template.

---

## Récapitulatif des choix

| Sujet | MVP | Différé (V2+) |
|-------|-----|---------------|
| Stack | Next.js + Supabase + Vercel | — |
| BDD | PostgreSQL (relationnel) | base graphe si besoin réel |
| Lien intra ↔ IA | **pont `.json`** à la main (zéro API, zéro clé) | — (l'API reste écartée) |
| Validation | auto-validation + file de pairs (Ajv pour l'import) | endossement expert |
| Mobile | PWA installable + cache lecture | sync offline en écriture |
| Public | adultes d'abord | mineurs (dispositif complet) |
| Données | région UE, minimisation, DPA | — |

**Suite** : [roadmap MVP](07-roadmap-mvp.md).
