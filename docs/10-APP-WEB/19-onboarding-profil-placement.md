# Onboarding : profil, présentation, dossier élève & test de placement

> *Avant la première séance, l'élève traverse un parcours d'entrée court et non intimidant : il crée son
> compte, remplit son profil, **se présente** en quelques lignes, et passe un **test de placement** qui
> situe son vrai niveau. L'IA de Dowze transforme la présentation en **dossier élève** (comme le ferait un
> prof qui apprend à te connaître) et te place **au bon endroit du cursus** — de la maternelle à l'adulte.*
>
> *Principe : **chaque élève est différent.** Dowze part de ce que tu sais déjà, de ce que tu aimes et de
> ton niveau réel — pas d'un moule unique.*

---

## 1. Le parcours d'entrée (dans l'ordre)

On **étale** la collecte (divulgation progressive) : on ne demande jamais tout d'un coup, et jamais une
donnée avant qu'elle ne serve (NN/g, RGPD art. 5 minimisation).

```
1. Inscription minimale   →  e-mail + mot de passe (2 champs, c'est tout)
2. Validation par e-mail  →  tu confirmes ton compte
3. Ton profil             →  photo, pseudo, mot de passe, e-mail, DATE DE NAISSANCE
4. Ta présentation        →  un formulaire où tu te présentes (identité, langues, passions, rêves…)
                             → l'IA en fait ton DOSSIER ÉLÈVE (que tu valides)
5. Test de placement      →  court, adaptatif, sans stress → situe ton niveau
6. Première séance        →  tu démarres au bon niveau, sur du contenu qui te parle
```

> ❌ **Retrait de la case « je suis mineur·e ».** On ne coche plus rien : c'est la **date de naissance**
> (à l'étape 3) qui détermine le statut mineur et, en France, déclenche le **consentement parental en
> dessous de 15 ans** (CNIL). Plus simple, plus fiable, et conforme.

---

## 2. Le profil (page de paramètres)

Une fois le compte validé, l'élève a **sa page de profil** sur son intra, avec :
- **photo de profil**, **pseudo**, **mot de passe**, **adresse e-mail** (modifiables) ;
- **date de naissance** (ajout/édition) → sert à **adapter le niveau et le rythme selon l'âge** et à gérer
  le consentement des mineurs ;
- réglages de confidentialité **renforcés par défaut** pour les mineurs (profilage/pub commerciale **OFF** —
  recommandation CNIL / ICO Children's Code).

C'est un espace de gestion de compte classique, sobre, sans jargon.

---

## 3. La présentation : « parle-nous de toi »

Le cœur motivationnel de l'onboarding. On demande à l'élève de **se présenter**, parce que partir de son
vécu et de ses intérêts est le levier pédagogique le mieux étayé (concept de **« funds of knowledge »**,
Moll et al. 1992 ; **autodétermination**, Deci & Ryan : autonomie + compétence + appartenance).

**Champs (obligatoires — minimaux) :** prénom, e-mail, mot de passe, **date de naissance**, langue(s),
**objectif principal en une phrase**, consentement RGPD (acte positif clair ; parental si &lt; 15 ans).

**Champs (optionnels, encouragés, jamais bloquants) :**
- **Un grand champ texte libre** : *« Parle-nous de toi : ce que tu aimes, tes passions, tes hobbies, ce que
  tu fais de tes journées, tes rêves, ce que tu veux apprendre et devenir. »*
- passions / centres d'intérêt (puces suggérées + saisie libre) ;
- domaines visés ; niveau ressenti / dernière classe suivie (amorce le placement) ;
- contraintes (temps dispo, accessibilité, besoins particuliers) ;
- pays / fuseau horaire (utile pour le planning) ;
- contact d'un parent (si mineur).

**On NE demande PAS :** l'adresse postale exacte, ni aucune donnée sensible (santé, origine, religion… —
art. 9 RGPD) — rien « au cas où ». *(La demande initiale de l'utilisateur incluait « adresse » ; on la
retire volontairement au nom de la minimisation des données : elle n'est pas nécessaire à l'enseignement.)*

**Ergonomie** : une idée par écran, champs sensibles (âge) expliqués (« pourquoi on te le demande ») et
placés en fin ; ton chaleureux ; à tout moment on peut passer et compléter plus tard.

---

## 4. Le dossier élève : l'IA lit ta présentation comme un prof

L'IA de Dowze lit **le texte libre + les champs** et en fait un **dossier élève** structuré — un *Open
Learner Model* (modèle **visible et modifiable par l'élève**, bon pour la métacognition et la transparence
RGPD). Structure :

```
Dossier élève
├─ Identité & contexte : prénom, âge/tranche, langue(s), pays/fuseau, statut mineur
├─ Objectifs : objectif principal + sous-objectifs
├─ Intérêts / funds of knowledge : passions & thèmes → réservoir d'exemples personnalisés
├─ Niveau & prérequis : niveau déclaré + a priori de placement
├─ Préférences (déclarées, non figées) : formats, rythme
├─ Contraintes : temps, accessibilité, besoins particuliers
└─ Fiabilité : pour chaque champ → { valeur, citation source, confiance, déclaré vs inféré }
```

**Garde-fous anti-invention (impératifs)** — c'est le risque n°1 de cette étape :
1. **Extraction ancrée** : chaque attribut pointe la phrase qui le justifie (provenance).
2. **Abstention** : si l'info n'est pas dans le texte → champ vide « à préciser », **jamais inventé**.
3. **Déclaré vs inféré** : toute déduction est marquée comme telle.
4. **Validation par l'élève** : il voit et **corrige** son dossier avant enregistrement (l'app tient la
   vérité, pas le LLM — cohérent avec [le Copilote](15-copilote-orchestrateur.md)).

