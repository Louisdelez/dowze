# Mes résultats : le « bulletin » sans note (élève & responsable)

> *L'élève ET son responsable voient la progression — comme un portail scolaire — mais **sans note, sans
> moyenne, sans classement**. On montre la **maîtrise** (Découverte → En cours → Consolidé → **Maîtrisé**)
> et la **croissance**, jamais un jugement. C'est un « Pronote sain » : on garde la clarté et l'accès
> famille, on remplace la note par la maîtrise + la prochaine étape.*

---

## 1. Pourquoi pas de notes (la recherche est nette)

- **Butler (1988)** : accoler une **note** à un commentaire **annule** le bénéfice du commentaire. La note
  seule dégrade l'intérêt et l'apprentissage ; le feedback descriptif les nourrit.
- **Autodétermination** (Deci & Ryan) : les notes sont vécues comme **contrôlantes** et sapent la motivation
  intrinsèque, surtout chez « les non-gagnants ».
- **Hattie & Timperley** : le feedback « **au soi** » (note, éloge « tu es doué ») est le **moins** efficace ;
  ce qui fait apprendre, c'est le feedback sur la **tâche**, la **stratégie**, l'**autorégulation**.
- **Comparaison/classement** : effet « gros poisson–petit bassin » (β ≈ −0,28) — le classement **démotive
  surtout les plus faibles**.
- **Portails de notes** : la sur-consultation est un stresseur massif (l'État français a gelé les
  notifications 20h-7h + week-end en 2025). **Communiquer aux parents aide** (RCT : −41 % d'échec) **mais
  seulement** si c'est **actionnable, périodique, sans pression**.

**Conclusion** : on ne retire pas seulement la note, on la **remplace** par la maîtrise + la croissance + la
prochaine étape.

---

## 2. L'échelle : 4 niveaux nommés (comme le socle)

| Niveau | Sens | Forme |
|---|---|---|
| **Découverte** | pas encore abordé / tout début | ○ |
| **En cours** | en train de se construire | ◑ |
| **Consolidé** | presque acquis | ◕ |
| **Maîtrisé** | acquis — **la cible normale**, pas l'exception | ● |

Toujours **forme + libellé** (jamais la couleur seule — accessibilité WCAG, 8 % de daltoniens), **palette
douce, pas de rouge = échec**. Le niveau est **dynamique et réversible** (comme Khan), jamais un badge figé.

---

## 3. Écran ÉLÈVE — « Mes résultats »

1. **En-tête encourageant** (« Voici où tu en es, [prénom] ») — pas de note globale.
2. **Ton point de départ** (le placement) — cadré *« d'où tu es parti, pas ta limite »* ; **jamais**
   « ton niveau / ton aptitude » (effet Pygmalion, menace du stéréotype).
3. **Maîtrise par palier** (Fondations / Bases / Intermédiaire / Avancé) — barres alignées, répartition des
   compétences par niveau.
4. **Tes forces** (formulation *asset-based*) + **UN seul prochain défi** (actionnable).
5. **Tes tests d'entraînement** — « 9/10 maîtrisés à l'entraînement », historique de **ta** progression,
   **jamais un rang ni une comparaison**.

Vocabulaire (recherche) : « point de départ » pas « niveau » ; « tests d'entraînement » pas « examens » ;
« pas encore maîtrisé » pas « échoué » ; « ta progression » pas « ton rang ».

---

## 4. Écran RESPONSABLE — « Suivi »

1. **Synthèse en une phrase** : *où en est / ce qui va bien / une chose à travailler* — ce que les parents
   veulent vraiment savoir.
2. **Même vue maîtrise** que l'élève (mêmes descripteurs — un bulletin parent avec une note ré-activerait
   l'« ego-involvement » que la vue élève évite).
3. **« Comment l'aider »** : orienter vers le **dialogue** (« demande-lui de t'expliquer X ») **pas la
   surveillance** (« vérifie ses devoirs » a un effet nul, voire négatif dès 12 ans). C'est le levier n°1 de
   la recherche (attentes + dialogue).
4. **Encart « pourquoi pas de notes »** (recommandation Guskey) — désamorce l'attente d'une note.
5. **Jamais** : classement, comparaison à d'autres élèves, notification temps réel, **contenu privé des
   échanges**.

**RGPD & transparence** : le périmètre parent = **suivi scolaire uniquement** ; l'élève **sait ce que le
responsable peut voir** (affiché sur `/resultats` + code de suivi partagé depuis `/profil`) ; bascule
d'autonomie vers **15 ans** (France). Accès via un **code de suivi** que l'élève communique — il maîtrise le
partage.

---

## 5. Côté produit (implémenté)

- **API** : `results` module — `GET /results/me/:profileId` (élève) et `GET /results/child/:accountId`
  (responsable, via code) ; une même `build()` calcule tout **depuis l'existant** (`mastery_states`,
  `placement_sessions`, `test_attempts`) — **pas de nouveau stockage**.
- **Web** : page `/resultats` (élève) + `/parent` refondu (responsable) + composant partagé `ResultsBoard` ;
  code de suivi affiché sur `/profil`.
- Schéma `results.ts` (`masteryLevel`, `domainMastery`, `resultsView`).

**Limites assumées** : la maîtrise par « palier » (Fondations→Avancé) reflète un cursus quasi-linéaire ;
l'accès parent par code est volontairement simple (à durcir en vrais comptes responsables plus tard) ; les
niveaux dérivent du BKT (estimation, pas un verdict).

**Voir aussi** : [tests & examens](18-tests-et-examens.md) · [onboarding & placement](19-onboarding-profil-placement.md)
· [le cerveau pédagogique](02-cerveau-pedagogique.md).
