# Personas & scénarios d'usage

> *Pour rendre Dowze concret : six personnes, six âges, six situations. Ces scénarios illustrent comment la
> [pile](../03-ARCHITECTURE/00-vue-ensemble-pile.md) sert des vies réelles et variées.*

---

## Lina, 4 ans (et sa mère Sofia) — la petite enfance

Lina ne touche pas de terminal. C'est **Sofia**, sa mère, qui utilise Dowze. Le Mentor lui propose chaque
semaine des idées d'éveil adaptées : jeux de langage, motricité, lecture partagée, gestion des grosses
colères. Sofia rejoint un **Foyer** de quartier où Lina joue avec d'autres enfants pendant que les parents
échangent. Dowze n'a jamais mis Lina devant un écran — il a outillé Sofia.
→ Couches mobilisées : **Mentor** (pour l'adulte), **Foyer**. Voir [petite enfance](../04-PARCOURS-DE-VIE/01-petite-enfance.md).

---

## Kofi, 10 ans — l'enfance, en zone peu connectée

Kofi vit dans un village sans connexion à domicile. Il apprend au **Foyer** (l'ancienne école du village,
équipée d'un serveur local type RACHEL). Le Mentor **allégé** fonctionne hors-ligne ; les contenus sont en
sa langue (branche locale de l'Atlas). Il mène des Quêtes ludiques avec son **Cercle** d'amis et un
animateur. Quand un agent de connectivité passe, son parcours se synchronise. Kofi progresse à son rythme,
sans être comparé aux autres.
→ Couches : **Atlas** (multilingue, offline), **Mentor léger**, **Quêtes**, **Cercle**, **Foyer**.
Voir [offline-first](../05-TECHNIQUE/05-offline-first.md) et [équité](../04-PARCOURS-DE-VIE/06-equite-inclusion.md).

---

## Maya, 16 ans — l'adolescence, esprit critique

Maya prépare une Quête : enquêter sur la qualité de l'air de son quartier et publier un rapport. Quand
elle demande au Mentor « donne-moi la réponse », il **refuse** et la questionne : « Quelles données
as-tu ? Comment vérifierais-tu cette source ? » Elle apprend à **douter de l'IA** elle-même (littératie
IA). Son rapport, évalué par son **Cercle** et un maître de la **Guilde** « Sciences citoyennes », génère
une **preuve** dans son Passeport. Le Mentor n'est jamais un « ami » — c'est un tuteur.
→ Couches : **Quêtes** (enjeu réel), **Mentor** (socratique, anti-délestage), **Guilde**, **Passeport**.
Voir [adolescence](../04-PARCOURS-DE-VIE/03-adolescence.md) et [délestage cognitif](../07-RISQUES-ETHIQUE/02-delestage-cognitif.md).

---

## Amina, 34 ans — l'adulte en reconversion

Amina, peu diplômée, veut devenir analyste de données. L'**Atlas** lui montre les passerelles depuis ce
qu'elle sait déjà (tableur). Le **Mentor** construit un chemin réaliste, par micro-Quêtes compatibles avec
son emploi. Elle bâtit le tableau de bord d'un commerce local (Quête à usage **réel**), validé par sa
**Guilde Data**. Son **Cercle** la soutient les soirs de fatigue. Six mois plus tard, un employeur vérifie
ses 14 preuves **en un clic** et l'embauche — sans diplôme.
→ Couches : toute la pile. Voir [âge adulte](../04-PARCOURS-DE-VIE/04-age-adulte.md) et
[Passeport](../03-ARCHITECTURE/05-preuve-passeport.md).

---

## Driss, 52 ans — le pivot de mi-carrière

Driss, ouvrier dont le métier se transforme, doit se requalifier. Habituellement, des gens comme lui
**décrochent** de la formation continue (OCDE). Dowze le cible activement via un **Foyer** près de son
usine, avec accompagnement humain renforcé. La redevabilité de son **Cercle** l'aide à tenir. Il valide
progressivement de nouvelles compétences, réutilisables immédiatement.
→ Couches : **Foyer**, **Cercle**, **Mentor**, **Passeport**. Illustre l'**équité adulte** (anti-effet
Matthew).

---

## Renée, 71 ans — l'âge mûr, transmettre

Renée, ébéniste retraitée, apprend l'aquarelle (nouvelle passion) **et** devient **maître de la Guilde
Menuiserie** : elle transmet un savoir-faire que ni les livres ni l'IA ne possèdent, enregistre des gestes,
mentore des jeunes. Dans un **Cercle trans-âges**, elle travaille avec un adolescent : il l'aide sur le
numérique, elle lui transmet la patience du bois. Son expérience devient un **trésor du commun**.
→ Couches : **Atlas** (apprendre), **Guilde** (transmettre), **Cercle trans-âges**. Voir
[âge mûr](../04-PARCOURS-DE-VIE/05-age-mur-vieillesse.md).

---

## Ce que ces scénarios montrent

1. **L'âge n'est pas une barrière** : de 4 à 71 ans, le même système, des usages adaptés.
2. **Le terminal est la porte, pas la pièce** : partout, l'humain (Foyer, Cercle, Guilde, mentor) est
   central.
3. **L'équité est concrète** : Kofi (rural), Amina (peu diplômée), Driss (décrocheur) sont servis en
   priorité, pas en dernier.
4. **La boucle Apprendre → Faire → Enseigner** boucle : Amina puis Renée deviennent à leur tour mentors.
5. **L'IA est un levier, jamais une béquille ni un compagnon** : Maya apprend à s'en méfier.
