# Concevoir un pilote crédible

> *Le pilote (phase 1) est le moment de vérité : il doit **prouver ou réfuter** l'efficacité, pas la
> supposer. Voici comment le concevoir pour qu'il soit honnête et concluant.*

---

## Les exigences d'un bon pilote

1. **Mesurer la maîtrise *durable*, pas la performance immédiate.** La leçon de Bastani (l'IA brute donne
   +48 % pendant l'usage mais −17 % à l'examen) impose de mesurer ce qui reste **après**, par un test
   différé **sans IA**.
2. **Essai contrôlé randomisé (RCT)** : comparer un groupe Dowze à un groupe témoin équivalent — c'est le
   seul moyen d'établir une **causalité** (modèle ASSISTments, Kestin, Bastani).
3. **Tester l'équité dès le départ** : inclure des publics mal servis et mesurer si **eux** progressent
   (pas seulement la moyenne).
4. **Surveiller la sûreté** : aucun incident mineurs, audit de biais, vie privée respectée.
5. **Résultats auditables et conservateurs** : pas de métriques gonflées (leçon BloomTech/École 42).

---

## Choisir le périmètre

**Un domaine × une région.** Critères de choix :

- **Domaine** : assez **structuré** pour être mesurable (ex. compétences numériques de base, maths
  fondamentales, lecture) — les domaines bien structurés sont ceux où le tutorat a fait ses preuves.
- **Région** : inclure **délibérément** des publics variés, dont des publics défavorisés/ruraux, pour
  tester l'équité et l'offline-first en conditions réelles (déploiement inversé dès le pilote).
- **Taille** : assez grande pour la puissance statistique, assez petite pour la qualité d'accompagnement.

---

## Le dispositif d'évaluation (esquisse)

```
   Population éligible
          │
          ▼  (randomisation)
   ┌──────────────┬──────────────┐
   ▼              ▼              ▼
 Groupe Dowze   Groupe témoin   (variantes : Mentor avec/sans
 (pile complète) (pratique       garde-fous, avec/sans Cercle…)
                  habituelle)
   │              │
   ▼              ▼
   Mesures : pré-test → usage → POST-TEST DIFFÉRÉ SANS IA
             + persévérance + équité de portée + bien-être + sûreté
```

**Variantes utiles** (pour isoler ce qui marche) :
- Mentor **avec vs sans** garde-fous (réplique Bastani — valider que les garde-fous protègent) ;
- **avec vs sans** Cercle (valider l'effet anti-décrochage de la couche humaine) ;
- **online vs offline-first** (valider que l'offline ne dégrade pas trop l'effet).

---

## Les indicateurs du pilote

(Détaillés dans [métriques & évaluation](03-metriques-evaluation.md).)

| Question | Indicateur |
|----------|-----------|
| Ça fait apprendre durablement ? | Gain de maîtrise au **post-test différé sans IA** |
| Les gens persévèrent ? | Taux de complétion vs référence MOOC (~12 %) |
| C'est équitable ? | Progression des **publics exclus** ; répartition des gains par sous-groupe |
| C'est sûr ? | Zéro incident mineurs ; audit de biais ; conformité vie privée |
| C'est sain ? | Indicateurs de bien-être (pas d'anxiété, pas de sur-usage) |
| C'est soutenable ? | Coût par apprenant |

---

## Critères de réussite (et d'échec) explicites

**Réussite** (→ passage en phase 2) :
- gain de maîtrise durable **statistiquement significatif** vs témoin ;
- persévérance **nettement supérieure** aux MOOC ;
- les publics exclus **progressent** (pas d'aggravation de l'effet Matthew) ;
- **aucune** alerte de sûreté ; biais sous contrôle.

**Échec / à itérer** (→ on ne passe PAS en phase 2) :
- pas de gain durable, ou gain réservé aux déjà-favorisés ;
- abandon comparable aux MOOC ;
- incident de sûreté ou biais non maîtrisé.

> **Engagement d'honnêteté** : les résultats du pilote — y compris négatifs — sont **publiés**. Un pilote
> qui réfute une hypothèse fait avancer la conception. C'est la culture du *learning engineering*, pas du
> marketing.

---

## Gouvernance du pilote

- **Évaluation indépendante** (pas d'auto-évaluation par les concepteurs — leçon des chiffres
  auto-déclarés d'École 42/BloomTech).
- **Comité éthique** : supervise sûreté des mineurs, vie privée, équité.
- **Co-conception avec les enseignants** locaux (anticiper la résistance — voir
  [risques projet](04-risques-projet.md)).
- **Consentement éclairé** des participants (et parental pour les mineurs).
