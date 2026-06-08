# Dowze — Le système d'éducation 2.0

> *Un protocole ouvert pour l'apprentissage humain. Pas un lieu. Pas un âge. Pas un diplôme.
> Juste un terminal, une connexion, et l'envie d'apprendre — de la naissance à la mort.*

[![CI](https://github.com/Louisdelez/dowze/actions/workflows/ci.yml/badge.svg)](https://github.com/Louisdelez/dowze/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/Licence-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.0.0-success.svg)](CHANGELOG.md)
[![Conventional Commits](https://img.shields.io/badge/commits-conventional-FE5196.svg)](CONTRIBUTING.md)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Qu'est-ce que ce dépôt ?

Ce dépôt contient la **conception complète et documentée** de **Dowze**, un système d'éducation
de nouvelle génération conçu de zéro. Ce n'est pas une réforme de l'école : c'est la conception
d'un **système entier** qui rend l'école *facultative comme forme*, et qui accompagne une personne
**toute sa vie**.

**Dowze** n'est pas une entreprise ni un site : c'est un **commun** — une infrastructure publique
mondiale, ouverte, que personne ne possède.

Cette documentation est **fondée sur la recherche** : chaque affirmation importante est sourcée, et
nous distinguons systématiquement ce qui est **prouvé**, ce qui est **émergent**, et ce qui reste
**aspirationnel**. Voir [`docs/09-ANNEXES/01-bibliographie.md`](docs/09-ANNEXES/01-bibliographie.md).

---

## Comment lire cette documentation

La documentation suit une **logique de progression** : du *pourquoi* (diagnostic) au *comment*
(architecture, technique, mise en œuvre), en passant par les *fondements* (science) et les
*garde-fous* (risques, éthique, gouvernance).

| # | Dossier | Ce qu'on y trouve | Pour qui |
|---|---------|-------------------|----------|
| 00 | [**FONDATIONS**](docs/00-FONDATIONS/) | Résumé exécutif, vision, principes, manifeste, glossaire | Tout le monde — **commencer ici** |
| 01 | [**DIAGNOSTIC**](docs/01-DIAGNOSTIC/) | Pourquoi l'éducation actuelle vieillit mal (chiffré, sourcé) | Décideurs, sceptiques |
| 02 | [**SCIENCE**](docs/02-SCIENCE/) | Sciences de l'apprentissage, état de l'art de l'IA éducative | Concepteurs pédagogiques |
| 03 | [**ARCHITECTURE**](docs/03-ARCHITECTURE/) | La pile Dowze en 6 couches | Architectes, produit |
| 04 | [**PARCOURS-DE-VIE**](docs/04-PARCOURS-DE-VIE/) | De la naissance à la mort, par âge | Tous |
| 05 | [**TECHNIQUE**](docs/05-TECHNIQUE/) | Specs : Atlas, Mentor IA, Passeport vérifiable, offline-first | Ingénieurs |
| 06 | [**GOUVERNANCE-ECONOMIE**](docs/06-GOUVERNANCE-ECONOMIE/) | Qui possède, qui paie, qui garantit, cadre juridique | Institutionnels, juristes |
| 07 | [**RISQUES-ETHIQUE**](docs/07-RISQUES-ETHIQUE/) | Registre des risques, délestage cognitif, sécurité mineurs, objections | Tous — **lecture critique** |
| 08 | [**MISE-EN-OEUVRE**](docs/08-MISE-EN-OEUVRE/) | Feuille de route en 4 phases, pilote, métriques | Porteurs de projet |
| 09 | [**ANNEXES**](docs/09-ANNEXES/) | Bibliographie, benchmark détaillé, personas, FAQ | Référence |
| 10 | [**APP-WEB**](docs/10-APP-WEB/) | Le portail web : modèle BYO-AI, cerveau pédagogique, prompts, UX, communauté, stack, MVP | Produit, ingénieurs |

> 🚀 **Comment ça fonctionne, concrètement :** l'IA *est* l'école — elle fait le programme, donne les cours,
> joue le prof, suit ta progression, et te propose quoi apprendre si tu ne sais pas. Voir
> [« Comment apprendre avec Dowze »](docs/08-MISE-EN-OEUVRE/05-demarrer-aujourdhui.md) et le kit prêt à
> l'emploi [`kit-ecole-dowze.html`](kit-ecole-dowze.html) (Charte de l'élève + Prompt-Maître à donner à l'IA).

**Trois parcours de lecture recommandés :**

- 🏃 **Express (15 min)** : [Résumé exécutif](docs/00-FONDATIONS/01-resume-executif.md) → [Vue d'ensemble de la pile](docs/03-ARCHITECTURE/00-vue-ensemble-pile.md) → [Feuille de route](docs/08-MISE-EN-OEUVRE/01-feuille-de-route.md).
- 🎯 **Décideur (1 h)** : tout le dossier 00, puis 01 (Diagnostic), puis 03 (Architecture), puis 07 (Risques) et 08 (Mise en œuvre).
- 🔬 **Concepteur / ingénieur** : 02 (Science) → 03 (Architecture) → 05 (Technique) → 07 (Risques).

---

## L'idée en une page

Pendant ~150 ans, le modèle scolaire dominant — classes par âge, programme standardisé, examen final,
diplôme — n'a presque pas changé, alors que le monde, lui, a radicalement changé. On sait depuis
longtemps que **l'apprentissage le plus efficace est personnel, par la maîtrise, par l'acte et par le
lien** — mais on n'avait jamais eu les moyens de l'offrir à *tous*.

Dowze rassemble pour la première fois des briques qui existent **enfin** (IA-tuteur, savoir mondial
gratuit, preuve cryptographique infalsifiable, communautés en ligne) dans une **architecture en bien
commun** qui tient *ensemble* sept exigences qu'aucune solution actuelle ne tient à la fois :

1. **Personnalisation** (le tuteur pour chacun) ;
2. **Motivation** (apprendre par projets réels) ;
3. **Lien humain** (la couche que les MOOC oublient — et qui explique leur abandon massif) ;
4. **Preuve** (un passeport de compétences vérifiable qui remplace le diplôme) ;
5. **Équité** (conçu d'abord pour les exclus) ;
6. **Continuité** (de la naissance à la mort) ;
7. **Gouvernance non capturable** (un commun, pas un produit).

La pile Dowze, en six couches :

```
┌──────────────────────────────────────────────────────────────┐
│  6 · LE SOCLE        Gouvernance, financement, équité, sûreté  │  ← le commun
├──────────────────────────────────────────────────────────────┤
│  5 · LA PREUVE       Passeport de compétences vérifiable       │  ← la confiance
├──────────────────────────────────────────────────────────────┤
│  4 · LES CERCLES     Pairs, guildes, foyers, mentorat humain   │  ← le lien
├──────────────────────────────────────────────────────────────┤
│  3 · LES QUÊTES      Projets & défis réels, maîtrise par l'acte│  ← le faire
├──────────────────────────────────────────────────────────────┤
│  2 · LE MENTOR       L'IA-tuteur personnel (scaffold & fade)   │  ← l'accompagnement
├──────────────────────────────────────────────────────────────┤
│  1 · L'ATLAS         Carte vivante et ouverte de tous les      │  ← le savoir
│                      savoirs et compétences humaines           │
└──────────────────────────────────────────────────────────────┘
       Accès via n'importe quel terminal (smartphone, PC, borne de Foyer)
```

Détail : [`docs/03-ARCHITECTURE/00-vue-ensemble-pile.md`](docs/03-ARCHITECTURE/00-vue-ensemble-pile.md).

---

## L'application (monorepo)

Au-delà de la conception (dossiers `docs/`), le dépôt contient **l'implémentation** — un monorepo
**npm workspaces + Turborepo**. Plan complet : [`docs/11-IMPLEMENTATION`](docs/11-IMPLEMENTATION/00-plan.md).

```
apps/
  web/        # Next.js 15 + React 19 + Tailwind v4 — le portail
  api/        # NestJS modulaire (Drizzle, pont .json, auth) — l'intra-core
packages/
  schemas/    # @dowze/schemas — schémas Zod partagés (source de vérité des types)
  core/       # @dowze/core — logique pure (clôture R1-R8, BKT, SM-2, planning, pont .json), testée
supabase/     # schéma Postgres versionné (migrations + seed + RLS)
```

**Démarrer :**

```bash
npm install            # installe tout le monorepo
npm run build          # build (turbo)
npm run typecheck      # vérification des types
npm run lint           # ESLint
npm run test           # tests (Vitest) — 60 tests

# Application (nécessite Docker pour la base) :
supabase start         # Postgres + Auth + Realtime en local
npm run dev -w @dowze/api   # backend
npm run dev -w @dowze/web   # frontend (http://localhost:3000)
```

> Les `build` / `typecheck` / `lint` / `test` ne nécessitent **pas** Docker. Lancer la base (Supabase) et
> les serveurs nécessite Docker. Détails : [`apps/web`](apps/web/README.md), [`apps/api`](apps/api/README.md),
> [`supabase`](supabase/README.md). Flux de versionnement : [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Statut & honnêteté intellectuelle

- **Statut** : conception **+ implémentation**, version **3.0.0** — toutes les couches et tous les
  parcours majeurs sont en place, testés et en CI verte (voir [`CHANGELOG.md`](CHANGELOG.md)).
- **Ce document affronte ses propres failles** : voir [le registre des risques](docs/07-RISQUES-ETHIQUE/01-registre-risques.md)
  et [les objections & réponses](docs/07-RISQUES-ETHIQUE/05-objections-reponses.md).
- **Aucune métrique gonflée** : nous avons banni les chiffres marketing non vérifiables. Quand une
  preuve manque, nous l'écrivons.

---

## Contribuer & versionnement

Le projet suit un flux **Git Flow simplifié** : le travail vit sur `develop` (le *flux de version*) et les
branches de fonctionnalités ; la branche `main` ne reçoit que des **versions finalisées**, chacune étiquetée
en **SemVer** (`vX.Y.Z`) et accompagnée d'une *release* GitHub. Commits en **Conventional Commits**,
journal au format **Keep a Changelog**. Tout est détaillé dans [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Licence

Distribué sous licence **MIT** — voir [`LICENSE`](LICENSE). © 2026 Louis Delez.

Dowze est pensé comme un **commun** : libre d'usage, de copie, de modification et de redistribution.

---

*Conception : voir [`docs/00-FONDATIONS/`](docs/00-FONDATIONS/). Questions fréquentes : [`docs/09-ANNEXES/04-faq.md`](docs/09-ANNEXES/04-faq.md).*
