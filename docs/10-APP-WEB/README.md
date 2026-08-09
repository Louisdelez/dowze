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
| [15-copilote-orchestrateur.md](15-copilote-orchestrateur.md) | ⭐ **RÉVISION 2026 — l'IA interne « Copilote »** (par API, à crédits) : compose les prompts lisibles et transforme le résumé de séance (texte) en état structuré. Supprime le `.json` côté élève. Modèle, schémas, FSRS, crédits prépayés. **À lire avec [10-pont-json](10-pont-json.md).** |
| [16-architecture-etat-memoire.md](16-architecture-etat-memoire.md) | **L'état & la mémoire** : ce que Dowze est vraiment (RAG/agents/mémoire fait proprement) — graphe, maîtrise (BKT), mémoire des confusions (Mem0-style), révision espacée (FSRS), dédup sémantique par embeddings. |
| [17-seance-et-minuteur.md](17-seance-et-minuteur.md) | **La séance de 45 min & le minuteur** : pourquoi 45 min (science), déroulé minuté (barre du haut + alarme → bilan → pause), non-punitif, adaptation à l'âge. |
| [18-tests-et-examens.md](18-tests-et-examens.md) | **Tests, examens & modules d'exercices** : se tester pour apprendre (effet-test), **formatif ≠ certifiant**, modules (QCM 3 options, cloze, flashcards…), test hebdo cumulatif + examen trimestriel, garde-fous IA. |
| [19-onboarding-profil-placement.md](19-onboarding-profil-placement.md) | **Onboarding** : inscription minimale, profil (photo/pseudo/**date de naissance** — plus de case « mineur »), présentation → **dossier élève** par l'IA (anti-invention), **test de placement** adaptatif, RGPD/mineurs. |
| [20-expeditions.md](20-expeditions.md) | **Les Expéditions** : apprentissage par projet (*Gold Standard PBL*), 5 phases (Étincelle→Question→Défi→Acte→Trace) guidées par l'IA, **3 expéditions prescrites** puis choix libre, évaluation authentique (rubrique + Trace + **pairs**), 7 règles du guidage IA. |
| [21-seance-vs-expeditions.md](21-seance-vs-expeditions.md) | **« Ma séance » vs « Expéditions »** : deux modes complémentaires — muscler une compétence (séance) vs relier/appliquer/créer (projet). |
| [22-resultats-bulletin.md](22-resultats-bulletin.md) | **« Mes résultats » (bulletin sans note)** : maîtrise par palier (4 niveaux nommés) + croissance + prochaine étape, côté **élève ET parent** ; « Pronote sain » (pas de moyenne/rang/rouge). |
| [23-ia-de-dowze-le-moteur.md](23-ia-de-dowze-le-moteur.md) | ⭐ **LE RÉCIT CENTRAL — l'IA de Dowze, le moteur** : ITS moderne *AI-native* / **RAG structuré (GraphRAG)** sur le graphe. Les **deux IA**, l'indispensabilité, l'ancrage anti-dévaluation, les garde-fous (existants **et manquants**), le coût réel. **À lire en premier.** |
| [24-progression-rangs-saut-specialisation.md](24-progression-rangs-saut-specialisation.md) | **Progression compétitive** : barre de rangs (Fer→Dowzer Suprême), RR (examens trimestriels + tests hebdo + niveau requis + accord parental), **Saut de Rang** (piscine intensive 28 j, seuil 80 %), moteur de spécialisation. |
| [25-niveau-xp.md](25-niveau-xp.md) | **Niveau & XP** (façon jeu vidéo, distinct du rang) : courbe quadratique, sources d'XP (login/temps/tests/validations), cap quotidien, personnel et monotone (pas de classement). |
| [26-social-classes-moderation-traduction.md](26-social-classes-moderation-traduction.md) | **ÉCHANGER** : amis, MP, groupes, **Ma Classe** (classes assignées niveau>langue>âge), **traduction temps réel** (cache communautaire, LowCost, bandeau), **modération** stricte non-punitive. ⚠ 2 exigences redessinées pour rester légales (immuabilité, flag public). |
| [30-cours-natif-feuille-modules.md](30-cours-natif-feuille-modules.md) | ⭐ **Le cours NATIF Dowze (nouveau défaut)** : l'IA de Dowze (Copilote + RAG + agents École) **donne** le cours en app, en **feuille A4 de modules** pédagogiques réutilisables (fiche, exemple résolu, QCM à distracteurs=misconceptions, exercices…). Fondé sur Rosenshine + GRR + 6 stratégies. L'ancien « prompt à copier dans ChatGPT/Claude » devient un **mode manuel masqué**. Audit : ~80 % de briques existantes (`generateStructured`, `compose`, `applyProgress`, `ExerciseCard`, `runProject`). |

---

## L'idée d'architecture, en une phrase

> ⭐ **RÉVISION 2026.** **L'application est une *machine à états* + un *générateur de prompts* qui pilote
> désormais SA PROPRE IA interne (le Copilote), indispensable.** Sa base de données EST la mémoire. L'IA
> **de tutorat** (externe) reste un exécuteur sans état, jetable ; l'IA **de Dowze** (interne) est le
> **moteur**. Récit complet : **[23-ia-de-dowze-le-moteur](23-ia-de-dowze-le-moteur.md)**.

Conséquences directes (toutes étayées par la recherche) :

1. **L'élève garde SON abonnement IA pour le TUTORAT** (BYO-AI, pour la conversation). Mais **le Copilote
   interne a un coût réel** (~0,2 ct/séance, crédits **ou** BYOK) — le « coût LLM ≈ zéro » n'est **plus
   vrai** ; seul le **cœur** (graphe, suivi, carnet, validation par les pairs) reste gratuit.
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

- **Commencer simple** : l'élève apprend avec **son propre abonnement** IA (BYO-AI), zéro coût de sa leçon.
- **RÉVISION 2026 (voir [15-copilote-orchestrateur](15-copilote-orchestrateur.md))** : le va-et-vient `.json`
  **côté élève** a échoué au test réel (une vraie IA rend du contenu, pas l'enveloppe, et refuse d'inventer
  une note). On ajoute une **petite IA interne à Dowze** (« Copilote », par API, à crédits prépayés) qui
  compose les prompts lisibles et **structure le résumé de séance en texte libre**. Le `.json` devient
  **interne** (jamais montré à l'élève). Le cœur (graphe, suivi, carnet, BYO-AI) reste gratuit.
- **Différer la complexité** : Deep Knowledge Tracing, IRT, communauté riche → plus tard. Migration
  **SM-2 → FSRS** dès qu'il y a de l'historique.
- **Prouver, puis étendre** (cohérent avec la [culture RCT du projet](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md)).
- **Fonctionner à 1 utilisateur** : l'app doit être utile **seul avec l'IA**, sans communauté (voir
  [05-systeme-communautaire.md](05-systeme-communautaire.md)).

> ⚠️ Honnêteté (comme dans toute la doc) : l'économie des « wrappers » d'IA est brutale (beaucoup échouent).
> Ce qui protège Dowze n'est pas d'être un wrapper de plus, mais d'être **un système pédagogique structuré**
> (données d'état, carte, communauté) qui se trouve *utiliser* une IA externe — et de rester **portable
> multi-IA** pour ne dépendre d'aucun fournisseur.
