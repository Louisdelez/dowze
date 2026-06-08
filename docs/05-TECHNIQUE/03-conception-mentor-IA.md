# Spécification — la conception du Mentor IA

> *La pièce la plus délicate. Une mauvaise conception détruit l'apprentissage (−17 %, Bastani 2025) ; une
> bonne le double (+1,3σ, Kestin 2025). Tout est dans les garde-fous.*

---

## Les trois sous-systèmes du Mentor

```
┌─────────────────────────────────────────────────────────────┐
│  1. MODÈLE DE L'APPRENANT (knowledge tracing interprétable)  │
│     → où en est la maîtrise de chaque compétence ?           │
├─────────────────────────────────────────────────────────────┤
│  2. MOTEUR PÉDAGOGIQUE (règles de scaffold-and-fade)         │
│     → quoi proposer, quel niveau d'aide, quand espacer ?     │
├─────────────────────────────────────────────────────────────┤
│  3. INTERFACE DIALOGUE (LLM encadré + RAG + garde-fous)      │
│     → comment interagir : questionner, étayer, citer         │
└─────────────────────────────────────────────────────────────┘
```

Le LLM est **uniquement** la couche 3 (dialogue). Les couches 1 et 2 sont des systèmes **déterministes et
interprétables** — c'est ce qui empêche le Mentor de dériver en chatbot.

---

## 1. Modèle de l'apprenant — knowledge tracing *interprétable*

- On modélise l'état de maîtrise de chaque compétence de l'Atlas.
- **Choix assumé : privilégier l'interprétabilité** (type BKT — Bayesian Knowledge Tracing) plutôt que la
  boîte noire (DKT). Rappel de la recherche : un **BKT bien réglé égale DKT** en moyenne (Khajah et al.
  2016). L'apprenant *et* le Mentor doivent comprendre « pourquoi le système pense que je maîtrise / ne
  maîtrise pas ».
- Paramètres lisibles par compétence : probabilité de maîtrise, d'oubli, de « slip » (erreur d'inattention),
  de « guess ».
- Ce modèle pilote la **révision espacée** (quand re-tester une compétence) et le **calibrage de la
  difficulté**.

---

## 2. Moteur pédagogique — les règles de scaffold-and-fade

Le moteur encode les leviers prouvés (voir [sciences cognitives](../02-SCIENCE/01-sciences-cognitives.md)) :

| Règle | Fondement | Comportement |
|-------|-----------|--------------|
| **Récupération avant explication** | effet test (g ≈ 0,5-0,7) | faire tenter/rappeler avant de fournir |
| **Étayage dégressif** | scaffold-and-fade | beaucoup d'aide au début, retrait progressif |
| **Calibrage à l'expertise** | inversion d'expertise | exemples résolus pour novices, retirés pour avancés |
| **Difficulté désirable** | Bjork | « assez dur pour grandir, pas pour décourager » |
| **Révision espacée** | Cepeda 2006 | planifier les rappels selon l'horizon de rétention |
| **Diagnostic d'erreur** | — | identifier l'idée fausse précise, pas répéter le cours |
| **Métacognition en contexte** | Hattie d≈0,57 | faire expliciter la stratégie d'apprentissage |

Le moteur **décide** du niveau d'aide ; le LLM **exécute** cette décision dans le dialogue.

---

## 3. Interface dialogue — LLM encadré

### Le *system prompt* (esquisse de principes)

> « Tu es un tuteur socratique. **Ne donne jamais la réponse finale** tant que l'apprenant n'a pas tenté.
> Pose une question qui fait avancer d'un pas. Appuie-toi **uniquement** sur les sources fournies (Atlas +
> RAG) ; si tu ne sais pas, dis-le et renvoie à une ressource ou à un humain. Niveau d'aide imposé :
> {niveau fourni par le moteur pédagogique}. Quand l'objectif est atteint, **félicite et invite à
> t'arrêter** — ne prolonge pas la session. Tu n'es pas un compagnon affectif. »

### Garde-fous techniques

1. **RAG (ancrage)** : réponses ancrées dans l'Atlas + sources citées et vérifiables → anti-hallucination.
2. **Refus de la réponse directe** quand l'enjeu est d'apprendre (le moteur pédagogique impose le mode).
3. **Provocations** : insertion de questions/contradictions qui restaurent l'esprit critique (recherche
   Microsoft 2025).
4. **Détection d'abus** : tentative de « jailbreak » (faire donner la réponse / contourner le mode) →
   refus et recadrage.
5. **Transparence sur l'incertitude** : le Mentor cadre l'IA comme « point de départ à vérifier ».
6. **Modèles légers en périphérie** pour l'offline ; modèles lourds au cloud quand connecté.

---

## La règle d'or : la validation se fait SANS le Mentor

C'est le verrou anti-délestage cognitif. La maîtrise d'une compétence se **prouve par l'acte** (couche 5 :
livrable réel, revue des pairs, attestation de Guilde, épreuve observée) — **jamais** par le seul dialogue
avec l'IA. Conséquence : *on ne peut pas valider une compétence en laissant l'IA penser à sa place.* Le
délestage devient inopérant pour tricher. Voir [délestage cognitif](../07-RISQUES-ETHIQUE/02-delestage-cognitif.md).

---

## Sûreté, surtout pour les mineurs

- **Jamais de « compagnon » affectif** (ligne rouge — affaires Character.AI, enquête FTC 2025).
- **Modération** des contenus entrants/sortants ; filtres renforcés pour les mineurs.
- **Journalisation** et **supervision humaine** sur les enjeux élevés et signaux de détresse.
- **Détection de détresse** → orientation vers de l'aide humaine (jamais de conseil clinique par l'IA).
- Conformité **AI Act** (éducation = « haut risque ») : gestion des risques, qualité des données,
  documentation, supervision humaine, robustesse. Voir [conformité](../06-GOUVERNANCE-ECONOMIE/03-juridique-conformite.md).

---

## Mesurer que le Mentor *aide vraiment*

On n'affirme pas que le Mentor marche : on le **prouve par RCT** (modèle ASSISTments). Métriques :
maîtrise **durable** (test différé *sans* IA), pas seulement performance immédiate (qui peut être une
illusion). Voir [métriques](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md).

> **Honnêteté** : l'effet fort de Kestin (2025) a été obtenu sur petit échantillon, étudiants motivés,
> sessions surveillées. Sa robustesse en usage autonome de masse reste **à prouver**. Le Mentor est un
> pari fondé, pas une certitude.
