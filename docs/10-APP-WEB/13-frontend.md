# Frontend — UI/UX, design system, architecture

> *L'interface : moderne, **simple, épurée, ergonomique**. Stack de production, design system Notion-like,
> code modulaire à fichiers courts. Vue d'ensemble : [stack de production](12-stack-production.md).*

---

## La stack frontend

**Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui.** Le standard de
production : Next.js est le seul framework avec des **Server Components** pleinement prêts pour la prod
(utilisé par Spotify, Netflix, Twitch…) ; **shadcn/ui copie le code des composants dans le projet** (on les
possède, modifiables, zéro runtime, accessibles via Radix).

```
npx create-next-app@latest --ts --tailwind --eslint --app
npx shadcn@latest init
```

---

## Le design system : `getdesign add notion`

⚠️ **À comprendre exactement** : `npx getdesign@latest add notion` n'installe **pas** de composants. Il
écrit un fichier **`DESIGN.md`** à la racine — une **charte de design system épurée façon Notion** (couleurs,
typographie, échelle d'espacement 4px, profondeur, motion, patterns) **destinée à être lue par l'agent de
code** (Claude Code, etc.). C'est un *brief de design*, pas du code exécutable.

> ⚠️ Ne pas confondre avec le projet homonyme `getdesign.app` (extraction de design depuis une URL, non
> encore livré). Ta commande correspond bien au CLI `getdesign` (npm) qui distribue des `DESIGN.md`.

**Le workflow** :
1. `npx getdesign@latest add notion` → génère `DESIGN.md` (la direction visuelle : *warm minimalism*,
   surfaces douces, peu de couleurs, pas de gradients/ombres agressives, contenu d'abord).
2. L'agent **mappe `DESIGN.md` sur les tokens shadcn/Tailwind** (variables CSS dans `globals.css`,
   `components.json`).
3. **shadcn = les briques de code** ; **`DESIGN.md` = la charte**. Complémentaires, pas concurrents.

> NB : le `DESIGN.md` est un point de départ — la direction finale doit refléter **la marque Dowze**, pas
> copier Notion à l'identique.

---

## Principes d'UI/UX : épuré, ergonomique, calme

Une app d'apprentissage doit favoriser le **focus et le bien-être** — pas capter l'attention. On applique
explicitement :

- **Calm technology** (Weiser ; Amber Case, 9 principes) : la techno demande le **minimum d'attention**,
  informe sans submerger. *« Le bon niveau de techno est le minimum nécessaire. »*
- **Design content-first façon Notion** : whitespace généreux, typographie sobre (corps 16px), 1 couleur
  d'accent + neutres, hiérarchie claire, **complexité progressive** (on révèle peu à peu).
- **Lois d'UX** : Hick (réduire les choix), Fitts (cibles généreuses, surtout mobile), Miller (chunker
  l'info), Jakob (cohérence stricte entre toutes les pages), **charge cognitive minimale**, **divulgation
  progressive**.
- **Zéro dark pattern** ([principe 9](../00-FONDATIONS/03-principes-fondateurs.md)) : pas de fil infini, pas
  de série anxiogène, pas de FOMO, pas de notifications culpabilisantes. Notifications **discrètes et
  opt-in**. (Cohérent avec [planning & régularité](11-planning-regularite.md).)

> Objectif explicite de l'interface : **focus + sérénité**. Le contenu pédagogique d'abord, le chrome au
> minimum.

---

## Accessibilité : WCAG 2.2 niveau AA (non négociable)

App éducative inclusive, avec des mineurs → **WCAG 2.2 AA** comme base.

- **Contraste** : texte ≥ **4.5:1** (grand texte ≥ 3:1), focus visible ≥ 3:1. ⚠️ Le minimalisme low-contrast
  (gris clair sur blanc) casse cette règle — à valider dans les tokens.
- **Clavier** : tout accessible au clavier ; focus jamais masqué (critère 2.4.11).
- **Cibles tactiles** ≥ 24px (idéalement 44px mobile) ; *Accessible Authentication* sans test cognitif
  (important pour mineurs).
- **ARIA** : shadcn/Radix est accessible par défaut → **préserver** l'ARIA lors des personnalisations.
- Audit automatisé (axe / Lighthouse) **+ tests manuels** (NVDA / VoiceOver).

---

## Architecture frontend (fichiers courts, maintenable)

**Organisation par feature** (pas par type), composants petits, logique dans les hooks, **Server Components
par défaut** (`"use client"` seulement si interactif).

```
src/
  app/                     # routes App Router (RSC par défaut)
  features/
    expeditions/
      components/          # présentation (petits, "use client" si interactif)
      hooks/               # logique (useExpeditions + TanStack Query)
      api/                 # server actions / appels
      schema.ts            # Zod (source de vérité, partagée avec le backend)
      types.ts
    planning/  validation/  community/  ...
  components/ui/           # shadcn/ui (briques génériques)
  lib/                     # utils, clients (supabase, query)
```

Règles : JSX mince, logique dans les hooks, **fichiers courts (une responsabilité)**, pas de « barrel files »
qui cassent le tree-shaking.

---

## Performance

Piloter par les **Core Web Vitals** (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1).

- **Server Components** (moins de JS client) + **streaming SSR** (premier rendu rapide).
- **Code splitting** automatique + `dynamic()` pour les vues lourdes (éditeur, graphiques).
- **`next/image`** (resize, lazy, responsive) et **`next/font`** (anti-CLS).
- ⚠️ Trop de `"use client"` annule le bénéfice RSC.

---

## PWA & offline-first

App **installable**, **mobile-first**, utilisable **hors-ligne** (réviser sans connexion = vrai atout).

- **Serwist** (service worker) + **IndexedDB** (stockage local) + sync au retour réseau.
- Cache **« Cache First »** pour les contenus de cours, **« Network First »** pour les données.
- `manifest.json`, HTTPS obligatoire ; tester tôt sur **iOS/Safari** (le maillon faible des PWA).
- ⚠️ Les appels à l'IA externe (pont `.json`) nécessitent le réseau → prévoir un état hors-ligne gracieux.

---

## State & formulaires

- **Server state = TanStack Query** ; **client/UI state = Zustand**. Règle d'or : **ne jamais stocker des
  données serveur dans Zustand**. En App Router, le rendu initial vient des **Server Components** ; TanStack
  pour l'interactif/mutations.
- **Formulaires = react-hook-form + Zod**. Les **schémas Zod sont partagés avec le backend** (une seule
  source de vérité — formulaire, validation serveur, typage, et validation du [pont `.json`](10-pont-json.md)).
  Toujours **re-valider côté serveur** (un client peut contourner la validation front).

---

## Synthèse frontend

Next.js App Router + Tailwind v4 + shadcn/ui ; direction visuelle via **`DESIGN.md` (getdesign notion)**
mappé sur les tokens ; UI **épurée, calme, sans dark pattern** ; **WCAG 2.2 AA** ; architecture
**feature-based à fichiers courts**, RSC par défaut ; perf via RSC/streaming/`next/image` ; **PWA offline** ;
TanStack + Zustand ; **RHF + Zod** (schéma partagé back).

**Sources** : Next.js / shadcn docs ; getdesign (npm) & getdesign.md ; Laws of UX ; Calm Technology (Case) ;
W3C WCAG 2.2 ; TanStack Query ; Serwist ; Core Web Vitals. Détail : [bibliographie](../09-ANNEXES/01-bibliographie.md).
