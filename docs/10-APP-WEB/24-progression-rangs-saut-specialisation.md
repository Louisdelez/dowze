# Progression : rangs, Saut de Rang et spécialisation

> Le système de progression de Dowze, fondé sur la recherche 2026 (mastery learning, CBE, ISCED,
> ladders compétitifs, accélération des doués, learning analytics, spaced retention, Open Badges).
> Principe : **une école mondiale, sans plafond, où l'on ne « termine » jamais — on monte, on
> approfondit, on se spécialise.**

---

## 1. Les 10 rangs (une échelle universelle, pas un système scolaire national)

Échelle type jeu vidéo, auto-classante, avec un repère « (niveau similaire à …) » calé sur **ISCED/UNESCO** :

| # | Rang | ≈ niveau |
|---|---|---|
| 1 | Fer | maternelle |
| 2 | Bronze | primaire |
| 3 | Argent | collège |
| 4 | Or | lycée |
| 5 | Platine | licence (bac+3) |
| 6 | Émeraude | master (bac+5) |
| 7 | Diamant | doctorat (bac+8) |
| 8 | Master | chercheur |
| 9 | Grand Master | recherche de pointe |
| 10 | Dowzer Suprême | frontière du savoir · **sans fin** |

Le rang mesure la **profondeur de maîtrise**, jamais l'âge d'apparition d'une notion. Chaque compétence est
classée par son niveau réel (lu dans sa description). Source unique : `apps/api/src/results/ranks.ts`.

## 2. La barre unique (RR) et la montée de rang

Écran « Mes résultats » = **une seule barre** (façon LP/RR) : le rang courant + la progression vers le suivant.
Le rang courant est un **état stocké** (`learner_rank`) : il ne change qu'à l'acceptation d'une montée.

**Trois conditions (invisibles à l'écran, elles pilotent le déblocage)** :
1. **Niveau requis** : maîtrise pondérée du rang ≥ 0,80 ET ≥ 90 % des compétences à p ≥ 0,75.
2. **3 examens trimestriels** validés (≥ 70 %).
3. **≥ 60 % des tests hebdomadaires** réussis, sur le cycle du rang.

Plus un **plancher d'1 an** par rang (consolidation + espacement, Cepeda). Réunies → **bouton accepter /
consolider** (l'élève choisit ; jamais automatique — pas de « série couperet »). Compte parental →
**co-décision** : l'élève accepte, le responsable confirme.

## 3. Le Saut de Rang (mois intensif, pour aller plus vite)

Pour un élève qui maîtrise déjà presque tout son rang, un **mois intensif** (type piscine 42/Epitech) permet
de franchir un rang plus vite. Volontairement exigeant, sans risque.

- **Jauge de Saut /100** (éligibilité, façon Iowa Acceleration Scale) : maîtrise du rang actuel + régularité +
  motivation. Verrous : maîtrise du rang actuel ≥ 0,70, jauge ≥ 60.
- **Consentement parental bloquant** (compte mineur) : le mois ne démarre qu'après confirmation du responsable.
- **Cadence calendaire** : 1 tâche par jour réel (un mois se construit jour après jour).
- **Programme 28 jours** : test quotidien + repos le mercredi + gros test le samedi + expédition-éclair le
  dimanche ; semaine 4 = semaine d'examens (1/jour). Un test non fait = 0.
- **Réussite = ≥ 80 % + ≥ 4/5 examens** → montée accélérée. **Échec = retour au rang, zéro pénalité.**
- **Garde-fous** : sommeil 8-10 h rappelé, repos, échec sans stigmatisation.
- **Rétention post-saut** : re-tests espacés **J+7 / J+30 / J+90** (anti-bachotage) ; un oubli → remédiation
  ciblée + mini-checkpoint à J+3.

Modules : `apps/api/src/rank-jump/`, page `/saut`.

## 4. La spécialisation (le « pic » du profil en T)

On n'apprend jamais tout : après un **socle large** (rang ≥ Argent), l'élève **choisit des directions**.

- **Verrou** : rien avant Argent (socle commun d'abord).
- **Propositions guidées** : 2-3 disciplines d'après un **score d'appétence composite** (compétences maîtrisées
  + qualité de progression), garde-fou de persistance (≥ 2 compétences, pas un pic isolé), formulé comme
  **piste, jamais un verdict**. Plus une **voie 100 % libre** (n'importe quelle discipline).
- **Guide-IA** : pour chaque voie, un **plan de spécialisation** généré par backward design (objectif distal +
  5-8 **jalons** = compétences vérifiables avec critères mesurables + **projets** authentiques à produit public).
- **Badges** : chaque jalon validé débloque un **badge** (micro-crédentiel : critères + preuve + discipline).
- **Biais de contenu** : la séance prescrit en priorité les compétences de la voie choisie.
- **Réversible** (« respec ») : ajouter, combiner, retirer une voie sans rien perdre.

Modules : `apps/api/src/specialization/`, page `/specialisation`.

## 5. Fondements de recherche (résumé)

Mastery learning (Bloom, seuils 80-90 %) · CBE / progression par preuves · ISCED 2011 (UNESCO) · ladders
Elo/Glicko (gain lié à la distance au but) · A Nation Empowered + Iowa Acceleration Scale (accélération des
doués) · piscine 42/Epitech · Cepeda (espacement) + testing effect (Roediger-Karpicke) · SDT (autonomie,
compétence) · profil en T · Locke & Latham (objectifs) + PBL Gold Standard · learning analytics (trianguler,
ne jamais lire un signal seul) · burnout académique (WHO-5, perfectionnisme) · Open Badges 3.0.

## 6. Raffinements livrés (2026-07)

- **Pré-test « above-level »** dans la jauge de Saut : génère des questions du rang VISÉ (Copilote), score
  intégré à la jauge (poids 35), éliminatoire si < 40 %.
- **Bien-être** : check-in humeur quotidien (1-5) pendant le mois + WHO-5 hebdo ; note de **soutien** quand
  c'est bas — jamais un diagnostic, humain dans la boucle.
- **Barre RR à gain variable** (Elo/LP) : points RR accumulés par test (`ΔRR = 25·(score − 0,6)`), découplés
  du gate rigoureux (les 3 conditions restent le vrai verrou). Remis à zéro à chaque changement de rang.
- **Signaux d'appétence** composites (progression + maîtrise) avec garde-fou de persistance.

## 7. À trancher (produit) — endpoints sans UI

Certaines briques back-end existent sans écran, car elles demandent une **décision produit**, pas juste du
câblage : **modération** (charte, signalement, sanctions), **communauté** (créer/rejoindre des classes),
**validation par les pairs** (revue d'artefacts), **recharge de crédits** (Stripe). À prioriser avec l'équipe.
