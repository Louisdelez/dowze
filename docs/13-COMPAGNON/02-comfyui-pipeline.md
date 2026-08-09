# Génération d'assets & textures avec ComfyUI — guide COMPLET

> **Référence exhaustive (A→Z).** Pipeline **ComfyUI** pour produire les assets du jeu isométrique du compagnon
> (meubles, objets, nourriture, **props muraux**, **textures sol/mur**) avec un **style cohérent** et de **vraies
> textures raccordables (seamless)**. Complément du guide ChatGPT ([`01-prompts-assets.md`](01-prompts-assets.md)) :
> on réutilise **les mêmes prompts** comme prompt positif ComfyUI.
> Compile l'état de l'art 2025-2026 (Stable Diffusion / SDXL / Flux, LoRA, LayerDiffuse, tiling circulaire).

---

## POURQUOI ComfyUI (vs ChatGPT)
| Besoin | ChatGPT | ComfyUI |
|---|---|---|
| Style **cohérent** sur 150+ assets | via image-ancre (dérive) | **LoRA de style** (verrouillé) |
| Texture **seamless** (4 bords raccordés) | non garanti | **mode tiling (padding circulaire)** = garanti |
| Fond **transparent** propre | oui (gpt-image) | **LayerDiffuse** (RGBA natif) ou détourage |
| **Batch** de tout le catalogue | manuel | **API** : script qui génère les 150 assets |
| Reproductible / versionnable | non | oui (workflow JSON + seed) |

ComfyUI = éditeur de **workflows nodaux** pour Stable Diffusion, avec une **API headless** (on POST un workflow JSON, on récupère les PNG). C'est l'outil de référence pour un pipeline d'assets de jeu reproductible.

---

## SOMMAIRE
1. Les 3 briques du pipeline
2. Pré-requis matériel (repère générique)
3. Installation de ComfyUI
4. Modèles à télécharger + où les ranger
5. Custom nodes indispensables
6. Le **LoRA de style** (dataset, captions, entraînement)
7. **Workflow A — props isométriques transparents** (LayerDiffuse)
8. **Workflow B — textures seamless** (tiling circulaire)
9. **Workflow C — objets muraux** (vue de face)
10. **Batch** de tout le catalogue via l'API ComfyUI
11. Post-traitement (upscale, resize, vérif du raccord)
12. Réglages recommandés (sampler / steps / CFG)
13. Ressources & liens
14. Check-list

---

## 1. Les 3 briques du pipeline
Un asset de jeu réussi = trois problèmes **distincts**, chacun sa brique :