**À quoi sert le dossier** : le tuteur-IA puise dans **Intérêts** pour contextualiser les exemples (les
maths via le sport ou la musique → l'élève résout plus vite et plus juste), dans **Objectifs** pour montrer
la pertinence (autonomie), dans **Contraintes** pour doser le rythme.

> ⚠️ Les « styles d'apprentissage » (visuel/auditif…) sont scientifiquement **contestés** : on les traite
> comme une **préférence déclarée**, jamais comme une étiquette déterministe.

---

## 5. Le test de placement : situer le bon niveau (maternelle → master)

Parce qu'un adulte sortant de master ne doit pas commencer en maternelle, un **test de placement** situe le
niveau réel et **place l'élève à un nœud d'entrée du graphe de compétences**.

**Mécanique (état de l'art — testing adaptatif sans banque d'items calibrée) :**
1. **A priori intelligent** : on démarre à un niveau déduit de l'âge — jamais de zéro (résout le « cold start »).
2. **Estimation CONTINUE du niveau** (staircase type **Elo / Robbins-Monro**, Pelánek 2016) : à chaque réponse,
   l'IA corrige (3 paliers : *juste / partiel / faux*) et le niveau estimé `θ` se déplace d'un **pas
   décroissant** (grands sauts au début → convergence + détection rapide ; petits pas près de la cible). Pas
   besoin de banque d'items calibrée : l'IA **génère chaque question à la difficulté visée**. Cible ~**0,6**
   de réussite (informative sans être frustrante ; ~0,5 = max d'information de Fisher mais trop d'échecs).
3. **15 à 30 questions, arrêt sur STABILITÉ** : minimum 15, on s'arrête dès que l'estimation ne bouge plus
   (proxy d'erreur-standard faible), maximum 30. La précision progresse en **1/√n** (10→20 = −29 % d'erreur ;
   au-delà de 30, gain marginal).
4. **Détection du haut potentiel (HPI) — montée AU-DESSUS du référentiel** : si l'élève réussit tout à son
   niveau d'âge, on ne s'arrête pas au plafond du cursus — l'IA génère des **questions plus difficiles que le
   programme** pour trouver son **vrai plafond** (principe des *talent searches* SMPY/CTY et des tests MAP/STAR
   « off-grade »). Un enfant en avance n'est plus bridé.
5. **Le minuteur par question = repère + SIGNAL SÉPARÉ, jamais un couperet.** Chaque question a un temps
   **généreux** (adapté à l'âge), affiché en **barre analogique douce** (pas de gros compte à rebours chiffré,
   qui stresse). À l'expiration : **on passe en douceur**, aucun échec brutal. Le **temps de réponse** est
   enregistré comme dimension à part (« rythme / vitesse ») et sert à repérer les réponses trop rapides
   (non-effort) — il **n'entre pas dans le score de niveau**. Fondement : la vitesse est une vraie facette
   cognitive (Wechsler PSI, van der Linden), **mais** un chrono serré pénalise justement les plus doués
   (« choking », Beilock) et les anxieux ; on **mesure** donc la vitesse sans la **fondre** dans l'aptitude.
6. **Sortie = un état de connaissance** (modèle *Knowledge Space Theory* / ALEKS) : les compétences sous le
   point d'entrée sont marquées **maîtrisées**, et le **point d'entrée** est fixé dans le cursus.
7. **Faible enjeu, non figé** : *« pour te situer, pas pour te juger »*, feedback bienveillant, **optionnel**
   pour un grand débutant ; les premières séances **ajustent** le placement.

> **Honnêteté (limites assumées).** La difficulté estimée par l'IA est un *a priori bruité* (non calibré
> psychométriquement) : le placement est une **estimation ajustable**, pas un verdict — cohérent avec le
> faible enjeu. Le mapping niveau→graphe suppose un cursus quasi-linéaire (affinage par compétence = évolution
> future). La note de « potentiel » au-dessus du référentiel est une **invitation**, jamais un diagnostic de HPI.

