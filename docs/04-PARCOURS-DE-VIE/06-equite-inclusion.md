# Le plan d'équité — pour les exclus d'abord

> *L'équité n'est pas une intention de fin de page : c'est un **pilier de conception**
> ([principe 3](../00-FONDATIONS/03-principes-fondateurs.md)). Ce chapitre la traite comme un problème
> d'ingénierie.*

---

## Pourquoi l'équité doit être traitée *activement*

Deux faits imposent de concevoir l'équité, pas de l'espérer :

1. **L'effet Matthew** : tout système éducatif ouvert profite **d'abord aux déjà-favorisés**. Les MOOC
   l'ont prouvé (ils ont surtout servi des apprenants éduqués), la formation continue aussi (OCDE 2025).
   *Laisser faire, c'est creuser l'écart.*
2. **La fracture numérique** : 2,6 milliards d'humains hors ligne (ITU 2024), concentrés en zone rurale et
   pauvre, avec un biais de genre. Voir [fracture numérique](../01-DIAGNOSTIC/06-fracture-numerique.md).

À cela s'ajoute le **troisième fossé numérique** (Brookings) : même à accès égal, ceux qui ont du soutien
humain utilisent l'IA comme **levier** ; les autres comme **béquille** (délestage). L'équité n'est donc
pas qu'une question d'accès matériel, mais aussi d'accompagnement.

---

## Les sept mécanismes d'équité de Dowze

### 1. Hors-ligne d'abord (*offline-first*)
Mentor et tranches d'Atlas **téléchargeables**, synchronisation opportuniste (même intermittente). Modèle
validé par **Kolibri** et **RACHEL** : un appareil « seed » télécharge une fois là où il y a du réseau,
puis partage en local — voire est transporté physiquement (« sneakernet »). Détail technique :
[05-TECHNIQUE/05-offline-first.md](../05-TECHNIQUE/05-offline-first.md).

### 2. Basse consommation
Fonctionne sur terminaux modestes, en faible bande passante, en **mode texte/voix** si besoin. (Rappel :
2 Go/mois en pays pauvre vs 16 Go en pays riche — la vidéo HD en continu exclut.)

### 3. Multilinguisme radical
Les langues minoritaires sont des **branches de l'Atlas**, pas des après-coups. C'est une leçon directe de
l'échec de Hole-in-the-Wall (pas de contenu dans la langue des enfants). ⚠️ Vigilance sur le biais des
LLM, majoritairement entraînés en anglais (risque de « nouvelle fracture de littératie IA », UNESCO).

### 4. Les Foyers comme points d'accès
Là où il n'y a pas de connexion à domicile, le **Foyer** (bibliothèque, centre, ancienne école) fournit
terminal *et* lien humain, et sert de relais de connectivité. C'est aussi la réponse au troisième fossé :
le Foyer apporte l'**accompagnement humain** qui transforme la béquille en levier.

### 5. Accompagnement humain renforcé pour les plus en difficulté
La pédagogie de maîtrise **bénéficie le plus aux apprenants faibles** ; Dowze y consacre donc plus
d'étayage (Mentor *et* mentors humains) là où c'est nécessaire — l'inverse d'un système qui abandonne les
plus lents.

### 6. Le terminal et la donnée comme droits
Dowze **plaide et s'allie** pour faire de l'accès un droit (comme l'eau ou l'électricité) : partenariats
publics, zéro-rating (accès sans coût de données), terminaux abordables. Dowze ne peut pas connecter le
monde seul — mais il refuse de s'en servir comme excuse.

### 7. Déploiement inversé
On **ne commence pas** par les zones déjà servies. On conçoit *pour* le village sans fibre, *pour* la femme
tenue à l'écart du numérique, *pour* l'adulte peu diplômé. **Ce qui marche pour eux marchera pour tous.**

---

## Accessibilité (handicap, âge, littératie)

L'équité inclut l'**accessibilité universelle** :

- interfaces adaptables (taille, contraste, voix, rythme) ;
- compatibilité avec les technologies d'assistance ;
- mode voix pour les personnes peu alphabétisées ou malvoyantes ;
- simplicité par défaut pour les personnes peu à l'aise avec le numérique (aînés, débutants).

---

## La limite honnête

Dowze ne résout pas, seul, la pauvreté, l'absence d'électricité ou de réseau. Ce sont des problèmes
d'infrastructure mondiale qui dépendent des États, opérateurs et bailleurs. Ce que Dowze s'engage à faire :

1. **ne jamais aggraver** la fracture par ses choix de conception ;
2. **maximiser l'utilité** de chaque octet et de chaque Foyer disponible ;
3. **mesurer l'équité comme métrique de succès première** : combien d'**exclus** progressent réellement —
   pas seulement combien d'utilisateurs au total (voir [métriques](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md)).

> Un Dowze qui aurait des millions d'utilisateurs *déjà favorisés* et n'atteindrait pas les exclus serait,
> selon ses propres principes, un **échec** — même populaire.

---

**Sources** : ITU 2024 ; OCDE 2025 ; Brookings (3ᵉ fossé) ; UNESCO (littératie IA) ; Learning Equality
(Kolibri). Détail : [bibliographie](../09-ANNEXES/01-bibliographie.md).
