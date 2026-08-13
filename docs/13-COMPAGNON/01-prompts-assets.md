# Génération d'images IA — guide COMPLET (ChatGPT / Codex) pour les assets du jeu

> **Référence exhaustive (A→Z).** Tout ce qu'il faut savoir pour générer les sprites du jeu isométrique du
> compagnon (meubles, objets, nourriture, sols, murs…) via **ChatGPT (app web)** et **Codex**, sans API.
> Compile la recherche 2025-2026. Outil associé : **dev.dowze.ch** (`apps/dev`) qui sert ces prompts + noms + suivi to-do.
> Style visé : cozy retro pixel, isométrique 2.5D, fond transparent.
> ⚠️ La génération se fait dans **ChatGPT (app web)**. **Codex ne génère pas d'images** (il reçoit des images en entrée
> seulement — détails §14). Donc en pratique : **ChatGPT web** pour tout créer.
>
> 🔧 **Pipeline alternatif (pro, reproductible)** : voir [`02-comfyui-pipeline.md`](02-comfyui-pipeline.md) — génération
> via **ComfyUI** avec **LoRA de style** (cohérence), **tiling** (textures seamless) et **LayerDiffuse** (props
> transparents). On y réutilise **les mêmes prompts** que ci-dessous.

---

## SOMMAIRE
1. Modèles & surfaces (ChatGPT web, Codex, gpt-image-1/1.5/2)
2. Comment accéder à la génération d'image
3. Principes de prompting (les 6 règles)
4. Fond transparent — la méthode fiable + vérification + secours
5. Cohérence d'une grande série (l'ancre)
6. Angle isométrique
7. Style cozy retro pixel
8. Édition & variantes (couleurs, dérivés)
9. Résolution / format / sortie
10. Modes d'échec & correctifs
11. **Les MEILLEURS prompts (templates prêts à copier)**
12. **Workflow complet A→Z pour une série (139 assets)**
13. Outils gratuits
14. Codex — génération d'images (spoiler : Codex ne génère pas d'images)
15. Sources

---

## 1. Modèles & surfaces

L'outil image de ChatGPT/Codex utilise le **modèle image natif d'OpenAI** (famille `gpt-image`). Ce qui change selon le modèle :

| Modèle | Sortie | Fond transparent | Fidélité référence |
|---|---|---|---|
| `gpt-image-1` (avr. 2025) | RGBA PNG | **Oui** | non |
| `gpt-image-1.5` (déc. 2025) | RGBA PNG | **Oui** | `input_fidelity:"high"` |
| `gpt-image-2` (2026) | — | **Non** (via API) | forcée haute |

**Où tu génères — l'application de bureau ChatGPT (Mac/Windows).** Depuis le **9 juillet 2026, Codex a été fusionné
dans l'app de bureau ChatGPT** → une seule app, plusieurs modes :
- **Chat ChatGPT** (chat classique) : **C'EST LÀ que tu génères tes images** — identique au web (même moteur GPT Image,
  **Projets**, **glisser-déposer d'image de référence**, **clic-droit → enregistrer le PNG**). Toute la doc (§1-13) s'applique ici.
- **Codex** (agent de code) : **ne génère PAS d'images** (§14). C'est pour coder.
- **Mode Agent** (ex-« Operator » + deep research) et **ChatGPT Work** (juil. 2026 : docs/slides/tableurs) : **c'est ça,
  l'équivalent « co-work / PM »** (pas Codex). Ce ne sont **pas** des outils de génération de sprites → ne pas les utiliser pour ça.
- **Projects / Canvas / Tasks** : organisation, édition côte-à-côte, actions planifiées.
→ Pour tes sprites : **mode Chat**, dans un **Project**, avec l'ancre en référence.

⚠️ **Piège transparence (important)** : `gpt-image-1` / `gpt-image-1.5` font le **vrai** fond transparent, mais
**`gpt-image-2` NE le supporte PAS** (doc OpenAI). Si l'app de bureau route par défaut vers le modèle le plus récent, ta
demande de fond transparent peut **ne pas** donner de vraie couche alpha → **vérifie chaque PNG (§4)** et détoure en secours (remove.bg).

- **App web ChatGPT (Plus/Pro)** : identique au mode Chat de l'app de bureau (même moteur, mêmes Projets, upload de référence).
- **API** : hors sujet ici (tu n'utilises pas l'API). Mentionnée seulement pour comprendre que le modèle *sait* faire l'alpha.

## 2. Comment accéder à la génération d'image
- **ChatGPT web** : nouveau chat → décris l'image (« génère… ») → l'outil image se déclenche → clic sur l'image → **bouton Download** → `.png`. On peut **joindre des images** (référence) en les glissant dans le champ.
- **Projets ChatGPT** : créer un Projet = mémoire de contexte partagée entre chats (spec de style dans les *custom instructions*, ancre épinglée). Essentiel pour une série cohérente.