*(Repères : ALEKS place en ~20-30 questions ouvertes ; un CAT atteint une bonne fiabilité en ~15-25 items.
Voir [le cerveau pédagogique §7](02-cerveau-pedagogique.md#7-le-diagnostic-initial-placement).)*

---

## 6. RGPD & mineurs (l'essentiel)

- **Minimisation** (art. 5) : seulement le nécessaire, jamais « au cas où ». D'où le retrait de l'adresse
  postale et des données sensibles.
- **Mineurs** : la **date de naissance** pilote le circuit. En France, **≥ 15 ans** l'élève consent seul ;
  **&lt; 15 ans**, consentement **conjoint** mineur + parent (CNIL). Confidentialité renforcée par défaut,
  profilage marketing désactivé (CNIL / ICO Children's Code).
- **Consentement** : acte positif clair, pas de cases pré-cochées (EDPB).
- **Transparence** : le dossier élève est un *Open Learner Model* — l'élève voit et corrige ses données.

---

## 7. Ce qui change côté produit (à implémenter)

- **Inscription** : retirer la case « mineur » + le champ « e-mail du parent » conditionnel ; réduire à
  e-mail + mot de passe. Le statut mineur se déduit de la **date de naissance**.
- **Page profil** : photo, pseudo, mot de passe, e-mail, **date de naissance**.
- **Formulaire de présentation** + génération du **dossier élève** par le Copilote (schéma contraint +
  garde-fous + validation élève).
- **Test de placement** adaptatif → point d'entrée dans le graphe (`mastery_states` initialisés).
- Base : ajouter `birthdate`, `profile` (bio, intérêts, objectifs, contraintes), `photo`, au profil.

**Suite** : [le parcours d'un nouvel élève](08-parcours-eleve.md) · [tests & examens](18-tests-et-examens.md)
· [le cerveau pédagogique](02-cerveau-pedagogique.md).
