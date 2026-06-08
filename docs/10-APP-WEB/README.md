# 10 · APPLICATION WEB

> *De la méthode au **produit**. Comment construire l'école Dowze comme une **application web** : un portail
> où l'élève a un compte, voit son niveau, ce qu'il doit faire, reçoit les prompts à donner à son IA, son
> planning, et fait son autoévaluation — pendant que l'IA qu'il a choisie (Claude, ChatGPT…) fait la
> conversation d'enseignement.*

Ce dossier est **fondé sur 4 recherches** dédiées (architecture BYO-AI, cerveau pédagogique, produit/UX/stack,
système communautaire). Sources : [bibliographie](../09-ANNEXES/01-bibliographie.md).

| Fichier | Contenu |
|---------|---------|
| [01-vision-produit.md](01-vision-produit.md) | Le modèle « BYO-AI » : l'app orchestre, l'IA externe enseigne. Le pont est un fichier `.json` (pas d'API). |
| [02-cerveau-pedagogique.md](02-cerveau-pedagogique.md) | Le structuré : graphe de compétences, suivi de maîtrise (BKT), séquencement, révision espacée, évaluation. |
| [03-prompts-et-continuite.md](03-prompts-et-continuite.md) | La bibliothèque de prompts contextualisés + le carnet de bord (état entre sessions). |
| [04-produit-ux.md](04-produit-ux.md) | Parcours, tableau de bord, onboarding, gamification saine. |
| [05-systeme-communautaire/](05-systeme-communautaire/) | **Le système communautaire complet** (sous-dossier) : fonctionnalités, mécaniques d'engagement, implémentation technique, sûreté & démarrage. |
| [06-stack-et-conformite.md](06-stack-et-conformite.md) | Stack technique (Next.js + Supabase), auth, RGPD/mineurs, PWA. |
| [07-roadmap-mvp.md](07-roadmap-mvp.md) | Par quoi commencer, quoi différer, le « moat ». |
| [08-parcours-eleve.md](08-parcours-eleve.md) | **« Je m'inscris, je fais quoi ? »** Le parcours concret d'un nouvel élève — placé sur le tronc commun prescrit, pas de choix. |
| [09-validation.md](09-validation.md) | **La validation sans QCM** : auto-validation (débloque) → validation par les pairs (forte, en file, non-bloquante), modèle École 42. |
| [10-pont-json.md](10-pont-json.md) | **Le pont `.json`** entre l'intra et l'IA (sans API) : `.json` aller (prompt+format+exemple) → `.json` retour validé. |
| [11-planning-regularite.md](11-planning-regularite.md) | **Planning + présence/absence + minuteur & sonnerie** : tenir un rythme sainement (généré, bienveillant, jamais punitif). |
| [12-stack-production.md](12-stack-production.md) | **La stack de production** (vue d'ensemble) : choix, principes, Supabase local-first, maintenabilité. |
| [13-frontend.md](13-frontend.md) | **Frontend** : Next.js + Tailwind + shadcn, design system `getdesign notion`, UI/UX épurée, a11y, perf, PWA. |
| [14-backend.md](14-backend.md) | **Backend** : NestJS modulaire sur Supabase, Drizzle, validation `.json`, Redis/BullMQ, Realtime, sécurité, fichiers courts. |

---

## L'idée d'architecture, en une phrase

> **L'application est une *machine à états* + un *générateur de prompts*. Sa base de données EST la mémoire.
> L'IA externe n'est qu'un exécuteur sans état, jetable et interchangeable.**

Conséquences directes (toutes étayées par la recherche) :

1. **L'élève garde SON abonnement IA** (modèle « BYO-AI » / Bring Your Own AI). Le coût LLM pour la
   plateforme tend vers **zéro**. C'est exactement la promesse « il suffit d'un abonnement IA ».
2. **Le structuré vit dans l'app, pas dans l'IA.** Un LLM seul invente des programmes incohérents (avec
   trous et hallucinations) ; donc la **carte des compétences, le niveau, la progression** sont des données
   de l'app. L'IA *enseigne sur cette carte*, elle ne la dessine pas. (C'est la
   [condition n°1](../08-MISE-EN-OEUVRE/05-demarrer-aujourdhui.md) déjà posée.)
3. **Le vrai « moat » (avantage défendable) est l'état pédagogique accumulé** par élève — pas le prompt. Un
   produit dont la seule valeur est le prompt se fait absorber par l'IA de base (leçon **Jasper** : revenu
   ~120 M$ en 2023 → ~35-55 M$ en 2024 quand ChatGPT s'est amélioré). La valeur de Dowze = le suivi
   structuré + l'orchestration + (plus tard) la communauté.

---

## Philosophie de construction (MVP)

- **Commencer simple** : le **pont `.json`** (zéro API, zéro coût, marche avec ChatGPT Plus / Claude Pro).
- **Différer la complexité** : Deep Knowledge Tracing, FSRS, IRT, communauté riche → plus tard. **(Pas
  d'API : ce n'est pas une évolution prévue — le pont reste le fichier `.json`.)**
- **Prouver, puis étendre** (cohérent avec la [culture RCT du projet](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md)).
- **Fonctionner à 1 utilisateur** : l'app doit être utile **seul avec l'IA**, sans communauté (voir
  [05-systeme-communautaire.md](05-systeme-communautaire.md)).

> ⚠️ Honnêteté (comme dans toute la doc) : l'économie des « wrappers » d'IA est brutale (beaucoup échouent).
> Ce qui protège Dowze n'est pas d'être un wrapper de plus, mais d'être **un système pédagogique structuré**
> (données d'état, carte, communauté) qui se trouve *utiliser* une IA externe — et de rester **portable
> multi-IA** pour ne dépendre d'aucun fournisseur.
