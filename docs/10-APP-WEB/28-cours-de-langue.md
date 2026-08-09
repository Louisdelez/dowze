# 28 — Cours de langue « Parler »

> Un cours QUOTIDIEN, séparé de « Ma séance », centré sur la **communication** et le **savoir-parler** —
> pas le par-cœur. Tuteur IA vocal non-jugeant, une langue active à la fois, anciennes langues
> maintenues, classes « langue cible only » entre pairs du monde entier. Fondé sur 3 recherches
> sourcées (juillet 2026).

---

## 0. Pourquoi ce cours existe (et pourquoi il est séparé)

Apprendre une langue, ce n'est pas réciter du vocabulaire : c'est **savoir parler avec quelqu'un**. La
recherche est nette : l'approche **actionnelle / communicative (TBLT)** bat l'enseignement grammaire+
vocabulaire quand l'objectif est de parler (Long, Ellis ; effet d ≈ 0,6–0,9). Le vocabulaire espacé
garde une place — mais **instrumentale** : c'est l'accélérateur qui fait franchir le seuil lexical
(~95–98 % de couverture, Nation) à partir duquel la conversation devient efficace. Donc : **plafonné à
~20–25 % de la séance, par fréquence, et chaque mot est réemployé tout de suite**.

C'est un cours à part (`/langues`) parce que son rythme est particulier : **court, quotidien, le matin**
(effet d'espacement — Cepeda ; une micro-séance/jour bat une longue séance hebdo). La régularité prime
sur l'intensité (B1 ≈ 1 an à ~1 h/jour ; la séance Dowze vise 15–30 min selon l'âge).

## 1. Une langue à la fois, l'IA débloque la suivante

Chez le débutant, la mémoire de travail sature : on apprend **une langue active à la fois**. Les autres
passent en **maintenance** (voir §4). L'IA de Dowze **débloque une nouvelle langue à la proficience**,
jamais au temps écoulé : seuil ≈ **A2 solide / entrée B1** (`UNLOCK_LEVEL`), **durci si la nouvelle langue
est proche** d'une déjà apprise (anti-mélange : es↔it, de↔nl…). Ordre conseillé : commencer par une langue
proche de la langue maternelle (transfert positif + victoire précoce).

Le niveau est suivi **par langue** (`learner_languages.level`, 0→5 ≈ A1→C1) — et non sur les nœuds
`lang-*` génériques de l'Atlas, qui restent le **référentiel** (ce qu'est A1/A2/B1), sinon apprendre
l'anglais marquerait l'espagnol comme déjà avancé.

## 2. Le choix de la langue : 100 % libre, aidé par la géographie

