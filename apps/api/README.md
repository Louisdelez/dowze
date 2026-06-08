# @dowze/api — backend NestJS (l'intra-core)

Monolithe modulaire NestJS sur le Postgres Supabase (Drizzle). **Aucun appel LLM côté serveur** :
l'IA est externe, l'échange se fait par fichier [`.json`](../../docs/10-APP-WEB/10-pont-json.md).

## Modules

| Module | Rôle |
|--------|------|
| `config` | Env validée par Zod (échoue tôt). |
| `db` | Client Drizzle sur Postgres Supabase (connexion paresseuse). |
| `skill-graph` | Lecture du graphe, **validation de la loi de clôture**, clôture transitive (`@dowze/core`). |
| `bridge` | **Pont `.json`** : génération de l'aller (prompt + JSON Schema + exemple) et validation stricte du retour. |
| `auth` | Garde JWT Supabase (autorisation applicative ; RLS = défense en profondeur). |
| `health` | Sonde de vivacité. |

## Endpoints (extrait)

| Méthode | Route | Effet |
|---------|-------|-------|
| `GET` | `/health` | État du service. |
| `GET` | `/skills` | Le graphe de compétences. |
| `GET` | `/skills/validate` | Vérifie la loi de clôture (zéro trou). |
| `GET` | `/skills/:id/closure` | La chaîne de prérequis d'une compétence. |
| `POST` | `/bridge/requests` | Construit le `.json` aller à coller dans l'IA. |
| `POST` | `/bridge/responses` | Valide le `.json` retour produit par l'IA. |

## Développement

```bash
npm run dev -w @dowze/api      # tsx watch (nécessite Postgres : supabase start)
npm run build -w @dowze/api    # tsc → dist/
npm run test -w @dowze/api     # vitest (parties pures)
```

> ⚠️ Exécuter le serveur nécessite Postgres (Supabase local via Docker) et, à terme, Redis. Le `build`,
> le `typecheck` et les tests unitaires des parties pures ne nécessitent pas la base.
