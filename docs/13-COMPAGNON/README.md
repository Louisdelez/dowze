# 13 — Le Compagnon Dowze

Un petit compagnon qui **incarne l'IA de Dowze** : présent sur toutes les pages, au premier plan,
**déplaçable à la souris**, il rend concret « je suis là, je travaille, voilà ce que je fais » et rassure —
sans jamais l'intrusion de Clippy ni la culpabilité de Duolingo.

- [00-compagnon.md](00-compagnon.md) — vision, recherche, persona, modèle d'états, micro-copie, architecture
  technique, accessibilité, garde-fous et plan phasé (C0→C4).
- [01-prompts-assets.md](01-prompts-assets.md) — génération des assets du jeu via **ChatGPT / Codex** (prompts A→Z).
- [02-comfyui-pipeline.md](02-comfyui-pipeline.md) — génération des assets & **textures seamless** via **ComfyUI**
  (LoRA de style + tiling + LayerDiffuse + batch API).
- [03-open-spaces-entreprises.md](03-open-spaces-entreprises.md) — **open-space = organisation** : entreprises/écoles
  peuplées d'**agents-employés** (CEO/CTO/dev… ou Directeur/profs), orchestration par rôle, QA, RAG par org.
- [04-ponts-ia-externes.md](04-ponts-ia-externes.md) — **brancher son abonnement ChatGPT/Claude à Dowze via MCP**
  (connecteurs officiels, conforme CGU) pour que l'IA externe **donne le cours** en communiquant avec Dowze.
- [05-pont-webview-tauri.md](05-pont-webview-tauri.md) — **vraie webview ChatGPT/Claude dockée dans l'app Tauri**,
  lue (RAG/mémoire) et pilotée par le compagnon-pont ; **solution anti-bot** (vrai Chromium CEF/extension, pas WebKitGTK).
- [06-ruche-continuite-universelle.md](06-ruche-continuite-universelle.md) — consolidation de la vision complète :
  **mémoire universelle sans sessions**, contrats de rôle, handoffs traçables, canaux humains et alignement avec
  la Ruche déjà implémentée.
- [07-matrice-vision-ruche.md](07-matrice-vision-ruche.md) — exigences atomiques de la conversation, état réel,
  preuves, manques et ordre d'implémentation sans déclaration globale trompeuse.
- [08-audit-systeme-ruche.md](08-audit-systeme-ruche.md) — audit de bout en bout : source récupérée, architecture,
  sécurité, base, tests, limites vérifiables et éléments nécessitant encore un fournisseur ou un déploiement.

**État** : conçu + **C0/C1 implémentés** (compagnon global déplaçable, réagit aux vrais appels IA).
Fondé sur 3 recherches sourcées (existant façon Codex « Pets »/Clippy/Duo ; science de l'anthropomorphisme
et de la réassurance ; patterns UX + micro-copie).
