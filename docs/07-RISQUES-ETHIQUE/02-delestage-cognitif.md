# Le délestage cognitif : le risque n°1

> *Le danger le plus grave et le plus documenté d'un système éducatif fondé sur l'IA : que l'IA pense à la
> place de l'apprenant et le laisse **plus faible** qu'elle ne l'a trouvé. Dowze se conçoit en grande
> partie **contre** ce risque.*

---

## Le phénomène

Le **délestage cognitif** (*cognitive offloading*) consiste à externaliser un effort mental vers un outil.
C'est parfois utile (une calculatrice). Mais avec l'IA générative, le coût de l'externalisation devient si
bas qu'on risque de déléguer la **pensée elle-même** — et donc de ne plus apprendre.

---

## Les preuves (2025) — accablantes mais à lire avec nuance

### MIT Media Lab — *Your Brain on ChatGPT* (2025)
- 54 participants, rédaction de dissertations, mesure **EEG**, 3 groupes (LLM / moteur de recherche /
  cerveau seul).
- Le groupe **LLM** montre la **connectivité cérébrale la plus faible** (moins d'effort mental).
- **>80 %** des utilisateurs du LLM **incapables de citer une phrase de leur propre dissertation** juste
  après l'avoir « écrite ».
- Les auteurs parlent de **« dette cognitive »** : encodage superficiel, faible rétention.
- ⚠️ *Limites* : petit échantillon, étude non encore relue par les pairs, une seule tâche.

### Microsoft Research / Carnegie Mellon (CHI 2025)
- 319 travailleurs du savoir, 936 tâches réelles assistées par IA.
- Effort cognitif déclaré **réduit de 55 % à 79 %** selon la tâche.
- **Plus de confiance dans l'IA = moins de pensée critique** ; plus de confiance en soi = plus d'esprit
  critique.

### Gerlich (2025)
- Enquête, n=666 : **corrélation négative** entre usage fréquent de l'IA et pensée critique, **médiée par
  le délestage cognitif**. Les **17-25 ans** sont les plus touchés. Le niveau d'études est **protecteur**.
- ⚠️ *Limite* : corrélationnel (ne prouve pas la causalité).

### Bastani et al. — *PNAS* 2025 (la preuve causale)
- ~1 000 lycéens. ChatGPT **brut** : +48 % pendant l'usage, mais **−17 % à l'examen** une fois l'IA
  retirée (vs groupe sans IA). L'IA encadrée **neutralise** ce mal.
- C'est le résultat le plus important : l'IA brute crée une **illusion de compétence** et **détruit**
  l'apprentissage durable.

> **Conclusion** : le clivage décisif n'est pas IA / pas-IA, mais **IA-béquille vs IA-levier** — et c'est
> un choix de **design**, pas de technologie.

---

## Comment Dowze se conçoit contre le délestage

C'est inscrit dans toute l'architecture, pas ajouté après coup :

| Mécanisme | Où | Effet |
|-----------|-----|-------|
| **Le Mentor questionne avant de répondre** (socratique) | [Mentor](../03-ARCHITECTURE/02-mentor.md) | force la récupération et l'effort |
| **Scaffold-and-fade** : l'aide se retire | Mentor | vise l'autonomie, pas la dépendance |
| **Refus de la réponse directe** quand l'enjeu est d'apprendre | Mentor | empêche le « copier-coller mental » |
| **Provocations** (questions/contradictions) | Mentor | restaure l'esprit critique (recherche Microsoft 2025) |
| **VALIDATION SANS IA** : la maîtrise se prouve par l'acte | [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md) | rend le délestage **inopérant pour tricher** |
| **Littératie IA** enseignée (quand l'IA aide vs nuit) | [Atlas](../03-ARCHITECTURE/01-atlas.md) | forme un usage « levier » |
| **Exercices/épreuves sans IA** périodiques | Quêtes | entretient les compétences de base (anti-deskilling) |
| **Mesure de la maîtrise *durable*** (test différé sans IA) | [métriques](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md) | détecte l'illusion de compétence |

**Le verrou décisif** : *on ne peut pas valider une compétence en laissant l'IA penser à sa place*, parce
que la validation passe par un travail réel, évalué par des humains (pairs, Guilde) et parfois en épreuve
observée. Le délestage ne permet donc pas de « passer » — il ne fait perdre que celui qui le pratique.

---

## Le risque résiduel (honnêteté)

- Un apprenant **déterminé à se délester** peut toujours mal utiliser l'IA hors Dowze. Dowze ne peut pas
  l'en empêcher totalement ; il peut le **décourager par conception** et le **former** à un meilleur usage.
- L'effet protecteur du design est **plausible et fondé** (Bastani montre que les garde-fous neutralisent
  le mal), mais la robustesse en **usage autonome de masse** reste à prouver par les RCT de Dowze.
- Le deskilling structurel (Aalto 2025) reste un risque de société qui dépasse Dowze — d'où l'importance de
  la littératie IA comme compétence civique.

> Nous ne prétendons pas « résoudre » le délestage cognitif pour l'humanité. Nous prétendons concevoir un
> système qui, contrairement à l'IA brute, **n'aggrave pas** le problème et œuvre activement contre lui —
> et qui le **mesure** pour ne pas se mentir.

**Sources** : MIT Media Lab 2025 ; Lee et al. (CHI 2025) ; Gerlich 2025 ; Bastani et al. (PNAS 2025) ;
Aalto 2025 (deskilling). Détail : [bibliographie](../09-ANNEXES/01-bibliographie.md).