1. **Cohérence de style** → **LoRA de style** (petit fichier d'entraînement branché sur le modèle de base ; toutes les générations portent la même patte : palette, trait, ombrage).
2. **Texture raccordable** → **mode tiling** : on force les convolutions du modèle en **padding circulaire** ; le bord droit s'enroule sur le gauche, le bas sur le haut → seamless **par construction**.
3. **Fond transparent** → **LayerDiffuse** (génère un vrai RGBA avec alpha) ou détourage (rembg / SAM).

Le combo gagnant : **LoRA (style) + Tiling (textures) + LayerDiffuse (props)** dans un même workflow.

---

## 2. Pré-requis matériel (repère générique)
| Modèle de base | VRAM confortable | Notes |
|---|---|---|
| **SD 1.5** | 4–6 Go | léger, rapide, énorme écosystème de LoRA/pixel-art ; LayerDiffuse OK |
| **SDXL** | 8–12 Go | meilleure qualité/cohérence ; LayerDiffuse OK |
| **Flux.1** (dev/schnell) | 12–24 Go (ou GGUF quantisé pour moins) | top qualité 2025-2026 |

- **< 8 Go** : `--lowvram`, préférer **SD 1.5** ou versions **GGUF quantisées**.
- **Pas de gros GPU local ?** Louer un GPU cloud à l'heure (RunPod, vast.ai : RTX 3090/4090 24 Go, ~0,2–0,5 $/h) et y installer ComfyUI, ou passer par un ComfyUI hébergé. Le reste du guide est identique.

---

## 3. Installation de ComfyUI (Linux)
```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
python3.11 -m venv venv && source venv/bin/activate

# PyTorch CUDA (adapter cu121/cu124 à ta version CUDA ; voir pytorch.org)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt

# Lancer (UI web sur http://<ip>:8188)
python main.py --listen 0.0.0.0 --port 8188
# Selon la VRAM : --lowvram  |  --normalvram  |  --highvram
```

**ComfyUI-Manager** (installe tous les autres nodes en 1 clic) :
```bash
cd custom_nodes
git clone https://github.com/ltdrdata/ComfyUI-Manager
# relancer ComfyUI → bouton "Manager" en haut à droite → "Install Custom Nodes"
```
> Windows/Mac : utiliser le **portable** (Windows) ou suivre le README officiel. La suite (workflows, API) est identique.

---

## 4. Modèles à télécharger + où les ranger
Sources : **Hugging Face** (modèles de base, VAE, LayerDiffuse) et **Civitai** (checkpoints/LoRA « pixel-art », « cozy », « isometric »).

| Fichier | Dossier ComfyUI | Rôle |
|---|---|---|
| Checkpoint de base (SD1.5 / SDXL / Flux) | `models/checkpoints/` | modèle principal |
| VAE (si séparé, ex. `sdxl_vae`) | `models/vae/` | décodage couleur |
| **LoRA de style** (le tien) + LoRA pixel-art | `models/loras/` | style |
| Modèles **LayerDiffuse** (`layer_*`) | `models/layer_model/` (créé par le node) | transparence |
| ControlNet (optionnel : figer l'angle iso) | `models/controlnet/` | contrôle pose/structure |
| Upscaler (ex. `4x-UltraSharp`, `4x_foolhardy_Remacri`) | `models/upscale_models/` | agrandissement net |

**Points de départ de style** (pour éviter d'entraîner tout de suite) : chercher sur Civitai des LoRA **« pixel art »**, **« isometric »**, **« cozy / cute »** compatibles avec ton checkpoint (SD1.5 **ou** SDXL — ils ne sont pas interchangeables).

---

## 5. Custom nodes indispensables
À installer via **ComfyUI-Manager** (rechercher par nom) :

| Node / pack | Rôle |
|---|---|
| **ComfyUI-layerdiffuse** (huchenlei) | génération **RGBA transparente** (props, objets muraux) |
| **Seamless tiling** (ex. `comfyui-seamless-tiling`, spinagon) | passe les convs en **padding circulaire** → textures raccordables |
| **ComfyUI-Impact-Pack** | détourage, upscale par tuiles, utilitaires |
| **ComfyUI_essentials** / **WAS Node Suite** | resize, crop, opérations d'image |
| **comfyui_controlnet_aux** (optionnel) | pré-processeurs ControlNet (figer l'angle iso) |
| **ComfyUI-Manager** | (déjà installé) gestion des nodes/modèles |

> Les noms exacts des repos peuvent évoluer : chercher **« LayerDiffuse »** et **« seamless tiling »** dans le Manager et prendre le node le plus téléchargé/maintenu.

---

## 6. Le LoRA de style (le cœur de la cohérence)

### 6.1 Amorcer le dataset (œuf/poule)
Pour entraîner un LoRA de style il faut **déjà ~25-40 images propres** dans le style visé. Amorçage :
1. Générer un premier lot avec **ChatGPT + l'image-ancre** (cf. `01-prompts-assets.md`).
2. Garder les **25-40 meilleures**, variées (meubles, objets, plantes, nourriture) et **bien homogènes**.
3. Nettoyer si besoin dans **Aseprite** (pixel-perfect), fond transparent ou uni.
4. Résolution du dataset : **carrés** (512² pour SD1.5, 1024² pour SDXL).

### 6.2 Captions (légendes)
Un fichier `.txt` par image, même nom. Pour un **LoRA de style** :
- mettre un **token déclencheur** unique en tête (ex. `dowzestyle`), puis décrire **le contenu** (pas le style) :
  `dowzestyle, a wooden bed, isometric, transparent background`.
- Le style « fuit » dans le token ; le contenu décrit permet au modèle de généraliser.

### 6.3 Entraînement (kohya_ss / sd-scripts)
```bash
git clone https://github.com/bmaltais/kohya_ss   # GUI par-dessus sd-scripts
```
Paramètres de départ pour un **LoRA de style** :
| Param | SD1.5 | SDXL |
|---|---|---|
| network_dim (rank) | 16–32 | 16–32 |
| network_alpha | = dim ou dim/2 | idem |
| learning rate | 1e-4 (unet), 5e-5 (text) | 1e-4 / 5e-5 |
| resolution | 512 | 1024 |
| steps | ~1500–3000 (ou 10–15 epochs) | idem |
| batch size | selon VRAM (2–4) | 1–2 |
| optimizer | AdamW8bit | AdamW8bit |

- Sauver un checkpoint **par epoch**, tester chacun, garder celui qui capte le style **sans** figer le contenu (surentraînement = tout se ressemble trop / artefacts).
- Alternative sans setup : entraîner en ligne (**Civitai** on-site trainer, **fal.ai**/**Replicate** flux-lora-trainer, **Scenario**).

Le LoRA final → `models/loras/dowzestyle.safetensors`, chargé via le node **Load LoRA** (poids 0.6–0.9).

---

## 7. Workflow A — PROPS isométriques transparents (LayerDiffuse)
Chaîne de nodes :
```
Load Checkpoint ─┐
Load LoRA (dowzestyle, 0.8) ─┤
                 ├─ CLIP Text Encode (POSITIF = prompt du 01, ex. « A single wooden bed as an isometric game prop… »)
                 ├─ CLIP Text Encode (NÉGATIF = « blurry, extra objects, background, shadow, text, watermark, low quality »)
Empty Latent (512² ou 1024²) ─ KSampler ─ [Layer Diffuse Decode (RGBA)] ─ Save Image (PNG)
                                   │
                        [Layer Diffuse Apply] branché sur le modèle avant le sampler
```
- Le node **Layer Diffuse Apply** conditionne le modèle pour produire de l'alpha ; **Layer Diffuse Decode (RGBA)** sort le PNG transparent.
- Prompt positif = **exactement** le prompt « prop » de l'atelier (buildPrompt). Prompt négatif = liste de rejets.
- Sortie : sprite isolé, fond transparent → nommer `id.png` (mêmes ids que le catalogue).

**Objets muraux** (fenêtres, tableaux…) = même workflow mais prompt « objet mural » (vue de face), cf. §9.

---

## 8. Workflow B — TEXTURES seamless (tiling circulaire)
La texture n'utilise **pas** LayerDiffuse (pas de transparence) mais **le tiling** :
```
Load Checkpoint ─ Load LoRA (dowzestyle) ─ [Seamless Tiling (mode: circular)] ─┐
CLIP Text Encode (POSITIF = prompt « texture » du 01, seamless/flat/no-iso)     ├─ KSampler ─ VAE Decode ─ Save Image
CLIP Text Encode (NÉGATIF = « seam, border, object, shadow, perspective, 3d ») ─┘
Empty Latent 512² (ou 1024²)
```
- Le node **Seamless Tiling** patche les `Conv2d` du modèle **et du VAE** en `padding_mode='circular'` → **les 4 bords s'enroulent**, la sortie est raccordable **par construction**.
- Vérifier en sortie : dupliquer la tuile 3×3 (ou node « tile preview ») → **aucune couture**.
- Générer **carré, plein cadre** (pas de transparence, pas de marge).
- Astuce : baisser un peu le CFG et éviter les gros motifs directionnels non répétables si tu veux un raccord parfait.

> Certaines textures régulières (parquet, briques, carrelage) gagnent à être **finies dans Aseprite (mode Tiled)** pour un raccord pixel-perfect.

---

## 9. Workflow C — objets muraux (vue de face)
Identique au **Workflow A** (transparent, LayerDiffuse) mais :
- **Empty Latent** plutôt **portrait/carré** selon l'objet.
- Prompt positif = prompt « objet mural » (vue **de face**, plan du mur, orthographique).
- Négatif : ajouter `isometric, perspective, wall behind, room`.
→ Sprite frontal transparent à coller sur les murs (fenêtre, porte, tableau, étagère…).

---

## 10. Batch de tout le catalogue via l'API ComfyUI
ComfyUI expose une API sur `:8188`. On **exporte le workflow en JSON** (menu → *Save (API Format)*), on repère les nodes à faire varier (prompt positif, seed, nom de sortie), puis on boucle sur le catalogue.

Script Python minimal :
```python
import json, urllib.request, time

API = "http://127.0.0.1:8188"

def queue(workflow):
    data = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data)
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]

# 1) charger le workflow exporté "API format"
base = json.load(open("workflow_prop_api.json"))

# 2) liste d'assets (id + prompt) — peut être exportée depuis apps/dev/src/lib/assets.ts
assets = [
    {"id": "lit-simple", "prompt": "A single wooden single bed as an isometric game prop ..."},
    {"id": "canape",     "prompt": "A single dusty-rose two-seat sofa as an isometric game prop ..."},
    # ...
]

for i, a in enumerate(assets):
    wf = json.loads(json.dumps(base))            # copie
    wf["6"]["inputs"]["text"] = a["prompt"]      # <-- id du node CLIP positif
    wf["3"]["inputs"]["seed"] = 1000 + i         # <-- id du node KSampler
    wf["9"]["inputs"]["filename_prefix"] = a["id"]  # <-- id du node Save Image
    print("queued", a["id"], queue(wf))
    time.sleep(0.3)
```
- Les **ids de nodes** (`"6"`, `"3"`, `"9"`) se lisent dans le JSON exporté.
- Récupérer les PNG dans `ComfyUI/output/` (nommés `id_00001_.png`) → renommer en `id.png`.
- **Réutiliser les prompts de l'atelier** : `buildPrompt(asset)` de `apps/dev/src/lib/assets.ts` produit exactement le texte à mettre dans `a["prompt"]` (props/objets muraux) ou la version « texture » pour le Workflow B.

---

## 11. Post-traitement
1. **Upscale** : node *Upscale Image (using Model)* avec `4x-UltraSharp` → détails nets, puis redimensionner à la taille cible du jeu.
2. **Nettoyage alpha** (props) : si halo, node de détourage (Impact Pack / rembg) ou seuil d'alpha.
3. **Resize** à la spec du jeu (ex. sprites 128², tuiles 256²).
4. **Vérif seamless** (textures) : aperçu 3×3, corriger dans Aseprite si une couture subsiste.
5. **Palette** (optionnel pixel-art) : quantifier la palette (node ou Aseprite) pour un rendu « retro » propre.

---

## 12. Réglages recommandés (points de départ)
| Modèle | Sampler | Steps | CFG | Taille |
|---|---|---|---|---|
| SD 1.5 | `dpmpp_2m` + `karras` | 25–30 | 6–7 | 512² |
| SDXL | `dpmpp_2m_sde` + `karras` | 25–35 | 5–7 | 1024² |
| Flux dev | `euler` + `simple` | 20–30 | 3.5 (guidance) | 1024² |

- **LoRA weight** : 0.6–0.9 (trop haut = artefacts).
- **Seed** : fixer pour comparer, faire varier pour un lot.
- **Négatif type** : `blurry, jpeg artifacts, extra objects, cropped, text, watermark, signature, background, drop shadow` (+ `seam, border` pour textures ; + `isometric, perspective` pour objets muraux).

---

## 13. Ressources & liens
- **ComfyUI** : github.com/comfyanonymous/ComfyUI
- **ComfyUI-Manager** : github.com/ltdrdata/ComfyUI-Manager
- **LayerDiffuse (ComfyUI)** : github.com/huchenlei/ComfyUI-layerdiffuse
- **Seamless tiling (ComfyUI)** : chercher « seamless tiling » dans le Manager (ex. spinagon/ComfyUI-seamless-tiling)
- **kohya_ss (LoRA)** : github.com/bmaltais/kohya_ss
- **Modèles / LoRA** : huggingface.co, civitai.com (checkpoints & LoRA pixel-art / isometric / cozy)
- **Upscalers** : openmodeldb.info (`4x-UltraSharp`, `4x_foolhardy_Remacri`)
- **Entraînement hébergé** : Civitai trainer, fal.ai, Replicate, Scenario.gg
- **Finitions pixel-art** : Aseprite (mode Tiled pour les textures)

---

## 14. Check-list
- [ ] ComfyUI + ComfyUI-Manager installés, UI accessible sur `:8188`.
- [ ] Checkpoint de base choisi (SD1.5 / SDXL / Flux) + VAE + upscaler.
- [ ] Nodes : LayerDiffuse, Seamless tiling, Impact Pack installés.
- [ ] Dataset de style amorcé (~25-40 images ChatGPT nettoyées) → **LoRA `dowzestyle` entraîné**.
- [ ] **Workflow A** (props transparents) validé sur 1 asset.
- [ ] **Workflow B** (texture seamless) validé : raccord vérifié en 3×3.
- [ ] **Workflow C** (objets muraux, vue de face) validé.
- [ ] **Batch API** branché sur le catalogue (`assets.ts`) → génère `id.png` en masse.
- [ ] Post-traitement (upscale + resize + vérif) automatisé.

---
*Complément du guide ChatGPT (`01-prompts-assets.md`) : on y prend les prompts, ici on les exécute dans un pipeline reproductible et cohérent. Recherche compilée 2025-2026 ; vérifier les noms exacts des custom nodes dans ComfyUI-Manager (ils évoluent).*
