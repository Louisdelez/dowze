# Niveau & XP (engagement)

> *Un système de **niveau et d'XP façon jeu vidéo**, DISTINCT des rangs pédagogiques (Fer → Dowzer Suprême).
> Le niveau est **personnel, monotone (ne redescend jamais), non pédagogique** : il mesure l'**assiduité /
> l'engagement**, pas la maîtrise. Auto-référencé, **aucun classement** (la recherche est claire : un
> classement absolu décourage les derniers ; le niveau personnel relève des objectifs de maîtrise).*

Fondé sur la recherche 2026 (courbes RPG, streaks Duolingo, SDT / surjustification, anti-idle, seuils de
confiance Wikipedia/Stack Overflow/Discourse).

---

## La courbe

Courbe **quadratique** — gratifiante tôt, s'allonge, **ne bloque jamais** (on exclut l'exponentielle, seule
famille qui crée un vrai « mur ») :

```
XP(n)     = 25 · n²                       (coût pour passer du niveau n au n+1)
Total(n)  = 25 · n(n+1)(2n+1) / 6         (XP cumulé pour atteindre le niveau n)
```

Niveau 2 = 25 XP (quelques minutes) · niveau 3 = 125 · niveau 5 ≈ 1 375 · niveau 10 ≈ 9 625. Le niveau est le
plus grand `n` tel que `Total(n) ≤ XP`.

## Les sources d'XP (tout plafonné, calculé côté serveur)

| Source | XP | Plafond |
|---|---|---|
| **Connexion quotidienne** | +20 | 1×/jour |
| **Bonus de série** (streak) | +5 par palier (3/7/14/30 j) | max +30 |
| **Temps ACTIF de travail** | +5 / 10 min actif | **max 40/jour** |
| **Test réussi** (≥ 60 %) | +80 | 1×/test |
| **Compétence validée** (pairs) | +200 | événement rare |
| **Évaluer un pair** | +30 | réciprocité |
| **Plafond global** | — | **400 XP/jour** |

Principes (recherche) :
- **Récompenser le temps de présence est la source la plus risquée** (érode la motivation intrinsèque,
  d = −0,40 ; farming) → elle reste **petite, plafonnée, et conditionnée à l'activité RÉELLE** (onglet visible
  + interactions récentes ; heartbeat serveur ; jamais sur un écran passif). L'XP de **complétion**
  (séance/test/validation) domine.
- **Streak sain** : jamais de reset brutal, découplé de l'objectif (une action suffit), **on célèbre, on ne
  menace pas**. Pas de compte à rebours anxiogène.
- **Feedback informationnel** au level-up (« Tu as atteint le niveau N »), pas de langage contrôlant.

## Anti-abus

Le niveau (monotone, XP plafonné/jour) exige un **nombre incompressible de jours** pour progresser → coupler
**niveau minimum + ancienneté** rend les **multi-comptes coûteux** (modèle Wikipedia/Discourse/Stack Overflow).
C'est ce qui garde l'éligibilité d'évaluateur de la [validation par les pairs](09-validation.md). Les **seuils
exacts ne sont pas publiés**. XP calculé et validé **côté serveur** (le client n'envoie que des événements).

## Affichage

Une **barre de niveau + XP** dans la barre supérieure (badge violet = niveau, barre = progression vers le
suivant), **visuellement distincte** du rang pédagogique pour ne pas confondre les deux systèmes.
