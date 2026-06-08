# Reste à faire — feuille de route vers le produit complet

> *Suite du [plan](00-plan.md). État au jalon 2.29.0 : toutes les **couches métier** sont posées
> (graphe, pont `.json`, progression, planning, validation, communauté, parental, modération), testées,
> en CI verte. Restent les **parcours**, le **temps réel**, le **hors-ligne** et la **production**.*

## Principe inchangé

Chaque jalon = une **MINOR** (le produit complet visera **3.0.0**), fusionnée `develop → main` + tag +
release, avec `build` + `typecheck` + `lint` + **tests** verts et **0 vulnérabilité**. Toute brique de
logique « intéressante » est écrite en **fonction pure testée**. Ce qui exige une infra absente de
l'environnement de build (Docker → Postgres/Redis/Realtime, navigateur → Playwright) est **écrit et vérifié
par build/typecheck/tests unitaires**, et signalé comme tel.

---

## Phase 3 — Parcours & expérience d'apprentissage

| Version | Jalon | Contenu |
|---------|-------|---------|
| **2.30.0** | **Auth & comptes** | Supabase Auth bout-en-bout : inscription/connexion (web), contexte de session, module `accounts` (création compte + profil, email du responsable si mineur), garde JWT appliquée aux routes protégées. |
| **2.31.0** | **Onboarding & diagnostic** | Parcours d'inscription complet → **diagnostic** qui place l'élève sur le Cursus (via `frontier`) → première compétence prescrite. Logique de diagnostic **pure** testée + flux web multi-étapes. |
| **2.32.0** | **Expéditions & génération de contenu** | Module `expeditions` (cycle Étincelle→Question→Défi→Acte→Trace), génération de **leçons/grilles** via le pont `.json`, écran « expédition en cours » + session d'apprentissage (prompt à donner à l'IA). |
| **2.33.0** | **Carnet de bord & continuité** | Bibliothèque de prompts contextualisés + **état entre sessions** (carnet de bord) : l'IA est sans mémoire, l'intra la lui rend. |

## Phase 4 — Temps réel & hors-ligne

| Version | Jalon | Contenu |
|---------|-------|---------|
| **2.34.0** | **Minuteur & sonnerie** | Minuteur synchronisé au planning (disque visuel, pauses, **sonnerie douce**), sain et anti-dark-pattern. Logique de cycle **pure** testée. |
| **2.35.0** | **Temps réel** | Supabase Realtime : **chat de classe en direct** + **présence** (« qui est en ligne »). |
| **2.36.0** | **PWA & hors-ligne** | **Serwist** (service worker) + `manifest`, mise en cache, **shell hors-ligne**. Vérifié par `next build`. |

## Phase 5 — Production

| Version | Jalon | Contenu |
|---------|-------|---------|
| **2.37.0** | **Jobs & observabilité** | **Redis** (cache-aside du graphe), **BullMQ** (file des pairs, digests parentaux), **pino** (logs structurés). Logique de jobs **pure** testée. |
| **2.38.0** | **Déploiement** | **Dockerfiles** (api + workers), **docker-compose** (stack complète locale), config **Vercel** (web), durcissement (helmet, rate-limit), guide de déploiement. |
| **3.0.0** | **E2E, a11y & finition** | **Playwright** (specs e2e web) + tests d'intégration API (Testcontainers, écrits), états de chargement/erreur, **WCAG 2.2 AA**, nettoyage. **Produit complet.** |

---

## Definition of Done (inchangée)

`typecheck` + `lint` + `format:check` OK · **tests verts** · fichiers courts · doc à jour · **fusionné `main`
+ tagué + release + CI verte**. Les limites d'environnement (Docker/navigateur) sont documentées, jamais
masquées.
