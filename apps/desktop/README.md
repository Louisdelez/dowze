# Dowze Académie — Desktop (Tauri v2)

Application de bureau (Windows / macOS / Linux) qui embarque **l'intégralité de Dowze Académie**,
strictement identique au web, dans une coque native — plus des **outils locaux** que le navigateur
ne peut pas offrir (recherche web sans clé, etc.).

## Architecture

- **Frontend** = l'application Dowze existante (`apps/web`), chargée telle quelle. En v1 elle est
  servie depuis `https://academie.dowze.ch` (toujours à jour, aucune divergence avec le web).
  L'app web reste **inchangée**.
- **Backend Rust** (`src-tauri/`) = la coque + les **outils locaux** exposés au frontend via
  `invoke(...)`. L'accès IPC est accordé à l'origine `*.dowze.ch` (voir `capabilities/default.json`).

## Outils locaux (sans aucune clé API)

Définis dans `src-tauri/src/tools.rs`, appelables depuis le frontend :

| Commande | Rôle |
|---|---|
| `web_search(query, engine?)` | Recherche web. **SearXNG** si `DOWZE_SEARXNG_URL` est défini (auto-hébergé, open-source), sinon repli **DuckDuckGo** (HTML). |
| `wikipedia_search(query, lang?)` | Recherche encyclopédique via l'API officielle Wikipédia (fiable, scolaire). |
| `desktop_info()` | Diagnostic (version, OS, outils dispo). |

Exemple côté frontend (JS) :

```js
const results = await window.__TAURI__.core.invoke('web_search', { query: 'photosynthèse' });
// [{ title, url, snippet, source }]
```

### Activer SearXNG (optionnel, recherche web « premium » locale)

SearXNG est un métamoteur open-source auto-hébergeable, **sans clé**. Lancer une instance (Docker),
puis exporter son URL avant de démarrer l'app :

```bash
export DOWZE_SEARXNG_URL="http://127.0.0.1:8888"
```

Sans cette variable, `web_search` retombe automatiquement sur DuckDuckGo.

## Développement

Pré-requis Linux : `webkit2gtk-4.1`, `librsvg2`, Rust stable. (Déjà présents sur la machine de dev.)

```bash
cd apps/desktop
cargo tauri dev      # ouvre la fenêtre sur academie.dowze.ch
cargo tauri build    # produit les installeurs (AppImage/deb/rpm, .msi, .dmg selon l'OS)
```

## Feuille de route

- **v1 (fait)** : coque native + Dowze Académie complète (remote) + outils `web_search` / `wikipedia_search`.
- **Suivant** : pont frontend↔outils (bouton/recherche dans l'UI, puis un outil « recherche_web » côté
  compagnon *client* en desktop) ; option **build embarqué** (export statique de `apps/web` derrière
  `DESKTOP_BUILD=1`) pour un démarrage plus rapide et un mode hors-ligne partiel ; SearXNG en conteneur.
