# Couche 2 — LE MENTOR · l'IA-tuteur personnel

> *Le problème résolu : offrir à **chacun** un accompagnement personnel (autrefois réservé à une élite) —
> **sans** tomber dans le piège de l'IA qui pense à votre place et vous laisse plus faible.*

---

## Le principe — et le danger

Le Mentor est un accompagnant personnel : patient, disponible jour et nuit, dans la langue de chacun, qui
connaît le parcours, les forces et les blocages de l'apprenant, et adapte chaque pas.

Mais — **point crucial, et c'est tout l'enjeu** — un mauvais Mentor IA est *dangereux*. La recherche 2025
est sans ambiguïté (voir [état de l'art IA](../02-SCIENCE/04-etat-art-IA-education.md) et
[délestage cognitif](../07-RISQUES-ETHIQUE/02-delestage-cognitif.md)) :

- IA **brute** (ChatGPT non encadré) : meilleure performance pendant l'usage, mais **−17 %** à l'examen
  une fois l'IA retirée (Bastani et al., *PNAS* 2025). Elle crée une **illusion de compétence**.
- IA **encadrée** (scaffolds, refus de donner la réponse) : **+0,7 à +1,3 σ** (Kestin et al. 2025).

> **Ce n'est pas l'IA qui est bonne ou mauvaise : c'est la forme de son intégration.** Le Mentor est donc
> défini par des règles strictes.

---

## Ce que le Mentor FAIT

- **Il questionne avant de répondre** (méthode socratique). Il fait *récupérer* en mémoire (effet test),
  formuler des hypothèses, expliquer son raisonnement.
- **Il étaie puis s'efface** (*scaffold-and-fade*) : beaucoup d'aide au début, de moins en moins ensuite,
  jusqu'à l'autonomie complète. **Le but du Mentor est de devenir inutile** sur chaque compétence.
- **Il calibre la difficulté** au bon niveau (« difficultés désirables » : assez dur pour faire grandir,
  pas assez pour décourager), en tenant compte de l'**effet d'inversion d'expertise**.
- **Il orchestre la révision espacée** (contre la courbe de l'oubli) pour ancrer durablement.
- **Il diagnostique les idées fausses** précisément, au lieu de répéter le cours.
- **Il enseigne à apprendre** (métacognition) : comment réviser, gérer son attention, sa motivation, son
  énergie — **en contexte**, dans le fil des Quêtes.
- **Il provoque** (au bon moment) : insère des questions/contradictions qui restaurent l'esprit critique
  (recherche Microsoft sur les « provocations », 2025).

---

## Ce que le Mentor NE FAIT JAMAIS

- ❌ Donner la réponse « toute faite » quand l'enjeu est d'apprendre à la trouver.
- ❌ Faire le travail à la place de la personne.
- ❌ Maximiser le temps passé : il **félicite quand on a fini** et invite à fermer l'écran (principe 9).
- ❌ Se substituer au lien humain : il *oriente* vers les Cercles, Guildes et Foyers (couche 4).
- ❌ Agir comme un « compagnon » affectif non bridé — interdiction stricte, surtout pour les mineurs
  (voir [sécurité des mineurs](../07-RISQUES-ETHIQUE/03-securite-mineurs.md)).

---

## Les garde-fous techniques

1. **Ancrage dans des sources (RAG)** : les réponses sont ancrées dans l'Atlas et des sources **citées et
   vérifiables**, pour contrer l'hallucination (~5-10 % d'énoncés faux pour un LLM brut).
2. **Transparence sur l'incertitude** : le Mentor signale ce qu'il ne sait pas, et cadre l'IA comme « un
   point de départ à vérifier », pas une autorité.
3. **La maîtrise finale se prouve SANS le Mentor** : la validation d'une compétence (couche 5) se fait par
   la **preuve de travail réel** et la vérification multi-source. *On ne peut pas valider une compétence en
   laissant l'IA penser à sa place* — ce qui rend le délestage cognitif **inopérant** pour tricher.
4. **Journalisation et supervision humaine** sur les enjeux élevés et pour les mineurs.
5. **Human-in-the-loop** : le Mentor *augmente* les mentors humains (couche 4), il ne les remplace pas.

---

## L'honnêteté sur ce qu'on sait et ne sait pas

- **Ce qui est prouvé** : un tuteur (humain ou ITS step-based) atteint d ≈ 0,76–0,79 ; une IA *encadrée*
  a produit un effet fort dans une étude (Kestin 2025).
- **Ce qui reste incertain** : l'effet de Kestin a été obtenu sur un petit échantillon d'étudiants très
  motivés, en **sessions surveillées**. Sa robustesse en **usage autonome de masse** n'est **pas encore
  prouvée**. Dowze le traite comme une hypothèse à valider par ses propres RCT (phase pilote).
- **Le « 2 sigma » n'est PAS la promesse** : voir [le mythe](../01-DIAGNOSTIC/03-mythe-2-sigma-et-verite-tutorat.md).

> Le Mentor est un pari **fondé**, pas une certitude. Sa conception en *scaffold-and-fade* + validation
> sans IA est précisément ce qui le distingue d'un chatbot, et ce qui le rend défendable.

---

## Le Mentor sur tout le cycle de vie

- **0-6 ans** : le Mentor coache les **adultes** (pas l'enfant), pour l'éveil et le jeu.
- **Enfance** : étaie beaucoup, autonomise progressivement ; forte articulation avec les Foyers.
- **Adolescence/adulte** : accompagne des projets profonds, des pivots de carrière, la métacognition.
- **Âge mûr** : soutient l'apprentissage continu *et* aide à structurer la transmission (devenir mentor).

Détail : [Parcours de vie](../04-PARCOURS-DE-VIE/). Spécification technique (architecture, modèle de
connaissance, prompts, sûreté) : [05-TECHNIQUE/03-conception-mentor-IA.md](../05-TECHNIQUE/03-conception-mentor-IA.md).

---

## Ce que le Mentor n'est pas

- ❌ Un chatbot qui répond à tout.
- ❌ Un substitut au professeur humain (c'est un *complément* qui réoriente vers l'humain).
- ❌ Un compagnon affectif.
- ❌ Une source d'autorité infaillible (il cite, doute, et renvoie à la preuve).

**Suite** : [les Quêtes](03-quetes.md), ce que le Mentor fait faire.
