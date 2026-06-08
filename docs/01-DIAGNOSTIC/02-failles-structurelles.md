# Les six failles structurelles du système actuel

> *Ce ne sont pas des défauts d'exécution (un mauvais prof, une mauvaise école) mais des défauts de
> **structure** : ils découlent de la forme elle-même et persisteraient même avec des moyens illimités.*

---

## Vue d'ensemble

| # | Faille | Conséquence directe | Couche Dowze qui y répond |
|---|--------|---------------------|--------------------------|
| 1 | Le temps, pas la maîtrise | Lacunes invisibles qui s'accumulent | [Quêtes](../03-ARCHITECTURE/03-quetes.md) + maîtrise-barrière |
| 2 | Une taille unique pour tous | Personne n'est servi à son rythme | [Mentor](../03-ARCHITECTURE/02-mentor.md) |
| 3 | Le diplôme ≠ la compétence | Mauvais signal pour l'emploi | [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md) |
| 4 | Une éducation épisodique | On cesse d'apprendre trop tôt | [Parcours de vie](../04-PARCOURS-DE-VIE/) |
| 5 | Le lieu et l'âge comme barrières | Exclusion par naissance/horaires | [Atlas](../03-ARCHITECTURE/01-atlas.md) + offline-first |
| 6 | Un savoir qui se périme | Programmes en retard sur le réel | [Atlas vivant](../03-ARCHITECTURE/01-atlas.md) |

---

## Faille 1 — Le temps, pas la maîtrise

Dans la forme scolaire, **le temps est constant et la maîtrise variable** : tout le monde a 6 semaines
pour les fractions, puis on passe à la suite — qu'on ait compris ou non. Les élèves qui n'ont pas
maîtrisé accumulent une **dette invisible** : la notion suivante repose sur la précédente, mal acquise,
et l'écart se creuse silencieusement.

La pédagogie de maîtrise **inverse** ce rapport : la maîtrise est constante (~80-90 %) et le temps
variable. C'est exactement le principe 1 de Dowze. L'effet est robuste (d ≈ 0,52, Kulik et al. 1990),
surtout pour les apprenants en difficulté — précisément ceux que la forme actuelle abandonne.

> Le coût de cette faille est cumulatif et caché : on ne voit pas les lacunes au moment où elles se
> forment, seulement des années plus tard, sous la forme d'un « il/elle n'est pas fait·e pour les maths ».

---

## Faille 2 — Une taille unique pour tous

Une classe avance à un **rythme moyen** qui ne convient presque à personne : les plus rapides s'ennuient
(et se désengagent), les plus lents décrochent (et se découragent). C'est mécanique : un seul rythme pour
trente personnes ne peut pas être le bon rythme pour trente personnes.

La recherche le confirme par l'**effet d'inversion d'expertise** (Kalyuga, Sweller) : une même
instruction qui aide un novice *nuit* à un apprenant avancé. L'adaptation au niveau n'est donc pas un
confort, c'est une **nécessité cognitive**. Or seule une personnalisation — humaine (chère, rare) ou
assistée par IA (désormais possible) — peut l'offrir à grande échelle.

---

## Faille 3 — Le diplôme ≠ la compétence

Le diplôme atteste surtout d'un **temps passé** dans une institution et d'un **accès social** à cette
institution. Il prédit mal ce qu'une personne sait *faire*. Deux symptômes :

- **Degree inflation** : des emplois exigent un diplôme que leurs titulaires actuels n'ont pas (ex. 67 %
  des offres de « production supervisor » exigent un diplôme, alors que 16 % des gens en poste en ont un
  — *Dismissed by Degrees*, HBS 2017).
- **Le paradoxe 85 % / 1-sur-700** : les employeurs *disent* recruter sur compétences, mais ne le font
  quasiment pas — faute d'un moyen fiable de vérifier les compétences sans diplôme.

C'est le sujet du [chapitre suivant](04-crise-du-diplome.md), et la raison d'être du
[Passeport](../03-ARCHITECTURE/05-preuve-passeport.md).

---

## Faille 4 — Une éducation épisodique

Tout est concentré sur les ~20 premières années de la vie, puis ça s'arrête net — dans un monde qui
exige d'apprendre **en continu**. Or :

- les compétences se périment de plus en plus vite ;
- on change de métier plusieurs fois dans une carrière ;
- la formation des adultes est cruciale mais **inéquitable** : >60 % des diplômés du supérieur s'y
  forment, contre <20 % des non-diplômés du secondaire (OCDE 2025). « Ceux qui en ont le plus besoin sont
  les moins susceptibles d'en recevoir. »

Dowze supprime la borne d'âge : l'éducation devient un **continuum** de la naissance à la mort
(voir [Parcours de vie](../04-PARCOURS-DE-VIE/)).

---

## Faille 5 — Le lieu et l'âge comme barrières

Dans la forme actuelle, **où** vous êtes né, **quel âge** vous avez, et **quand** vous êtes disponible
déterminent largement votre accès au savoir. Une bonne école est une question de code postal ; reprendre
des études à 45 ans est un parcours du combattant ; un horaire de travail atypique vous exclut.

Dowze dissocie l'apprentissage du lieu (un terminal suffit, et hors ligne quand il le faut), de l'âge
(aucune borne) et du moment (asynchrone par défaut, synchrone par choix).

> ⚠️ Mais « un terminal suffit » se heurte au mur de la [fracture numérique](06-fracture-numerique.md) :
> c'est pourquoi l'équité est un *pilier de conception*, pas une promesse de fin de page.

---

## Faille 6 — Un savoir qui se périme

Un programme officiel met des années à être révisé et adopté ; certains champs (IA, biotech, métiers du
numérique) changent en **mois**. La forme scolaire est structurellement en retard sur le réel.

L'[Atlas](../03-ARCHITECTURE/01-atlas.md) répond par une **carte vivante** : co-curée par des
communautés d'experts et de praticiens, versionnée, mise à jour en continu — comme Wikipédia l'a fait
pour l'encyclopédie, mais pour les compétences.

---

## En synthèse

Ces six failles ne sont pas indépendantes : elles forment un **système cohérent** hérité d'une autre
époque. On ne les corrige pas une par une avec des rustines (plus de tablettes, plus d'heures, un nouveau
programme). On les corrige en changeant la **logique** — ce que propose l'[Architecture Dowze](../03-ARCHITECTURE/).
