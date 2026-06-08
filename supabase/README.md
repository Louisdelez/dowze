# Supabase — base de données de Dowze

Schéma **Postgres** versionné en SQL (migrations + seed). Local d'abord (Docker), prod cloud UE ensuite.

## Prérequis

- **Docker** (pour la stack locale).
- **Supabase CLI** : `npm i -g supabase` ou via [les instructions officielles](https://supabase.com/docs/guides/cli).

## Lancer en local

```bash
supabase start          # démarre Postgres + Auth + Realtime + Studio (Docker)
supabase db reset       # rejoue toutes les migrations + seed.sql (état déterministe)
```

`supabase start` affiche l'`API URL`, l'`anon key` et la `service_role key` → à reporter dans `.env`
(cf. [`.env.example`](../.env.example)).

## Structure

| Fichier | Contenu |
|---------|---------|
| `config.toml` | Config locale (ports, auth, realtime). |
| `migrations/0001_extensions_and_accounts.sql` | Extensions, comptes, profils, responsables légaux. |
| `migrations/0002_skill_graph.sql` | Compétences + prérequis (FK = zéro prérequis pendant) + `skill_closure()` (CTE récursive, anti-cycle). |
| `migrations/0003_learning.sql` | Maîtrise (BKT), cartes SM-2, créneaux, planning, présence. |
| `migrations/0004_cursus_and_validation.sql` | Expéditions + grilles + validations + file de revue par les pairs. |
| `migrations/0005_community.sql` | Classes, adhésions, canaux, messages, binômes. |
| `migrations/0006_moderation.sql` | Incidents, actions de modération, alertes parentales. |
| `migrations/0007_rls_policies.sql` | Row-Level Security (défense en profondeur). |
| `seed.sql` | Le socle de racines (compétences fondamentales) + une grille d'exemple. |

## Notes

- **Intégrité = pas de trou** : la clé étrangère `prerequisites.prerequisite_id → skills.id` interdit un
  prérequis pendant ; `skill_closure()` lit la chaîne complète (la loi de clôture est aussi vérifiée côté
  application par [`@dowze/core`](../packages/core)).
- **RLS = défense en profondeur** *sous* l'autorisation applicative NestJS. Le backend utilise la
  `service_role` (bypass RLS) ; les policies protègent l'accès direct navigateur.
- **Une seule source de vérité des migrations** : le CLI Supabase (ne pas mélanger avec l'ORM).
