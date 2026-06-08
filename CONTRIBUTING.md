# Contribuer à Dowze — flux de versionnement

Ce document décrit **comment le projet est versionné** : l'articulation entre les
commits, les branches et les versions publiées. Il est volontairement strict pour
garder un historique **propre, traçable et professionnel**.

---

## En une phrase

> On ne pousse **jamais** de travail en cours directement sur `main`.
> Le travail vit sur `develop` (le **flux de version**) et les branches de fonctionnalités ;
> `main` ne reçoit que des **versions finalisées**, fusionnées depuis `develop` et
> **étiquetées** (`vX.Y.Z`).

```
 feature/*  ─┐
 fix/*      ─┼─►  develop  ──(version finalisée)──►  main  ──tag vX.Y.Z──►  Release GitHub
 hotfix/*   ─┘      (flux)                          (versions publiées)
```

---

## 1. Le modèle de branches

| Branche          | Rôle                                                                                          | Origine → cible        |
|------------------|-----------------------------------------------------------------------------------------------|------------------------|
| `main`           | **Versions publiées uniquement.** Toujours stable. Chaque fusion = une version étiquetée.     | — (protégée)           |
| `develop`        | **Le flux de travail.** Intègre tout ce qui composera la prochaine version.                   | `main` → `main`        |
| `feature/<nom>`  | Un ajout (nouveau dossier, concept, section).                                                 | `develop` → `develop`  |
| `fix/<nom>`      | Une correction non urgente.                                                                    | `develop` → `develop`  |
| `release/x.y.z`  | *(optionnel)* Stabilisation d'une version avant publication.                                  | `develop` → `main`     |
| `hotfix/x.y.z`   | Correction **urgente** d'une version déjà publiée.                                            | `main` → `main` + `develop` |

`main` est la branche par défaut et la cible canonique : **« à chaque fois, on pousse la dernière version dans `main` »**.

---

## 2. Versionnement sémantique (SemVer)

Format `MAJOR.MINOR.PATCH` (ex. `2.17.0`). Pour un projet de **conception / documentation**, on l'interprète ainsi :

| Incrément | Quand                                                                                  | Exemple                                  |
|-----------|----------------------------------------------------------------------------------------|------------------------------------------|
| **MAJOR** | Refonte conceptuelle qui change la vision ou l'architecture de fond (rupture).         | Nouveau paradigme pédagogique            |
| **MINOR** | Nouveau dossier, nouveau concept, nouvelle section importante (ajout rétro-compatible).| Ajout du dossier `10-APP-WEB`            |
| **PATCH** | Corrections, précisions, reformulations, coquilles.                                    | Renommage, correction d'un lien          |

Le [`CHANGELOG.md`](CHANGELOG.md) suit le format **[Keep a Changelog](https://keepachangelog.com/fr/)**.
La version `2.17` du CHANGELOG correspond au tag `v2.17.0`.

---

## 3. Messages de commit — Conventional Commits

Format : `type(portée): sujet à l'impératif présent`

| Type       | Usage                                              |
|------------|----------------------------------------------------|
| `feat`     | Nouveau contenu / nouvelle fonctionnalité          |
| `fix`      | Correction                                         |
| `docs`     | Documentation pure (README, CHANGELOG, ce fichier) |
| `refactor` | Réorganisation sans changement de fond             |
| `chore`    | Outillage, configuration, dépendances              |
| `style`    | Mise en forme (sans changement de sens)            |
| `revert`   | Annulation d'un commit                             |

Exemples :

```
feat(architecture): ajoute le noyau de règles strictes (R1-R8)
fix(glossaire): corrige l'entrée « Dowze »
chore(repo): met en place la licence MIT et le .gitignore
docs(changelog): prépare la version 2.18.0
```

---

## 4. Le processus de publication (release), pas à pas

Exemple : publier la version `2.18.0`.

```bash
# 1) Travailler sur une branche dédiée, issue de develop
git switch develop && git pull
git switch -c feature/mon-ajout
#   ... commits ...

# 2) Fusionner la fonctionnalité dans le flux (develop)
git switch develop
git merge --no-ff feature/mon-ajout
git branch -d feature/mon-ajout

# 3) Quand develop contient tout le contenu de la version :
#    - ajouter la section [2.18] — AAAA-MM-JJ dans CHANGELOG.md
git commit -am "docs(changelog): prépare la version 2.18.0"

# 4) PUBLIER : fusionner develop dans main, puis étiqueter
git switch main
git merge --no-ff develop -m "release: v2.18.0"
git tag -a v2.18.0 -m "Dowze v2.18.0"
git push origin main develop v2.18.0

# 5) Créer la release GitHub (notes = la section du CHANGELOG)
gh release create v2.18.0 --title "Dowze v2.18.0" --notes "…(coller la section CHANGELOG)…"
```

> Règle d'or : **le tag se pose sur le commit de fusion dans `main`**, jamais ailleurs.
> Ainsi `git tag` liste l'historique exact des versions publiées.

---

## 5. Pourquoi ce modèle ? (analyse)

Trois grandes familles de flux Git existent :

- **GitHub Flow** — une seule branche `main` + branches de fonctionnalités fusionnées en continu.
  *Simple, mais tout atterrit vite sur `main`* → contraire à l'exigence « ne pas tout mettre dans `main` ».
- **Trunk-Based Development** — commits très fréquents sur le tronc, derrière des *feature flags*.
  *Excellent pour des équipes CI/CD matures qui livrent du code plusieurs fois par jour* ; inadapté à un dépôt
  de **conception** où l'on veut un `main` = suite de versions propres et figées.
- **Git Flow *(adopté ici, en variante simplifiée)*** — sépare le **flux de travail** (`develop`) des
  **versions publiées** (`main`), avec étiquetage SemVer. C'est littéralement « un flux de version, puis on
  pousse la dernière dans `main` ». C'est le standard quand on veut un `main` qui ne contient **que** des
  versions stables et traçables.

On utilise une **variante simplifiée** de Git Flow : les branches `release/*` restent **optionnelles** tant
que le projet est porté par une seule personne, et l'on bascule vers le modèle complet (avec `release/*` et
protection de branche) dès qu'une équipe se forme.

---

*Questions ? Voir le [README](README.md) et le [CHANGELOG](CHANGELOG.md).*
