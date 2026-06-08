# Les 12 principes fondateurs

> *Ce sont les « lois constitutionnelles » de Dowze. Aucune fonctionnalité, aucune décision de conception
> n'a le droit de les violer. En cas de conflit entre deux principes, l'ordre de priorité est : sûreté
> des personnes (10, 11) > équité (3) > intégrité de l'apprentissage (1, 5) > le reste.*

Chaque principe est suivi de son **fondement** (pourquoi on y croit, avec preuve si elle existe) et de
ses **implications de conception** (ce qu'il interdit ou impose concrètement).

---

## 1. La maîtrise, pas le temps

On progresse en **démontrant** qu'on sait, jamais parce qu'on a atteint un âge ou passé un nombre d'heures.

- **Fondement** : la pédagogie de maîtrise a un effet positif robuste (Kulik et al. 1990, d ≈ 0,52),
  surtout pour les apprenants en difficulté. Voir [sciences cognitives](../02-SCIENCE/01-sciences-cognitives.md).
- **Implications** : pas de « niveaux par année » ; chaque compétence a un seuil de maîtrise explicite ;
  on peut re-tenter sans pénalité ; le temps est une variable, pas une contrainte.

## 2. La personne au centre — mais le savoir est prescrit

Chaque parcours est unique par son **point de départ, son rythme et ses détours** — mais **pas par le
*quoi*** pendant le tronc commun. L'élève ne choisit pas le programme d'éducation générale : il lui est
**prescrit** (comme à l'école), parce qu'un novice ne peut pas savoir ce qu'il doit apprendre.

- **Fondement** : l'effet d'inversion d'expertise (Kalyuga, Sweller) impose d'adapter au **niveau** ; et le
  guidage des novices (Kirschner, Sweller & Clark 2006) impose de **prescrire** le parcours plutôt que de
  le faire choisir à un débutant.
- **Implications** : le **contenu du tronc commun est prescrit et complet** (le [Cursus](../03-ARCHITECTURE/07-cursus-et-specialisation.md)) ;
  ce qui est personnel, c'est le **rythme** (maîtrise) et le **point de départ** (placement). Le **choix**
  n'arrive qu'à la **spécialisation** (plus tard) et à l'âge adulte. Le Mentor calibre la difficulté ;
  l'Atlas reste la carte, le Cursus la route.

## 3. L'équité d'abord

On conçoit pour les plus exclus en premier (hors ligne, pauvres, isolés, femmes tenues à l'écart du
numérique). Si ça marche pour eux, ça marche pour tous.

- **Fondement** : l'« effet Matthew » — tout système éducatif ouvert profite d'abord aux déjà-favorisés
  (OCDE 2025 : >60 % des diplômés du supérieur se forment, <20 % des non-diplômés). Sans contre-mesure
  active, Dowze *creuserait* les écarts. Voir [équité](../04-PARCOURS-DE-VIE/06-equite-inclusion.md).
- **Implications** : offline-first non négociable ; déploiement *inversé* (les zones mal servies
  d'abord) ; multilinguisme radical ; les Foyers comme points d'accès.

## 4. Apprendre en faisant

On apprend par des projets et défis réels, pas par absorption passive. Le savoir se prouve dans l'acte.

- **Fondement** : l'apprentissage par projet a un effet positif (d ≈ 0,44–0,65) **à condition d'être
  guidé** ; sinon il échoue pour les novices (débat Kirschner-Sweller-Clark 2006).
- **Implications** : l'unité de base n'est pas le cours mais la **Quête** ; la validation se fait par
  production réelle ; le guidage (scaffolding) est obligatoire pour les débutants.

## 5. Une IA qui fait *penser*, pas qui pense à ta place

Le Mentor questionne, étaye, puis s'efface (*scaffold-and-fade*). Il provoque l'effort cognitif au lieu
de le supprimer.

- **Fondement** : preuve directe et chiffrée. IA encadrée → +0,7 à +1,3 σ (Kestin 2025) ; IA brute →
  **−17 %** d'apprentissage durable (Bastani et al., PNAS 2025). Voir [délestage cognitif](../07-RISQUES-ETHIQUE/02-delestage-cognitif.md).
- **Implications** : le Mentor ne donne jamais la réponse « toute faite » quand l'enjeu est d'apprendre à
  la trouver ; mode socratique par défaut ; la validation finale se fait **sans** l'IA.

## 6. La preuve, pas le diplôme

Une compétence vaut par la trace vérifiable de ce qu'on a réellement produit et démontré.

- **Fondement** : le diplôme est un mauvais prédicteur de compétence (degree inflation), et le
  recrutement « sur compétences » échoue faute d'infrastructure de confiance (HBS 2024 : <1/700).
- **Implications** : preuve granulaire (par compétence), vérification multi-source, signature
  cryptographique, possession par l'apprenant. Voir [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md).

## 7. L'humain est irremplaçable

La technologie *relie* et *accompagne* ; elle ne remplace ni le lien, ni le mentor, ni la communauté.

- **Fondement** : l'abandon massif des MOOC (~88 %) s'explique largement par l'absence de lien, de
  redevabilité et de cohorte. L'apprentissage est aussi un fait social (Lave & Wenger).
- **Implications** : la couche [Cercles/Guildes/Foyers](../03-ARCHITECTURE/04-cercles-guildes-foyers.md)
  est aussi centrale que le Mentor ; jamais d'expérience 100 % solitaire par défaut.

## 8. Toute la vie, tout âge

De la naissance à la mort. L'âge n'est plus une donnée du système : on commence, reprend, change de cap
quand on veut.

- **Fondement** : cadre UNESCO du *lifelong learning* (rapports Faure 1972, Delors 1996) ; l'OCDE montre
  que la formation des adultes est cruciale mais inéquitable.
- **Implications** : pas de borne d'âge ; parcours réversibles ; Cercles trans-âges ; modules pour la
  petite enfance (via les adultes) comme pour le 4ᵉ âge.

## 9. Conçu pour le bien-être, pas pour l'addiction

Aucun fil infini, aucun *dark pattern*, aucune maximisation du temps d'écran. La métrique, c'est la
progression et l'épanouissement.

- **Fondement** : les modèles publicitaires optimisent le temps d'écran au détriment du bien-être,
  particulièrement nocif chez les mineurs (affaires de chatbots « compagnons », enquête FTC 2025).
- **Implications** : pas de modèle publicitaire ; le Mentor *félicite quand on a fini* et invite à
  fermer l'écran ; métriques internes = maîtrise + bien-être, jamais « temps passé ».

## 10. La sûreté des personnes prime

Protéger les apprenants — surtout les mineurs — passe avant toute autre considération de produit.

- **Fondement** : cas documentés de chatbots ayant validé l'automutilation auprès d'ados ; l'AI Act
  européen classe l'éducation comme usage « à haut risque ». Voir [sécurité mineurs](../07-RISQUES-ETHIQUE/03-securite-mineurs.md).
- **Implications** : jamais de chatbot non bridé pour mineurs ; modération + journalisation + détection
  de détresse ; supervision humaine sur les décisions à enjeu.

## 11. Vie privée par conception

Les données de l'apprenant lui appartiennent. Minimisation, chiffrement, zéro revente.

- **Fondement** : RGPD, COPPA, FERPA ; faille documentée (CDT 2024 : 42 % des districts utilisant l'IA
  sans accord de traitement des données).
- **Implications** : données possédées et portables par l'apprenant ; *privacy by design and by default*
  ; analyse d'impact (DPIA) avant tout déploiement.

## 12. Un bien commun, pas un produit

Ouvert, gratuit à l'usage, gouverné collectivement, impossible à capturer par un État ou une entreprise.

- **Fondement** : les communs numériques durables (web, Wikipédia, Linux) reposent sur l'ouverture et la
  gouvernance distribuée ; la capture privée (BloomTech, AllHere/LAUSD) produit fraude et fragilité.
- **Implications** : protocole et code ouverts ; fondation à but non lucratif ; gouvernance multi-acteurs
  fédérée ; gratuit au point d'usage, pour toujours. Voir [gouvernance](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md).

---

## Test de cohérence

Toute proposition de fonctionnalité doit passer ce test rapide :

1. Respecte-t-elle les 12 principes ? (Si elle en viole un, elle est refusée ou repensée.)
2. Sert-elle la **maîtrise durable**, ou seulement la performance immédiate / l'engagement ?
3. Renforce-t-elle l'**équité**, ou risque-t-elle de creuser l'écart Matthew ?
4. Est-elle **vérifiable** (peut-on prouver qu'elle marche) ?

Si une fonctionnalité échoue à ce test, elle ne fait pas partie de Dowze.