## 3. Principes de prompting (les 6 règles)
1. **Lignes labellisées** (`View: / Style: / Composition: / Background: / Do NOT include: / Output:`) — mieux suivies que la prose.
2. **Positif d'abord, puis un bloc négatif serré** (3-6 exclusions max) — le bloc négatif est *porteur* (c'est lui qui enlève l'ombre/la carte).
3. **Ordre constant** : sujet → style → détails → contraintes.
4. **Figer les invariants, ne varier qu'UNE ligne** (l'objet). C'est LA règle n°1 de la cohérence d'une série.
5. **Ne pas paraphraser** la phrase de style entre deux assets (paraphraser = cause n°1 de dérive).
6. **Longueur moyenne** : assez pour View + Style + isolation + fond + négatifs ; pas un mur d'adjectifs (ça dilue).
   ⚠️ Nommer une chose tend à la faire apparaître (« no shadow » peut induire une ombre) → garder les négatifs utiles, pas 15.

## 4. Fond transparent — la méthode fiable
**Formulation qui marche (app web) :**
- Dire clairement **« fully transparent background — a real RGBA PNG with a genuine alpha channel »**.
- **Isoler le sujet** : « one single isolated object, centered, floating, generous padding, clean silhouette ».
- **Bloc négatif** : « no background scene, floor, ground, wall, shadow, reflection, glow, gradient, text, watermark; **NOT a checkerboard pattern, NOT a white/grey card** — actual transparent pixels ».
- **Output: one PNG, transparent background.**

**Vérifier l'alpha** (avant de valider) : `identify -verbose fichier.png | grep Alpha` → « Alpha: present » = vrai transparent. (Ou déposer sur un fond quadrillé dans un éditeur.)

