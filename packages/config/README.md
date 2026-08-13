# @dowze/config

Configurations partagées du monorepo Dowze.

- `tsconfig/base.json` — base TypeScript stricte, commune aux apps et plugins.

## Usage (nouvelles apps / plugins)

```jsonc
// apps/fitness/tsconfig.json
{
  "extends": "@dowze/config/tsconfig/base.json",
  "compilerOptions": { "...": "spécifique à l'app" }
}
```

> Les apps existantes (`apps/web`, `apps/api`) continuent d'étendre
> `../../tsconfig.base.json` (identique) — la migration vers `@dowze/config` est
> optionnelle et se fera sans casser le déploiement prod. ESLint/Tailwind
> partagés viendront s'ajouter ici au fil des phases (extraction de l'existant).
