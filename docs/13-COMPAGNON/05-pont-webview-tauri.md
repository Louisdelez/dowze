# 05 — Pont webview Tauri : vrai navigateur ChatGPT/Claude docké, lu et piloté par Dowze

> **Conception & recherche.** L'app bureau (Tauri) embarque une **vraie webview** (PAS une iframe) de
> **claude.ai** ou **chatgpt.com**, dockée **à droite en vertical** — **exactement comme la barre latérale IA
> de Firefox** (choisir son IA → un **vrai panneau navigateur vertical**, comme un nouvel onglet / une
> nouvelle instance de navigateur, **embarqué DANS l'app**, pas une fenêtre séparée ni une iframe). Dowze
> **lit l'intégralité de la conversation** pour la traiter et la stocker en **mémoire/RAG** (savoir ce qui a
> été dit/fait, garder le
> contexte, reprendre la prochaine fois). Un **bouton** transfère le **prompt de contexte** (là où on en est)
> dans le composer de ChatGPT/Claude ; l'élève continue **à la suite** puis discute normalement. Le tout est
> **piloté par le système Dowze** (RAG, agents, compagnons) : un **compagnon-pont ChatGPT/Claude** qui a tout
> le contexte car il communique avec les bonnes abeilles (cf. [[dowze-compagnons-agents]]). Ce compagnon =
> un **pont**.
>
> ⚠️ Ce doc est l'**alternative « abonnement pur »** au connecteur MCP officiel de [04](04-ponts-ia-externes.md).
> Ici Dowze lit/écrit la **page** (client-side, session de l'élève), sans API ni connecteur à configurer.

## 0. Étoile polaire : ZÉRO copier-coller, automatique, pour tout le monde

Le but n'est PAS technique, c'est **la simplicité maximale pour l'élève**. Aujourd'hui le cours passe par un
**copier-coller manuel** (`compose()` → l'élève colle le prompt dans son IA → recolle son résumé dans Dowze,
cf. [04](04-ponts-ia-externes.md) §3). C'est la **friction à supprimer**. Cible :

- **Chargement du contexte = automatique** : à l'ouverture d'une session (pas même un bouton, ou un seul), le
  prompt de contexte est **injecté tout seul** → l'IA « retrouve où on en est ».
- **Sauvegarde = automatique et continue** : Dowze **capte la session en arrière-plan** (rien à recoller).
- **L'élève fait juste son cours** : il pose ses questions, répond, discute — **plus aucun passage de prompt**.
- **N'importe qui peut le faire** : pas de configuration technique, pas de connecteur à installer.

> **Tension honnête à trancher** : « le plus simple pour tout le monde » et « utiliser MON abonnement
> ChatGPT/Claude » tirent en sens opposés. Plus on impose l'abonnement de l'élève, plus il reste un minimum
> de friction irréductible (au moins **se connecter une fois** à son compte, + un transport : webview,
> connecteur, ou copier-coller). Voir la comparaison §6.

---

## 1. Faisabilité Tauri (état réel de `apps/desktop`)

Constat (audit du code) : l'app est **v2**, **une seule fenêtre** `main` (décorations off, titlebar custom),
**une seule webview** chargée en **remote** sur `https://academie.dowze.ch`. `Cargo.toml` : `tauri` **sans
feature** (`unstable` absent). Aucune API de création/pilotage de webview n'est utilisée. Donc **tout est à
construire** :

- **2ᵉ webview** : soit une webview **enfant dockée** dans `main` → nécessite `tauri features=["unstable"]`
  (`Window::add_child` / positionnement) ; soit une **2ᵉ `WebviewWindow`** séparée (sans `unstable`).
- **Permissions** à ajouter dans `capabilities/default.json` : `core:webview:allow-create-webview`,
  `…allow-set-webview-position/size`, `core:event:allow-listen/emit`, éventuellement `clipboard-manager`.
- **⚠️ Pas d'IPC depuis la webview IA** : `capabilities.remote.urls` ne liste que `*.dowze.ch`. Une webview
  sur `claude.ai`/`chatgpt.com` **ne peut pas** appeler l'IPC Dowze. → la lecture DOM et l'injection se font
  **depuis Rust** via **`webview.eval(script)`** (piloté par le compagnon-pont), le résultat remontant par un
  **event** Tauri. Commandes Rust à écrire : `create_ai_webview(url)`, `eval_in_ai_webview(js)`,
  `read_ai_conversation()`, `set_ai_webview_bounds()`.
- **Docking** : `apps/web/src/components/desktop-frame.tsx` est déjà un flex-row (titlebar `h-9` = offset) →
  le panneau React **réserve l'espace** (largeur fixe à droite) ; la **vraie webview native** est positionnée
  par-dessus en Rust (`set_position/set_size`), en écoutant les redimensionnements. `apps/web/src/lib/desktop.ts`
  = point d'ajout des wrappers front (`createAiWebview`, `onAiConversation`…).

---

## 2. ⚠️ LE point dur : anti-bot (Cloudflare Turnstile), surtout sous Linux

> **Principe cadre (clarification produit)** : il y a **toujours un humain derrière**. C'est **l'élève** qui
> se connecte à **son** compte Claude/ChatGPT (login + Turnstile **résolus par lui**). L'application ne fait
> que **(1) coller le prompt de contexte** (retrouver sa session, démarrer le cours) et **(2) lire toute sa
> session** (ce qu'il a fait). **Aucune automatisation ne déclenche l'anti-bot** : coller du texte et lire le
> DOM ne provoquent aucun challenge. → Le rôle du « vrai Chromium » ci-dessous **n'est PAS de tromper
> Turnstile**, mais de garantir que **le login manuel de l'humain FONCTIONNE** (le moteur WebKitGTK peut, à lui
> seul, faire échouer le Turnstile même d'un vrai humain / afficher « navigateur non supporté »).

### Le problème
Tauri utilise le **webview système** : WebView2 (Windows, Chromium), WKWebView (macOS, WebKit),
**WebKitGTK (Linux)**. **Chromium/CEF pour Tauri = « pas exclu mais aucune ETA »** (pas dispo). Or claude.ai
et chatgpt.com sont derrière **Cloudflare Turnstile**, qui juge **empreinte moteur (TLS/JA3, canvas, WebGL),
présence de CDP, et signaux réseau**. **WebKitGTK** a une empreinte non-Chrome → souvent « navigateur non
supporté » / Turnstile en boucle, **même pour un humain**. **Il n'existe AUCUNE dépendance qui rend WebKitGTK
indétectable** : le fingerprint est au niveau moteur, pas patchable en JS.

### Deux faits qui jouent EN NOTRE FAVEUR
1. **Notre cas n'est pas du scraping** : vrai **humain**, **IP résidentielle**, **son propre compte**, **login
   interactif**. Depuis mi-2025 Turnstile **fait cliquer une case + analyse les mouvements souris** → c'est
   fait pour **laisser passer les humains**. Si l'élève se connecte et clique lui-même, il passe.
2. **CDP est un piège** : « aucun Chrome humain n'a CDP activé, 99 % des bots oui ». Donc **piloter Chrome par
   CDP** (chromiumoxide, Playwright, Puppeteer) est **détectable**. Notre pilotage ne doit PAS passer par CDP.

### La solution : embarquer un VRAI Chromium (pas WebKitGTK), sans CDP
Puisqu'on ne peut pas « déguiser » WebKitGTK, on **remplace le moteur** pour le panneau IA par un Chromium réel.
Options installables, par ordre de recommandation :

| # | Solution (dépendance) | Ce que c'est | Anti-bot | Coût/complexité |
|---|---|---|---|---|
| **A** ⭐ | **CEF via la crate Rust `cef`** (Chromium Embedded Framework) | un **vrai Chromium embarqué** en process, dockable comme fenêtre enfant | empreinte Chrome **réelle**, **pas de CDP** → passe comme un humain (login manuel) | lourd (~bundle Chromium ~150 Mo), build C++ ; mais c'est LE « moteur navigateur réel installé » |
| **B** ⭐ | **Chrome/Chromium réel de l'utilisateur + EXTENSION Dowze** (unpacked) lancé par Tauri (`--user-data-dir` persistant, fenêtre app-mode positionnée sur le dock) | le vrai Chrome de l'élève ; l'**extension** lit la conversation + injecte le prompt + POST vers l'API locale Dowze | vrai Chrome, **pas de CDP**, extensions lisant ChatGPT/Claude = **précédent établi/toléré** | simple, robuste, mais fenêtre Chrome « à côté » (positionnement à gérer) ; dépend d'un Chrome installé |
| C | **WebView2** (Windows) / **WKWebView** (macOS) natifs | déjà Chromium/WebKit-Safari | passent **généralement** avec UA normal + login manuel | gratuit, mais **ne règle pas Linux** (l'OS de l'utilisateur) |
| D | **Anti-detect** (Camoufox — Firefox durci ; patchright/nodriver/rebrowser — patches anti-CDP) | moteurs/patches conçus pour le scraping furtif | bons pour l'automatisation **headless**, mais **inadaptés** à un chat piloté par l'humain (et pilotés par CDP patché = fragile) | surdimensionné ici |
| E | **JS stealth** sur WebKitGTK (patch `navigator.webdriver`, UA Chrome, bruit canvas) | script d'init injecté | **insuffisant** contre Turnstile (TLS/canvas restent WebKit) | quasi gratuit mais **peu fiable** |
| F | Services de solving (Kameleo, capsolver, cloud browsers) | contournement payant à distance | efficace | **payant + zone CGU** — à éviter pour du grand public |

> **⚠️ Ce que la référence « barre latérale de Firefox » implique** : Firefox y arrive facilement parce que
> Firefox **EST** un vrai navigateur complet (moteur **Gecko**, à jour, que Cloudflare laisse passer) et sa
> sidebar est un **vrai panneau navigateur intégré**. Tauri, lui, n'a **pas** de moteur complet sous Linux
> (WebKitGTK). Donc pour obtenir **le même panneau vertical EMBARQUÉ qui, en plus, se logue sans souci** à
> ChatGPT/Claude, il faut un **vrai moteur Chromium intégré au panneau**. Conséquence sur le choix :
> - **A (CEF) = le seul qui coche les DEUX** : *panneau embarqué* (comme la sidebar Firefox) **et** *vrai
>   moteur Chrome* (login OK). ⭐ **C'est donc l'option cible pour l'UX « barre latérale IA » demandée.**
> - **Webview enfant `unstable` (WebKitGTK)** : *embarqué* ✅ mais *moteur faible* → risque login/Turnstile.
> - **B (Chrome réel externe)** : *vrai moteur* ✅ mais **fenêtre SÉPARÉE** collée au bord ≠ vraiment
>   *embarqué* → **ne matche pas** le rendu « sidebar intégrée » que tu décris (bon repli fonctionnel, moins
>   joli).

**Recommandation (avec l'exigence « sidebar Firefox embarquée »)** : viser **A (CEF)** — vrai Chromium
**intégré** au panneau droit, cross-OS, login humain OK. **B** reste le repli le plus simple si CEF est trop
lourd, en acceptant une fenêtre accolée plutôt qu'un panneau vraiment intégré. Dans tous les cas : **UA Chrome
normal + profil persistant + login/Turnstile résolus par l'élève + actions au rythme humain**.

### Mitigations universelles (quel que soit le moteur)
- **Login + Turnstile faits par l'élève** (jamais automatisés) → profil **persistant** (cookies gardés) →
  l'usage courant ne re-challenge quasiment jamais.
- **User-agent Chrome réaliste**, **pas de flags d'automatisation**, **pas de CDP**.
- Injection du prompt = **remplir le composer**, l'élève **appuie sur Entrée** (humain). Pas de soumission
  robotisée en rafale.

### Honnêteté
Aucune méthode n'est **garantie dans la durée** (c'est une course à l'armement ; Turnstile bouge). Mais le
chemin **vrai-Chromium + humain-dans-la-boucle** (A ou B) est de **loin** le plus robuste et le plus bas risque
pour NOTRE usage (session de l'élève, pas du bot de masse).

---

## 3. Lire l'intégralité de la conversation

- **Parser DOM par site** (claude.ai ≠ chatgpt.com : DOM différents → un parseur chacun). Script injecté
  (via `webview.eval` en CEF, ou content-script d'extension en option B) qui sélectionne les tours de
  conversation (rôle + texte) et sérialise en `{role:'user'|'assistant', text}[]`.
- **Listes virtualisées** : seuls les messages visibles sont dans le DOM → **scroller programmatique­ment**
  pour capturer tout l'historique, ou lire le state React/streaming.
- **Streaming** : `MutationObserver` sur le conteneur de messages → capter la réponse au fur et à mesure et
  détecter « fin de génération ».
- Remontée : event Tauri (CEF) ou POST vers un endpoint local/`companion` (extension). Dédup par hash de tour.

## 4. Injecter le prompt de contexte (bouton « envoyer le contexte »)

- Le compagnon-pont demande à Dowze le **prompt de contexte** = `copilote.compose(profileId)` (compétence
  visée, niveau/rang, %maîtrise, misconceptions, dossier élève, RAG) **+** un résumé « où on en est » tiré des
  conversations précédentes ingérées.
- Injection : remplir le **composer** (textarea/`contenteditable` + events `input`) OU **presse-papiers +
  coller**. L'élève **valide** (Entrée) puis continue à discuter normalement. Rien d'autre n'est automatisé.

## 5. La boucle 100 % Dowze : capter → SYNTHÉTISER → réinjecter (l'élève ne gère rien)

C'est le cœur de la demande : **toute la partie compliquée (récupérer le contexte, préparer le prompt) est
gérée à 100 % par Dowze.** L'élève fait juste son cours. Pipeline automatique :

**① CAPTER** — l'app lit **toute la conversation** ChatGPT/Claude (DOM, §3) et l'envoie à Dowze (brut).

**② SYNTHÉTISER (abeille dédiée)** — une **abeille « Mémorialiste »** (`mode='agent'`, rôle système) traite le
brut : elle **enlève l'inutile** (politesses, digressions, redites) et produit une **synthèse compacte et
utile** : ce qui a été vu/compris, ce qui a bloqué, faits-clés, **où on s'est arrêté**, prochaine étape.
- **Réutilise l'infra existante** : c'est exactement ce que fait déjà **`copilote.ingest()`** (un LLM
  EXTRAIT un `SessionSnapshot` propre — `outcome/evidence/errors/covered/nextStep/carnetNote` — depuis un
  texte), **sauf que le texte n'est plus tapé par l'élève mais fourni par la capture.** → l'abeille appelle
  `copilote.generateStructured` (schéma type `sessionSnapshotSchema`) sur la conversation captée.
- **Double stockage** : (a) la **synthèse** va dans la mémoire RAG (`addSpaceKnowledge` →
  `companion_space_knowledge`, **embeddée**, interrogeable auto par les abeilles via `orgSearch`) ; (b) si la
  conversation se rattache à une **compétence**, on nourrit aussi **`ingest()`** (BKT/carnet/FSRS) → la
  maîtrise se met à jour **toute seule**, sans que l'élève recolle quoi que ce soit. On garde la **synthèse**
  (compacte), pas le dump brut, comme mémoire durable.
- **Nettoyage/consolidation** : la maintenance nocturne de la ruche (dedup/fusion/prune, cf.
  [[dowze-compagnons-agents]]) garde la mémoire propre dans le temps.

**③ RÉINJECTER** — quand l'élève **commence un cours** (reprendre l'existant OU nouveau), Dowze construit le
prompt = **`copilote.compose(profileId)`** (compétence visée, niveau/rang, misconceptions, dossier) **+ la
dernière synthèse** (« voilà où on en était, ce qui a été vu/bloqué ») et le **colle automatiquement** dans la
**nouvelle session** ChatGPT/Claude → l'IA a tout le contexte, **l'élève démarre direct**.

**④ L'élève fait son cours normalement** — il pose ses questions, répond ; ① tourne en fond en continu. **Plus
aucun copier-coller, jamais.**

### Détails techniques
- Endpoint d'ingestion **texte libre chunké** à créer (calqué sur `POST /companion/spaces/:id/knowledge`,
  `content` ≤ 8000 → chunker) avec `source='chatgpt'|'claude'`, `sessionId` ; plomberie embed+recherche
  (`copilote.embed`, `storeKnowledgeEmbedding`, `searchSpaceKnowledge`) **déjà là**. Open-space dédié
  « Conversations IA ».
- **Compagnon-pont** = `mode='bridge'` (réservé système, comme `relay` ; cf. `ensureRelayAgent`) : porte le fil
  ChatGPT/Claude (visible au téléphone), déclenche la synthèse, orchestre avec les abeilles (il peut
  interroger les profs/abeilles pour enrichir le prompt de contexte). L'abeille **Mémorialiste** peut être le
  pont lui-même ou une abeille dédiée qu'il mobilise.

## 6. Les 3 voies, classées par SIMPLICITÉ pour l'élève (étoile polaire §0)

| Voie | Copier-coller ? | Setup élève | « N'importe qui » ? | Utilise l'abonnement de l'élève ? | Robustesse |
|---|---|---|---|---|---|
| **① IA intégrée Dowze** (compagnon/abeilles — **déjà construit**) | **ZÉRO** | **aucun** (l'élève parle, c'est tout) | **✅ oui, total** | ❌ non (crédits/BYOK Dowze) | robuste |
| **② Webview/extension** (ce doc) | **ZÉRO après login** (auto-injection + capture auto) | **1 login** à son compte IA | ✅ oui (une fois logué) | ✅ **oui** | fragile (DOM/Turnstile/WebKitGTK) |
| **③ Connecteur MCP** (doc 04) | ZÉRO | **config technique** (Developer Mode / GPT) | ⚠️ **non** (trop technique) | ✅ oui | robuste (officiel) |
| ~~Copier-coller actuel~~ | **à CHAQUE fois** | aucun | ✅ mais **pénible** | ✅ oui | robuste |

**Analyse (par rapport à l'étoile polaire)** :
- **Le plus simple pour TOUT LE MONDE = ① l'IA intégrée de Dowze.** Zéro copier-coller, zéro login externe,
  zéro config : l'élève parle à son compagnon, la mémoire/RAG (`companion_messages`, `companion_space_knowledge`)
  garde déjà le contexte et reprend la fois d'après. **C'est déjà 90 % construit** (chatAgent, orchestration
  par rôle, école, RAG — cf. [[dowze-compagnons-agents]]). Le seul « manque » : ça n'utilise pas l'abonnement
  ChatGPT/Claude de l'élève (mais des crédits/BYOK Dowze).
- **Si on VEUT l'abonnement de l'élève sans friction = ② webview/extension.** On supprime le copier-coller :
  une seule fois l'élève se **connecte** à son compte dans le panneau ; ensuite le contexte s'**injecte
  automatiquement** à l'ouverture et la session est **captée en arrière-plan**. C'est la meilleure simplicité
  atteignable **tout en gardant son abonnement**. Prix : desktop-only + fragilité (§2-§3).
- **③ MCP** ne colle PAS à « n'importe qui » (config technique) → à réserver aux utilisateurs avancés / au web.

**Recommandation** : **par défaut ①** (le plus simple, déjà là) pour la masse ; proposer **② (option B,
extension)** comme **« mode expert : brancher mon ChatGPT/Claude »** à ceux qui tiennent à leur abonnement.
Le **compagnon-pont + l'ingestion RAG** (§5) sont **communs** — quel que soit le moteur, la mémoire de Dowze
est la même. → **la friction « copier-coller » disparaît dans les 3 cas ; ① l'élimine sans aucun setup.**

## 7. Sécurité / CGU / enfants

- Client-side, **session de l'élève**, **initié par lui** → loin du cas banni **OpenClaw** (harnais serveur
  revendant l'abonnement en API). Risque **faible-modéré** ; **flags compte possibles** si comportement
  robotique → garder l'humain dans la boucle, pas de rafales.
- **Ne jamais** transformer ça en API headless côté serveur (= zone de ban).
- **Enfants** : l'IA externe échappe à la modération Dowze → réserver aux profils majeurs / supervision
  parentale (paliers `onboarding-rules`), journaliser, cadrer par le prompt de contexte injecté.
- **Multi-profils** : `profileIdForAuth` = 1er profil → viser explicitement le **profil-élève** (cf.
  [[dowze-storage-jwt-bug]]).

## 8. Plan d'implémentation (phasé)

**Direction retenue = ② (abonnement de l'élève, tout automatisé par Dowze).** Objectif : **zéro copier-coller**
(cf. §0) + rendu **« barre latérale IA façon Firefox » embarquée** (cf. §2). On construit **le cœur mémoire
d'abord** (indépendant du moteur), puis le panneau navigateur.

### ✅ PHASE 1 — Cœur mémoire (backend, indépendant du moteur) — **FAIT & EN PROD (08/2026)**
La boucle capter→synthétiser→réinjecter, testable sans navigateur. Livré :
- **Compagnon-pont** `ensureBridgeAgent` → `mode='bridge'` (« Pont IA », réservé système comme `relay`).
- **② Mémorialiste** : `ingestAiConversation(authId, source, text)` → `copilote.generateStructured` (schéma
  `{titre, synthese, vu[], bloque[], ouOnEnEst, prochaine}`) **nettoie et résume** ; stocke la SYNTHÈSE dans
  `companion_space_knowledge` (espace « Conversations IA », **embeddée** → lue auto par les abeilles via
  `orgSearch`) ; trace au fil du pont.
- **③ Réinjection** : `getBridgeContext(authId)` = `copilote.compose()` (contexte pédagogique : compétence
  visée, niveau, misconceptions) **+ dernière synthèse** (« où on en était ») → prompt prêt à coller.
- `bridgeState(authId)` (liste des synthèses). Endpoints : `POST /companion/bridge/ingest`,
  `GET /companion/bridge/context`, `GET /companion/bridge/state`. Client web `api.ts` (`bridgeIngest`,
  `getBridgeContext`, `getBridgeState`). **Vérifié prod** : conversation fractions captée → synthèse compacte,
  contexte = cours + mémoire, embeddée.
- ⚠️ Reste (affinage P1) : brancher `ingest()`/BKT quand la synthèse se rattache à une compétence
  (aujourd'hui la synthèse va au RAG, pas encore à la maîtrise) ; chunking pour conversations > 14 000 car.

### ⭐ PHASE 2 — Panneau navigateur embarqué — **PIVOT : PUR TAURI (multiwebview), PAS CEF**
**Découverte décisive (08/2026)** : on avait supposé (sans tester) que WebKitGTK (moteur Tauri Linux) serait
bloqué par Cloudflare → **FAUX**. Test empirique : **WebKitGTK charge ChatGPT entièrement**. Donc CEF est
inutile. Implémenté en **multiwebview Tauri** (`unstable`) : `open_ai_panel` redimensionne la webview Dowze à
gauche + `window.add_child(WebviewBuilder("ai", External(url)))` à droite. **✅ VÉRIFIÉ EN IMAGE** : ChatGPT
s'affiche dans la fenêtre Dowze **+ popup de connexion Google apparu = LOGIN FONCTIONNEL**, sans CEF ni le mur
GPU/X11. **✅ Géométrie du dock RÉSOLUE** : le multiwebview Tauri n'applique pas `set_size` sur WebKitGTK
(`bounds()`=0×0) → on arrange les 2 webviews (vrais widgets GTK) dans une **`GtkBox` horizontale** via
`window.default_vbox()` (`arrange_gtk`, Linux) → **split net Dowze GAUCHE / ChatGPT DROITE, pleine hauteur, GTK
gère le resize** (vérifié image). Windows/macOS gardent la géométrie Tauri native. Reste : monter `ai-dock.tsx`
(sélecteur Claude/ChatGPT + toggle), et P2.2 (lire DOM/injecter via `initialization_script` + IPC en ajoutant
chatgpt.com/claude.ai à `capabilities.remote.urls`).
Le code CEF ci-dessous reste **feature-gated OFF** (archive/option), non utilisé.

<details><summary>Ancienne piste CEF (abandonnée — gardée pour archive)</summary>

#### ~~Tauri + CEF~~ (abandonné : WebKitGTK suffit)
Décision produit (long terme, cross-plateforme, zéro dette) : **garder Tauri/Rust** et embarquer un **vrai
Chromium (CEF)** pour le panneau IA. On assume : l'UI Dowze reste sur le webview système (WebView2/WKWebView/
WebKitGTK selon l'OS), et le **panneau IA = CEF** (moteur identique partout, passe Cloudflare).

**Stack retenue (maintenue, pas de colle abandonnée)** : crate **`cef` (github.com/tauri-apps/cef-rs)** —
**maintenu par l'équipe Tauri elle-même** ⇒ la binding CEF↔Rust n'est PAS du DIY jetable. Outils :
`download-cef`/`export-cef-dir` (récupèrent le binaire CEF, `CEF_PATH`) ; exemple de référence **`cefsimple`**.

**Architecture cible (CEF standard, fait proprement)** :
- **Multi-process** : un **exécutable HELPER** (2ᵉ binaire = `cef::execute_process`) pour les sous-process
  Chromium (render/GPU/utility). Bundling par OS : Windows = .exe séparé ; **macOS = Helper .app(s)** dans le
  bundle ; Linux = binaire + `.so` CEF + sandbox. → à intégrer dans le packaging Tauri dès le départ.
- **Boucle d'événements** : **external message pump** (`CefSettings.external_message_pump` +
  `CefDoMessageLoopWork`) pompé depuis la boucle Tauri (tao) — le schéma cross-platform propre pour cohabiter
  avec l'event loop de Tauri (éviter `CefRunMessageLoop` qui prend la main).
- **Embarquement** : créer le navigateur CEF avec `CefWindowInfo` **parenté au handle natif de la fenêtre
  Tauri** (`raw-window-handle` → HWND / NSView / X11) ; le **positionner/redimensionner** sur la colonne droite,
  re-synchronisé sur l'event `resize` de Tauri (le panneau React ne fait que réserver l'espace).
- **DOM ↔ natif** : **`CefMessageRouter`** → le content-script injecté appelle `window.cefQuery({...})` pour
  envoyer la conversation captée au Rust (pas d'IPC Tauri nécessaire) ; `frame.execute_java_script(...)` pour
  **injecter le prompt de contexte**. Le Rust relaie vers l'API Dowze (`POST /companion/bridge/ingest`,
  `GET /companion/bridge/context` — **déjà en prod, Phase 1**).
- **Login persistant** : `CefSettings.root_cache_path` + `cache_path`/`persist_session_cookies` par profil →
  cookies gardés, **l'élève se connecte UNE fois**. UA = Chrome réel (CEF EST Chromium).

**Sous-phases** :
- **✅ P2.0a — Validation CEF+ChatGPT (FAIT)** : `cefsimple` compilé + lancé sur chatgpt.com → **ChatGPT charge
  entièrement, sans blocage Cloudflare** (vérifié en image). Le seul vrai inconnu est levé.
- **✅ P2.0b — Socle CEF dans `apps/desktop` (FAIT, compile)** : dépendance `cef` 151 + `raw-window-handle`
  **optionnelles**, feature **`cef-panel`** (OFF par défaut → build normal INCHANGÉ) ; binaire helper
  `src/bin/dowze_cef_helper.rs` (`execute_process`) ; module `src/cef_panel.rs` (init external message pump :
  `wrap_app!`/`wrap_browser_process_handler!`, `Settings{no_sandbox, external_message_pump}`, `initialize`,
  `do_message_loop_work`, `shutdown`) ; `lib.rs` pilote la boucle (`build().run(|_,e| pump())`) sous la feature.
  **Vérifié** : `cargo check` défaut OK (rien cassé) + `cargo check --features cef-panel` OK (CEF lié).
- **⏭️ P2.0c — Réveil de la boucle** : `on_schedule_message_pump_work` → réveiller la boucle tao (EventLoopProxy/
  `run_on_main_thread`) pour pomper au bon moment (aujourd'hui pump à chaque événement).
- **✅ P2.1 — Navigateur enfant chromeless (CODE COMPILE)** : `cef_panel.rs` — `WindowInfo::set_as_child(xid, Rect)`
  (XID X11 via `raw-window-handle`) + `browser_host_create_browser` + client minimal `wrap_client!` ; Settings
  avec `browser_subprocess_path` (helper) + **`root_cache_path` persistant** (login 1×) ; commande `ai_panel_open`
  (pose une demande) + `tick()` (thread principal : pompe + crée le navigateur quand le contexte est prêt).
  **Vérifié** : `cargo check` défaut OK + `--features cef-panel` OK.
- **✅ P2.0c — Boucle pilotée (FAIT)** : thread qui appelle `handle.run_on_main_thread(cef_panel::tick)` toutes
  les ~8 ms → CEF pompé régulièrement sur le thread principal. `ressources_dir_path`/`locales_dir_path` = CEF_PATH
  en dev.
- **✅ RUNTIME — l'app LANCE, CEF s'initialise (FAIT/vérifié en image)** : `cargo build --features cef-panel` →
  binaire `dowze-desktop` (291 Mo) + `dowze_cef_helper` (22 Mo) ; lancé → **fenêtre Dowze OK** (frontend web/out
  chargé) + **sous-process `dowze_cef_helper` (zygote/network) lancés** avec NOS réglages (`--user-data-dir=…/
  dowze/cef-profile` = login persistant, `--resources-dir-path=CEF_PATH`). Le helper + le profil persistant + la
  boucle **fonctionnent**.
- **⛔ P2.1 runtime — L'EMBARQUEMENT NE REND PAS ENCORE (diagnostic précis)** : le navigateur CEF ne s'affiche
  pas dans la fenêtre. **Cause 1** : `window.window_handle()` (raw-window-handle) renvoie un XID que CEF ne peut
  pas parenter (`ERROR x11_software_bitmap_presenter: XGetWindowAttributes failed for window …`). Sur Tauri/**Linux**
  il faut le XID de la **fenêtre GTK réalisée** → passer par **`window.gtk_window()`** (Tauri l'expose sous Linux),
  créer/réaliser un widget (`gtk::DrawingArea`/`Fixed`) et récupérer son `gdk::Window` XID (via `gdkx11`) pour
  `set_as_child`. **Cause 2** : le process GPU de CEF **crashe** (`GPU process exited unexpectedly exit_code=139`,
  ICD `libGLX_nvidia.so.0` — souci pilote de la machine) → désactiver le GPU compositing pour CEF via
  `App::on_before_command_line_processing` (append `--disable-gpu --disable-gpu-compositing` ou `--in-process-gpu`).
- **✅ Fix GPU appliqué** (`on_before_command_line_processing` → `--disable-gpu`) : le crash GPU a DISPARU (rendu
  logiciel). **✅ Fix XID GTK appliqué** (`gtk_window()` → `gdkx11::X11Window::xid()`). **⛔ Mais le panneau ne
  rend TOUJOURS pas** (`XGetWindowAttributes failed` persiste ; app OK, aucun CEF visible — vérifié image).
- **✅ Option 1 (GtkDrawingArea) — LAYOUT EMBARQUÉ RÉUSSI** : via `default_vbox()`, webview déplacée dans un
  `gtk::Box` horizontal + `gtk::DrawingArea` à droite, réalisée, XID de sa `GdkWindow` → `set_as_child`. Vérifié
  image : **webview Dowze recadrée à gauche + aire panneau 640×860 à droite** (vrai enfant X11).
- **⛔ Mais le rendu CEF échoue toujours** (`XGetWindowAttributes failed` sur la fenêtre de rendu CEF), **identique
  sur 4 configs GPU** (normal / disable-gpu / in-process-gpu / swiftshader). **Cause racine** : rendu CEF
  **windowed** dans une fenêtre X11 embarquée, cassé sur CETTE machine = (a) GPU matériel HS (`libGLX_nvidia.so.0`
  Vulkan → process GPU segfault → présentateur logiciel défaillant) + (b) 2 connexions X11 (GTK 0x05 vs CEF 0x4C).
- **➡️ Voie robuste = CEF OSR (offscreen rendering)** : CEF rend dans un buffer pixels (pas de fenêtre X), on
  peint dans un widget/canvas → immunisé au GPU cassé et au windowing X11 ; propre et portable. Alternatives :
  réparer NVIDIA/Vulkan de la machine (peut débloquer le windowed), ou GtkSocket/XEmbed. **NE PAS tâtonner les
  flags GPU** (4 essais = même échec).
- **⏭️ P2.2 — DOM ↔ natif** : `CefMessageRouter`/`window.cefQuery` (lire la conversation) + `execute_java_script`
  (injecter le prompt) → POST vers `/companion/bridge/*` (Phase 1, déjà en prod).
- **⏭️ P2.3 — Packaging helper par OS** (Windows .exe / macOS Helper .app / Linux .so).

</details>

### PHASE 3 — Capture & réinjection auto (câblage) — s'applique au panneau PUR TAURI
- **P2 — Capture (①)** : parseur claude.ai + chatgpt.com (scroll + `MutationObserver`), dédup → `bridge/ingest`.
- **P3 — Réinjection AUTO (③)** : à l'ouverture, `getBridgeContext()` collé automatiquement dans le composer.
- **P4 — UI pont** : fil « Pont IA » au téléphone, indicateur « mémorisé », bouton « Démarrer le cours ».

### PHASE 4 — Affinages
Maîtrise (BKT) depuis la synthèse ; consolidation nocturne ; multi-profils (jeton par élève) ; garde-fous
enfant.

## 9. Fichiers concernés
- Tauri : `apps/desktop/src-tauri/{tauri.conf.json, Cargo.toml (feature unstable si CEF/enfant),
  capabilities/default.json (core:webview:*, core:event:*), src/lib.rs+tools.rs (commandes)}`.
- Front desktop : `apps/web/src/lib/desktop.ts`, `apps/web/src/components/desktop-frame.tsx`.
- Mémoire/RAG : `addSpaceKnowledge` / `companion_space_knowledge` / `searchSpaceKnowledge`
  (`apps/api/src/companion/companion.service.ts`), pont calqué sur `relay*` + `/companion/mcp`.
- Cours : `apps/api/src/copilote/copilote.service.ts` (`compose`).

## Sources (recherche web, 2025-2026)
- Tauri — Chromium/CEF « pas d'ETA », WebKitGTK instable sous Linux :
  https://github.com/tauri-apps/tauri/discussions/8524 · https://github.com/tauri-apps/tauri/issues/14963
- Tauri v2 multi-webviews (unstable) : https://github.com/tauri-apps/tauri/pull/8280
- Injection init script dans webview externe : https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html
- Turnstile 2025-2026 (clic manuel, signaux réseau, CDP détecté) :
  https://www.capsolver.com/blog/ai/ai-agent-stuck-on-cloudflare-turnstile · https://webclaw.io/blog/cloudflare-turnstile-2026-guide
- Anti-detect (Camoufox non-Chromium requis pour Turnstile) : https://kameleo.io/blog/how-to-bypass-cloudflare-with-playwright
- Extensions lisant le DOM ChatGPT/Claude (précédent) : https://github.com/Trifall/chat-export
- CEF : https://en.wikipedia.org/wiki/Chromium_Embedded_Framework
