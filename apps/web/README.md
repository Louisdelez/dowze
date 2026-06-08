# @dowze/web — frontend Next.js 15

Le portail élève/parent. **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4**, design
épuré façon Notion (calm technology), accessible.

## Pages

| Route | Contenu |
|-------|---------|
| `/` | Accueil — la promesse de Dowze, les piliers. |
| `/dashboard` | Tableau de bord : progression (BKT), plan du jour. |
| `/bridge` | **Le pont `.json`** : générer l'aller, coller le retour de l'IA, validation stricte. |

## Architecture

- **Design system** : tokens Tailwind v4 (`@theme` dans `globals.css`) — 1 couleur d'accent, neutres,
  whitespace généreux. Composants `ui/` (Button, Card) qu'on possède.
- **Server Components par défaut** ; `"use client"` seulement pour l'interactif (page du pont).
- **Client API** (`lib/api.ts`) vers le backend (`NEXT_PUBLIC_API_URL`).
- Réutilise les **types `@dowze/schemas`** (cohérence front/back).

## Développement

```bash
npm run dev -w @dowze/web      # next dev (http://localhost:3000)
npm run build -w @dowze/web    # next build (génère les pages statiques)
npm run typecheck -w @dowze/web
```

> Les écrans dynamiques (graphe, planning réel, validation par les pairs, espace parental) s'appuieront
> sur le backend `@dowze/api`. La page `/bridge` fonctionne dès que l'API tourne.
