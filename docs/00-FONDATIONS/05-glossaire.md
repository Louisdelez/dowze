# Glossaire

Les termes propres à Dowze, et les concepts de recherche mobilisés dans la documentation.

---

## Les termes de Dowze

**Atlas** — La carte vivante, ouverte et fédérée de toutes les compétences humaines, structurée en graphe
(nœuds = compétences, liens = relations de prérequis/ouverture). Couche 1 de la pile.
Voir [Atlas](../03-ARCHITECTURE/01-atlas.md).

**Cercle** — Petit groupe de pairs (3 à 7) menant des quêtes voisines, avec redevabilité mutuelle.
L'antidote au décrochage. Couche 4.

**Compétence (nœud d'Atlas)** — Unité de savoir au sens large : savoir, savoir-faire, savoir-être,
capacité corporelle, civique ou esthétique. Chaque nœud a un seuil de maîtrise et des preuves attendues.

**Cursus** — L'**itinéraire complet et prescrit** à travers l'Atlas, que tout élève suit — un **programme
inventé** pour l'école 2.0 (ni copie d'un système national). Organisé non par matières mais par **1 finalité
(l'épanouissement), 3 fils (Fondations, Aptitudes durables, Concepts-clés) et 1 moteur (les Expéditions)**.
Deux phases : Tronc commun puis Spécialisation. L'Atlas est la *carte* ; le Cursus est la *route*. Voir
[le Cursus](../03-ARCHITECTURE/07-cursus-et-specialisation.md).

**Aptitudes durables** — Le **cœur du diplôme** : une taxonomie nommée d'aptitudes **transférables qui ne se
périment jamais** (en 6 familles : apprendre à apprendre, penser, créer, se relier, se gouverner, agir avec
sagesse). Évaluées par rubrique cumulée à travers les Expéditions. S'opposent aux **Modules-éclair**.

**Concepts-clés** — Un petit nombre d'**idées-seuils transdisciplinaires** (système, modèle, preuve,
causalité, échelle, pouvoir…) qui transforment la façon de voir et se transfèrent partout — enseignées à la
place de l'accumulation de faits.

**École générative** — Le principe selon lequel Dowze **ne stocke pas de contenu** (cours, grilles,
compétences détaillées — qui se périment) mais des **règles génératives intemporelles** + une **ossature
minimale** (graphe de compétences durables) + des **schémas**. L'IA **génère** le contenu à la demande,
toujours à jour. « L'usage infini de moyens finis ». Voir
[école générative](../03-ARCHITECTURE/09-ecole-generative.md).

**Règles génératives** — Le petit ensemble de règles intemporelles (cognitives, de conception, d'évaluation,
éthiques) qui pilotent la génération de tout contenu par l'IA. C'est le « code source » de l'école : on
gouverne et on améliore *les règles*, pas le contenu (jetable). Voir le **noyau de règles strictes (R1-R8)**.

**Loi de clôture** — La règle qui garantit **zéro trou** : générer une compétence = générer **toute sa
chaîne de prérequis jusqu'aux racines**. Une compétence n'est publiée que si tout ce dont elle dépend
existe. Le trou (prérequis manquant) devient **impossible par construction**. Cœur du
[noyau de règles strictes](../03-ARCHITECTURE/10-noyau-de-regles.md).

**Ossature (squelette)** — Le graphe **léger** de compétences durables + leurs prérequis, qui garantit
complétude et cohérence (des *relations*, pas du contenu). **Elle n'est PAS créée à la main : elle est
générée par l'IA** (prompt + `.json`), de façon **paresseuse** (le voisinage local à la demande), puis
**validée automatiquement** (graphe sans cycle, schéma, sources) et **mise en cache**. Les trous sémantiques
sont comblés par la **boucle d'usage** (un apprenant bloqué → régénération ciblée). C'est l'[Atlas](../03-ARCHITECTURE/01-atlas.md)
réduit à son squelette, lui-même génératif. Voir [école générative](../03-ARCHITECTURE/09-ecole-generative.md).

