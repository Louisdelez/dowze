# 05 · TECHNIQUE

> *Les spécifications. Comment construire concrètement chaque couche. Ces documents traduisent
> l'[architecture](../03-ARCHITECTURE/) en choix techniques — sans prétendre figer l'implémentation, mais
> en montrant que **chaque brique existe déjà**.*

| Fichier | Sujet |
|---------|-------|
| [01-architecture-technique.md](01-architecture-technique.md) | Vue d'ensemble système : composants, principes d'ingénierie, pile technique. |
| [02-modele-donnees-atlas.md](02-modele-donnees-atlas.md) | Le graphe de compétences : schéma, nœuds, liens, versionnage. |
| [03-conception-mentor-IA.md](03-conception-mentor-IA.md) | Le Mentor : modèle de connaissance, prompts, garde-fous, sûreté. |
| [04-passeport-verifiable-specs.md](04-passeport-verifiable-specs.md) | Le Passeport : W3C VC, Open Badges, vérification, anti-fraude. |
| [05-offline-first.md](05-offline-first.md) | Architecture hors-ligne, synchronisation, basse bande passante. |
| [06-interoperabilite-standards.md](06-interoperabilite-standards.md) | Standards ouverts, API, fédération, portabilité. |

---

## Principe d'ingénierie directeur

> **Ne rien réinventer qui existe déjà en standard ouvert et mûr.** Dowze *assemble* des standards
> éprouvés (ESCO/O*NET pour les compétences, W3C VC / Open Badges 3.0 pour la preuve, formats offline
> type Kolibri) plutôt que de créer des silos propriétaires.

Statut des briques (mûr / émergent / à éviter) : voir
[interopérabilité & standards](06-interoperabilite-standards.md).
