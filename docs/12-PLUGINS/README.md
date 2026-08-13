# 12 — Plugins : Dowze comme plateforme de style de vie

> Dowze n'est pas qu'une académie : c'est un **style de vie et une manière de penser**. Les **plugins**
> sont des applications satellites (`fitness.dowze.ch`, `sports.dowze.ch`, `alimentations.dowze.ch`…),
> développées **uniquement par l'équipe Dowze**, qui réutilisent le cœur de Dowze — identité, IA, RAG,
> philosophie, et surtout le **planning/calendrier** — pour faire coexister l'étude, le corps et
> l'alimentation dans un seul emploi du temps orchestré par l'IA.

Ce dossier est le **cahier des charges et le plan d'implémentation** de la plateforme de plugins, fondé
sur 3 recherches sourcées (juillet 2026).

| Doc | Contenu |
|-----|---------|
| [00-vision-plateforme.md](00-vision-plateforme.md) | Dowze = super-app à cœur partagé ; croissance verticale ; la philosophie comme fil rouge. |
| [01-architecture-plugins.md](01-architecture-plugins.md) | Modèle « first-party extensions » : manifest, API versionnée + scopes, contribution « source + projection », registre, isolation par schéma, SSO `.dowze.ch`, gateway, monorepo, AppLauncher. |
| [02-contrat-planning-recurrent.md](02-contrat-planning-recurrent.md) | Comment un plugin déclare une **activité récurrente** et comment l'orchestrateur de Dowze l'intègre au planning (contraintes dures/souples, habitudes, non-punitif). |
| [03-plugins-fitness-sport-alimentation.md](03-plugins-fitness-sport-alimentation.md) | Spéc des 3 premiers plugins. |
| [04-plan-implementation.md](04-plan-implementation.md) | Plan phasé (P0 → P5), livrables, ordre, risques. |

**Principe directeur (une phrase)** : Dowze est une **super-app à cœur partagé** (identité Supabase + IA/RAG
+ profil + planning) ; les plugins sont des **apps first-party autonomes**, isolées par frontière réseau +
schéma de données, décrites par un **manifest déclaratif**, consommant une **API versionnée à scopes en
moindre privilège**, et contribuant aux features du cœur (dont le calendrier) **par API + événements,
jamais en touchant sa base**.