L'élève choisit **à 100 %**. Pour l'aider, Dowze **propose** des langues selon **où il vit** (`geo.ts`,
dérivé de la locale) : langues nationales de sa région, langue des voisins frontaliers, anglais (utilité
pro quasi universelle), et — pour les pays plurilingues (Suisse, Belgique) — les **autres langues
nationales**. Chaque proposition porte un **« pourquoi »** de 1–2 lignes, **projectif + concret**, jamais
« tu dois » (l'*ideal L2 self* prédit l'effort, r=0,61 — Dörnyei ; primes salariales — Grin). Ex. romand →
allemand (« 63 % de la Suisse + jusqu'à +20 % de salaire ») ; belge francophone → néerlandais. Le champ
reste **libre** (catalogue complet). Une fois choisie, la langue ne se « déchoisit » pas — on en ajoute
d'autres plus tard.

## 3. La séance du jour : compose → TON IA → ingest (le prof n'est PAS Dowze)

> 🔀 **Révision 08-2026 — deux modes, comme « Ma séance ».** Ce §3 décrit le **MODE MANUEL** (le prof est
> l'IA de l'élève). Il devient une **option**, plus le seul chemin. Par **défaut**, le cours de langue est
> désormais **donné par l'IA de Dowze** en app (feuille A4 : tâche communicative TBLT + mini-fiche lexicale) —
> voir [le cours natif Dowze](30-cours-natif-feuille-modules.md#9-cours-de-langue--parler--même-logique).
> Nuance honnête propre aux langues : **l'ORAL reste meilleur via le mode vocal de ChatGPT/Claude** aujourd'hui
> → le mode manuel garde une vraie valeur pour parler (tant que le STT/TTS natif de Dowze n'est pas robuste).

**Principe (mode manuel)** : ici l'IA de Dowze n'est pas le professeur, elle **orchestre** — exactement
comme « Ma séance ». Le prof, c'est **l'IA de l'élève (ChatGPT, Claude…)**, y compris à l'oral (mode vocal
de ces apps). Déroulé (`compose` / `ingest`) :

1. **`compose`** (déterministe, GRATUIT — aucun appel LLM) : Dowze assemble un **prompt lisible** que
   l'élève copie dans son IA. Ce prompt porte la **consigne** (tâche communicative TBLT, ~90 % en langue
   cible + filet L1, feedback de type « prompt », i+1, mode vocal), le **niveau CECRL**, la **mémoire**
   (bilan de la dernière séance) et les **centres d'intérêt** (dossier) pour ancrer les exemples. Ton
   **non-jugeant** explicite (↓ anxiété, ↑ envie de parler).
2. L'élève **parle avec son IA** (idéalement à voix haute), puis lui demande un **bilan** (prompt de
   clôture fourni).
3. **`ingest`** : l'élève recolle le **résumé texte** ; l'**IA interne de Dowze le STRUCTURE** (outcome,
   note can-do, mots nouveaux, erreurs) et **Dowze RECALCULE le niveau** (jamais l'IA) + met à jour le
   **streak** et la mémoire. Zéro format à respecter.

C'est la même architecture « compound AI system » que le reste de Dowze : LLM interchangeable côté élève,
état détenu par l'app.

## 4. Maintenir les anciennes langues (ne pas les oublier)

Oublier une langue = perte d'**accès**, pas de connaissance (effet de « savings » — de Bot). Les langues
en maintenance reçoivent de **courtes réactivations** par **rappel actif orienté production** (c'est le
parler qui s'érode en premier — Schmid) : ~10 min, marquées « à réactiver » après ~2 jours sans pratique.
Au-dessus de B2, la dose peut baisser (~30 min/sem).

## 5. Les classes de langue : « langue cible only » entre pairs

Dans « Ma Classe » (`/communaute`), en plus de la classe académique, **un onglet par langue apprise**. Une
classe de langue regroupe des apprenants de la **même langue cible et d'un niveau proche, quelle que soit
leur langue maternelle** — on n'y parle **que la langue cible**. C'est fondé : la **négociation du sens est
plus fréquente entre non-natifs** (Varonis & Gass), l'anglais est déjà une lingua franca entre apprenants
(Seidlhofer). Garde-fous (charte visible) : erreur = apprentissage, correction bienveillante, filet L1 en
dépannage seulement, **seuil A2 pour participer**, ancrage expert (IA de modération) contre la
fossilisation. Réassignation annuelle comme les classes normales.

## 6. Modèle de données

`learner_languages` (état par langue : niveau, statut active/maintenance, streak, pitch) ·
`language_activity` (journal, streak, maintenance) · `classes.target_lang` + `type='language'` (classes de
langue) · réutilise `conversations` (`class_channel`) + `memberships`.

## 7. Ce qui reste (honnête)

- Le référentiel `lang-*` plafonne à **B1** ; l'extension vers B2/C1 (école générative) affinera le seuil
  de déblocage et la projection.
- Reconnaissance vocale = **Web Speech API** (excellent sur Chrome, inégal ailleurs) ; un STT/TTS serveur
  serait plus robuste et multi-navigateur.
- Couche **tandem** (appariement réciproque L1↔L2) pas encore construite (les classes de langue en
  couvrent une partie).

**Sources** : Long (2015), Ellis (2016), Krashen, Swain, Lyster & Ranta, Nation (2006), Hu & Nation (2000),
Cepeda et al. (2006/2008), Schmid & Mehotcheva (2012), de Bot & Stoessel (2000), Varonis & Gass (1985),
Seidlhofer, Horwitz et al. (1986), MacIntyre et al. (1998), Dörnyei / Al-Hoorie (2018), Grin, ACTFL, CECRL.