**Secours si un sprite refuse le transparent** (après ~2 essais, ne pas s'acharner) :
- **remove.bg** (1 clic) ou **Photopea** (Select ▸ Remove BG ▸ Export PNG).
- **Méthode 2 fonds** (bords doux/verre/lueur) : régénérer le *même* prompt une fois « pure white background » et une fois « pure black background », puis diff sur **transparify.app** → alpha exact.

## 5. Cohérence d'une grande série (l'ancre)
La cohérence vient d'une **image de référence figée + phrase de style verbatim**, PAS de seed (pas de seed dans le chat).
1. Générer **UN** sprite « ancre » parfait (objet mi-complexe, ex. chaise) → référence de style.
2. **Vérifier l'ancre** (alpha présent, angle, palette) — corriger *maintenant*, pas à l'asset n°90.
3. **Projet ChatGPT** dédié : spec de style dans les custom instructions ; ancre gardée à portée.
4. Pour chaque asset : **uploader l'ancre** + coller le contrat **PRESERVE / CHANGE ONLY / CONSTRAINTS**.
5. **Références multiples** possibles : Réf A = ancre (style), Réf B = nuancier/lumière (« borrow B only for color »).
6. **Anti-dérive** : nouveau chat en ré-uploadant l'**ancre d'origine** tous les ~6 assets (jamais la dernière sortie).
   Grouper **par catégorie** (meubles → nourriture → tuiles…). Re-vérifier l'ensemble tous les ~20-30.
7. *(Legacy, peu fiable aujourd'hui : demander « what's the generation ID of the last image ? » et le réutiliser. L'image de référence uploadée reste le mécanisme principal.)*

## 6. Angle isométrique
« **true isometric view, 3/4 top-down game angle, ~30° tilt, orthographic, no perspective distortion**, consistent camera angle across all assets ». Tuiles : « **2:1 isometric diamond tile, seamless/tileable edges** ».
⚠️ Le modèle donne du **presque-iso** (dérive ±10-20°, tendance perspective). Si tu as besoin d'un iso pixel-parfait : **corrige en post** (Photopea : Edit ▸ Transform ▸ Skew/Distort). L'ancre uploadée tient l'angle bien mieux que les degrés dans le texte.

## 7. Style cozy retro pixel
Phrase figée verbatim : « **cozy retro pixel art, cute, soft rounded forms, warm limited palette, crisp clean pixels, sharp clean silhouette, simple readable shapes, soft shading, consistent top-left light, reads as a ~64×64 pixel-art sprite** ». Fixer une **taille pixel** (« ~64×64 ») améliore la densité de pixels constante sur toute la série.

## 8. Édition & variantes
- **Décliner un asset** (ex. même chaise, 4 couleurs) : joindre l'image et « **change ONLY the color to sage; keep everything else identical** ».
- **Multi-tour** : enchaîner les retouches dans le même chat (« make it a bit bigger », « remove the cushion ») en gardant la continuité.

## 9. Résolution / format / sortie
- Générer **grand** (carré, ~1024) puis **réduire** à la taille du jeu ; pour un rendu pixel net, downscale en **nearest-neighbor**.
- Objets **hauts** (lampe, étagère, arbre) : cadrage portrait pour ne pas les tasser — mais garde-les dans un même groupe d'échelle.
- Toujours **PNG** (seul format à porter l'alpha).

## 10. Modes d'échec & correctifs
| Symptôme | Cause | Correctif |
|---|---|---|
| Fond damier « peint » / carte blanche | faux alpha | ré-ajouter « real RGBA, NOT a checkerboard/card » ; sinon remove.bg |
| Ombre au sol malgré tout | « no shadow » induit l'ombre | retirer le mot, dire « floating, no ground » ; ou détourer |
| Styles différents d'un asset à l'autre | dérive / pas d'ancre | uploader l'ancre à chaque fois, phrase de style verbatim, nouveau chat |
| Perspective au lieu d'iso | angle non tenu | répéter la phrase iso + ancre ; corriger au skew en post |
| Scène/décor ajouté | isolation faible | « single isolated object, centered, floating, generous padding » |

## 11. LES MEILLEURS PROMPTS (prêts à copier)

**A. Prompt complet — 1er asset / ancre (fond transparent direct)**
```
A single [OBJECT] as a 2.5D isometric game-asset sprite.

View: true isometric, 3/4 top-down game angle (~30° tilt), orthographic — no perspective distortion.
Style: cozy retro pixel art, cute soft rounded forms, warm limited palette, crisp clean pixels, sharp clean silhouette, soft shading, consistent top-left light, reads as a ~64×64 pixel-art sprite.
Composition: one isolated object only, centered, floating, generous padding, clean silhouette.
Background: fully transparent — a real RGBA PNG with a genuine alpha channel.
Do NOT include: any background scene, floor, ground, surface, wall, shadow, reflection, glow, gradient, text, or watermark; NOT a checkerboard pattern, NOT a solid white or grey card — actual transparent pixels.
Output: one PNG, transparent background.
```

**B. Version compacte (batch rapide)**
```
Isometric cozy-pixel-art [OBJECT], single isolated object centered on a fully transparent background (real RGBA alpha PNG), 3/4 top-down ~30° angle, no shadow/ground/backdrop, not a checkerboard, not a white card.
```

**C. Variante COHÉRENCE — à coller avec l'ancre jointe (change seulement l'objet)**
```
Use the uploaded image as a STRICT style reference for a game-asset set.

PRESERVE EXACTLY (do not change): art style (cozy retro pixel art, same pixel scale and rendering), palette and saturation, lighting direction and soft shading, camera (true isometric 3/4 top-down angle, orthographic, no perspective), line weight, edge treatment and level of detail.
CHANGE ONLY THIS: the object is now [NEW OBJECT].
CONSTRAINTS: one single isolated object, centered, generous padding, clean silhouette; fully transparent background — real RGBA alpha PNG; no background scene, floor, ground, wall, shadow, reflection, glow, text or watermark; NOT a checkerboard pattern and NOT a solid card — actual transparent pixels.
Output: one PNG, transparent background, matching the reference style precisely.
```

**D. Tuile de sol**
```
A [OBJECT] as a single 2:1 isometric diamond floor tile.
View: true isometric, top-down (~30° tilt), orthographic — no perspective distortion.
Style: cozy retro pixel art, warm limited palette, crisp clean pixels, soft shading, ~64×64 sprite.
Composition: one tile, centered, seamless tileable edges, generous padding.
Background: fully transparent — real RGBA PNG with genuine alpha.
Do NOT include: scene, floor, shadow, gradient, text; not a checkerboard, not a card.
Output: one PNG, transparent background.
```

**E. Variante couleur d'un asset existant** (image jointe)
```
Keep this sprite EXACTLY the same — same style, angle, shape, size, background. Change ONLY the color to [COLOR]. Transparent RGBA PNG.
```

## 12. WORKFLOW COMPLET A→Z (série de 139 assets)
1. **Figer** les phrases `View:` + `Style:` (une fois, elles ne changent jamais).
2. **Créer l'ancre** : générer un objet représentatif (ex. chaise) avec le prompt **A**, itérer jusqu'à la perfection.
3. **Vérifier l'ancre** : download → `grep Alpha` = present ; contrôler angle + palette.
4. **Projet ChatGPT** : coller la spec figée dans les custom instructions ; garder l'ancre.
5. **Batcher par catégorie** (meubles → objets → nourriture → tuiles sol → tuiles mur).
6. **Par asset** : nouveau chat (ou même chat pour un cluster serré de ~5-15) → **uploader l'ancre** → coller le prompt **C** en remplaçant `[NEW OBJECT]`.
7. **Vérifier + télécharger** chaque PNG (alpha réel ; angle/palette vs ancre). Nommer avec le nom de l'app (`objet.png`).
8. **Récupérer les outliers** (remove.bg / 2 fonds) sans s'acharner.
9. **Ré-ancrer** tous les ~6 assets (nouveau chat + ancre d'origine) ; re-contrôler tous les ~20-30.
10. **Normaliser en fin** : revue par catégorie, régénérer ce qui dépasse, downscale/skew si besoin.

## 13. Outils gratuits
- **remove.bg** — détourage 1 clic (objets nets sur fond uni).
- **Photopea** (photopea.com, gratuit, sans compte) — Select ▸ Remove BG ▸ Export PNG ; aussi skew iso + normaliser la taille de canvas.
- **transparify.app** — méthode 2 fonds (blanc + noir) pour alpha propre sur bords doux/verre.
- **ImageMagick** — `identify -verbose x.png | grep Alpha` pour vérifier le vrai transparent.

## 14. L'app de bureau ChatGPT (Mac/Windows) & Codex — génération d'images
**Cas concret.** L'app de bureau **ChatGPT** intègre, depuis le **9 juillet 2026**, **Codex** (fusion). Dans cette app :
- **Mode Chat ChatGPT** → **génère les images** (cf. §1-13). ← ta surface.
- **Mode Codex** (agent de code) → **ne génère pas d'images**.
- **Mode Agent / ChatGPT Work** (le « co-work / PM ») → autonome (navigation, docs, slides, tableurs) ; **pas** un outil à sprites.
Pour tes sprites : **mode Chat, dans un Project, avec l'ancre en référence.**

**En bref : AUCUNE surface de Codex ne génère nativement d'images.** Codex (l'agent de code) sait **recevoir** des images
en entrée (contexte : captures, maquettes) mais **ne produit pas** de fichiers image. La génération d'images est une
fonctionnalité de **ChatGPT** (web/desktop/app), **pas** de Codex. Pas de slash-command `/image`, pas de « generate an image of… ».

| Surface Codex | Génère des images ? | Reçoit des images en entrée ? |
|---|---|---|
| **CLI** (terminal) | **Non** (dit explicitement dans la doc) | Oui (`--image`/`-i`, ou coller) |
| **Extension IDE** (VS Code, Cursor…) | **Non** | Oui |
| **Cloud/web** (chatgpt.com/codex) | **Non** | Oui |
| **App desktop** | **Non** en mode Codex (c'est le mode **ChatGPT** qui génère, pas l'agent) | Oui |

**La seule façon de produire des images DEPUIS Codex** = lui faire écrire/exécuter du **code qui appelle l'API OpenAI Images**
(`/v1/images/generations` ou `/images/edits`), ou brancher un **serveur MCP** d'images (tiers ; pas de serveur image officiel OpenAI).
→ C'est de l'orchestration + **API** (clé `OPENAI_API_KEY`, permissions réseau/exécution). **Tu n'utilises pas l'API → cette voie ne te concerne pas.**

**Modèles API** (si un jour tu scriptes) : `gpt-image-1`, `gpt-image-1.5`, `gpt-image-2`, `gpt-image-1-mini`.
⚠️ **`gpt-image-2` ne supporte PAS le fond transparent** — pour du PNG transparent natif, rester sur **gpt-image-1 / 1.5**
(`background:"transparent"`, `output_format:"png"`). Le modèle *de code* de Codex ne dessine pas ; l'image viendrait de gpt-image.

**Recommandation pour ton usage (139 sprites, sans API/code) : génère dans l'app web ChatGPT** (sections 1-13).
Codex n'est **pas** une surface de génération d'image pour toi. (Son seul intérêt serait de **scripter un batch** sur l'API
Images — cohérence via `/images/edits` + `background:transparent` sur gpt-image-1.5 — mais ça implique l'API/code.)
Astuce hybride possible : caler 2-3 sprites de référence dans ChatGPT web, puis (si un jour tu passes au code) scripter les 139 via Codex+API.

## 15. Sources
community.openai.com (transparent bg ; sprite sheets) · transparify.app (méthode 2 fonds) · dredyson.com 2025 & 2026
(phrasé RGBA + vérif alpha + négatifs) · help.layer.ai (iso : perspective figée + phrase de style verbatim) ·
chatgptimages.app (contrat preserve/change ; références multiples) · cubistai.app (cozy pixel, taille pixel, palette) ·
futurepedia.io (cohérence via images de référence) · visualswithai (workflow série ; gen_id legacy) ·
spritecook.ai (tuiles 2:1) · doc/cookbook OpenAI (paramètres background/output_format/input_fidelity, modèles).
</content>