**Graine** — Le profil de l'élève + le contexte + la date, qui « ensemence » la génération : même graine →
même contenu (reproductible, équitable, auditable) ; graine différente → variante.

**Épanouissement (flourishing)** — La **finalité** du Cursus, qui remplace la note. Mesuré sur 3 piliers :
épanouissement présent (bien-être, sens, relations), maîtrise de transfert, caractère & socio-émotionnel.

**Expédition** — L'**unité d'apprentissage** (2-6 semaines) qui remplace le « cours » : un défi réel autour
d'une Grande Question, interdisciplinaire, suivant le gabarit **Étincelle → Question → Défi → Acte → Trace**.

**Fondations** — Le 1ᵉʳ fil du Cursus : les littératies prérequises (lire, écrire, compter, raisonner +
**littératie IA**), validées par maîtrise. Outils invisibles, pas buts finaux.

**Modules-éclair** — Les compétences **périssables** (un langage de code, un outil) apprises **juste-à-temps**
et **jetables** — hors du cœur du diplôme.

**Foyer** — Lieu physique ou virtuel de rencontre : bibliothèque, maison de quartier, atelier, ancienne
école reconvertie, salle en ligne. Sert la socialisation, le « faire » outillé, et l'accès des
non-connectés. Couche 4.

**Spécialisation** — La 2ᵉ phase du Cursus : après avoir maîtrisé le tronc commun (à l'adolescence
avancée), l'élève **choisit** un domaine à approfondir — comme une filière de lycée ou une majeure
d'université. Précédée d'une exploration et d'un accompagnement. C'est *le seul moment* où l'élève choisit
ce qu'il apprend.

**Tronc commun** — La 1ʳᵉ phase du Cursus : l'éducation générale complète, **prescrite** (l'élève ne choisit
pas le *quoi*), parcourue à son **rythme** (par maîtrise). ~9 domaines permanents + couches transversales,
inspirés du PER, du socle commun, de l'OCDE.

**Guilde** — Communauté de pratique autour d'un métier, d'un art ou d'un domaine. On y progresse de
novice à compagnon, maître, puis mentor (participation périphérique légitime). Couche 4.

**Maîtrise-barrière (*mastery gating*)** — Règle selon laquelle on ne valide une compétence qu'en la
*démontrant* (construire, résoudre, créer, performer, ou enseigner), jamais en cochant des cases.

**Mentor** — L'IA-tuteur personnel, conçu en *scaffold-and-fade* et en mode socratique : il questionne,
étaye, puis s'efface. Il ne pense jamais à la place de l'apprenant. Couche 2.
Voir [Mentor](../03-ARCHITECTURE/02-mentor.md).

**Dowze** — Le nom du système entier, et du commun qui le gouverne : le protocole ouvert
d'apprentissage humain, de la naissance à la mort.

**Passeport** — Registre vivant, portable et vérifiable des compétences réellement démontrées par une
personne. Remplace le diplôme. Granulaire, multi-source, signé cryptographiquement, auto-détenu. Couche 5.
Voir [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md).

**Quête** — L'unité d'apprentissage de base : un projet ou défi réel qui produit quelque chose de
tangible et exige la compétence visée. Remplace le « cours ». Couche 3.

**Socle** — La couche de gouvernance, financement, équité et sûreté qui porte tout le reste. Couche 6.

**Boucle Apprendre → Faire → Enseigner** — Le cycle d'ancrage : on apprend, on prouve par l'acte, puis on
enseigne (ce qui est à la fois la meilleure consolidation et le moteur de la communauté).

---

## Les concepts de recherche mobilisés

**Charge cognitive (théorie de la — Sweller)** — La mémoire de travail est limitée. On distingue la charge
*intrinsèque* (complexité du contenu), *extrinsèque* (mauvaise conception, à réduire) et *germane*
(construction de schémas). Voir [sciences cognitives](../02-SCIENCE/01-sciences-cognitives.md).

**Délestage cognitif (*cognitive offloading*)** — Externaliser un effort mental vers un outil. Avec l'IA,
le risque est de déléguer la *pensée* elle-même, érodant l'apprentissage durable. Le risque n°1 contre
lequel Dowze se conçoit. Voir [délestage cognitif](../07-RISQUES-ETHIQUE/02-delestage-cognitif.md).

**Difficultés désirables (Bjork)** — Des conditions qui ralentissent l'acquisition mais améliorent la
rétention long terme (espacement, entrelacement, récupération, génération, pratique variée). À doser
selon l'expertise (sinon « difficulté catastrophique »).

**Effet Matthew** — « À qui a, il sera donné. » Tendance d'un système ouvert à bénéficier d'abord aux
déjà-favorisés. Le risque d'équité central de Dowze.

**Effet protégé (*protégé effect*) / apprendre en enseignant** — Préparer ou délivrer un enseignement
améliore l'apprentissage de celui qui enseigne. Fonde la boucle Apprendre → Faire → Enseigner.

**Knowledge tracing (BKT/DKT)** — Modélisation de l'état de connaissance d'un apprenant pour prédire ses
réponses et adapter le parcours. Voir [conception du Mentor](../05-TECHNIQUE/03-conception-mentor-IA.md).

**Pédagogie de maîtrise (*mastery learning*)** — On ne passe à la suite qu'après avoir démontré la
maîtrise (~80-90 %) de l'unité courante. Fonde le principe « maîtrise, pas temps ».

**Participation périphérique légitime (Lave & Wenger)** — On apprend en participant pour de vrai, d'abord
à la périphérie d'une communauté, puis vers son cœur. Fonde les Guildes.

**Pratique de récupération (*retrieval practice* / effet test)** — Se tester (récupérer activement en
mémoire) renforce la rétention bien plus que la relecture. L'un des effets les mieux établis (g ≈ 0,5–0,7).

**Problème des 2 sigma (Bloom 1984)** — Affirmation célèbre (tuteur + maîtrise = +2 écarts-types) mais
**empiriquement infirmée**. À ne JAMAIS citer comme fait. Voir [démontage du mythe](../01-DIAGNOSTIC/03-mythe-2-sigma-et-verite-tutorat.md).

**Répétition espacée (*spaced repetition*)** — Réviser à intervalles croissants pour contrer la courbe de
l'oubli (Ebbinghaus). Très solide.

**Scaffold-and-fade (étayage dégressif)** — Beaucoup de soutien au début, retiré progressivement jusqu'à
l'autonomie. Principe de conception central du Mentor.

**Théorie de l'autodétermination (Deci & Ryan)** — Trois besoins psychologiques (autonomie, compétence,
appartenance) nourrissent la motivation intrinsèque. Fonde la conception anti-décrochage.

**Zone proximale de développement (ZPD — Vygotsky)** — L'écart entre ce qu'on fait seul et ce qu'on fait
avec aide. Cadre conceptuel (base empirique originelle faible, à présenter comme tel).

---

## Standards & sigles techniques

**CLR / LER** — *Comprehensive Learner Record* / *Learning and Employment Record* : standards (1EdTech)
d'agrégation des acquis d'apprentissage et d'emploi. Émergents.

**DID** — *Decentralized Identifier* (W3C) : identifiant contrôlé par l'utilisateur. Standard 2022 mais
fragmenté/contesté. Dowze peut s'en passer.

**ESCO / O*NET** — Référentiels publics de compétences (UE / USA), interopérables. Socle candidat pour
l'Atlas.

**Open Badges 3.0** — Standard de credential numérique (1EdTech, 2024), désormais bâti sur les VC du W3C.

**RAG** — *Retrieval-Augmented Generation* : technique ancrant les réponses d'un LLM dans des sources
vérifiées (anti-hallucination).

**VC** — *Verifiable Credentials* (W3C, modèle 2.0, standard mai 2025) : attestation signée
cryptographiquement, vérifiable sans recontacter l'émetteur. Socle technique du Passeport.
