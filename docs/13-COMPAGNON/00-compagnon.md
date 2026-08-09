# 00 — Le Compagnon Dowze (conception & plan)

> Humaniser l'IA de Dowze avec un petit compagnon **ambiant** qui montre, en mots simples et rassurants, ce
> qui se passe « derrière » — sans terme technique, sans intrusion, sans culpabilité. Fondé sur 3 recherches
> sourcées (2026).

## 1. Ce que dit la recherche (résumé actionnable)

- **Le modèle qui gagne = le « Pet » de Codex (OpenAI, 2026)** : le personnage **incarne l'état de la
  machine** (en cours / a besoin de toi / prêt / bloqué) mais **ne participe pas à la conversation, « pour ne
  pas distraire »**. Ambiant, optionnel, périphérique. C'est le patron le plus transposable.
- **Clippy = l'anti-modèle** : activé par défaut, dur à couper, **interruptions non sollicitées**, fausse
  aide, **zéro mémoire du "non"**. Cause racine : mauvaise application de la recherche CASA (un visage qui
  interrompt = « un intrus agaçant »).
- **Duolingo** : charmant **et** manipulateur — la **culpabilité/streak** provoque des crises d'angoisse chez
  les enfants. À **ne pas** copier pour un public jeune.
- **Science** : (1) la réponse sociale est automatique et gratuite (CASA — un nom + un « je » chaleureux
  suffit) ; (2) **« labor illusion »** (Buell & Norton 2011) — montrer le **vrai** travail augmente la valeur
  perçue et la confiance, mais du théâtre scripté la détruit ; (3) seuils de Nielsen (< 1 s rien, 1-10 s
  boucle + label, > 10 s narration d'étapes) ; (4) rester **stylisé/cartoon** (vallée de l'étrange) ; un
  visage ≠ du lien, il doit gagner sa place par sa **fonction** (détails séduisants de Mayer) ; (5) pour les
  enfants, **honnêteté non négociable** (ils sur-font confiance) et **zéro dark pattern**.
- **Meilleurs modèles éducatifs** : **Khanmigo** (questions **socratiques** avant d'agir) et **Woebot**
  (assume d'être un robot).

## 2. Le bon rôle (alignement avec Dowze)

Dowze = **compose/ingest** : le *prof* reste l'IA de l'élève ; **Dowze orchestre** (prépare le prompt, note
la séance, organise le planning). Donc le compagnon **n'est pas le professeur** — c'est **le petit assistant
qui prépare, note et range**. Il dit ce que l'IA de Dowze fait *vraiment*. Il ne prétend jamais enseigner.
Honnête **et** fidèle au produit.

## 3. Persona & visuel

- Petit personnage **SVG stylisé**, trait unique façon **Lucide** (maison : **Lucide only, jamais d'emoji**),
  neotène (grands yeux doux) pour éviter la vallée de l'étrange. Né de l'étincelle Dowze.
- **Premier plan**, coin bas par défaut, **déplaçable à la souris** (drag), position mémorisée. Jamais modal ;
  le reste de l'overlay laisse passer les clics (`pointer-events:none` sauf le personnage/la bulle).
- Ton : chaleureux, **tutoiement**, **non-punitif**, borné (assistant, pas « ami »).

## 4. Modèle d'états (mappé sur l'IA réelle de Dowze)

Peu d'états, très lisibles. Micro-copie FR ≤ 6 mots, plusieurs variantes (rotation anti-robot).

| État | Quand (dans Dowze) | Micro-copie | Animation |
|---|---|---|---|
| `idle` | rien en cours | *(silencieux)* « Je suis là. » | respiration lente |
| `reading` | ingest lit ton résumé | « Je lis ce que tu as écrit… » | penché, regard bas |
| `thinking` | generateStructured (1-10 s) | « Je réfléchis… » | « ••• » qui pulse |
| `preparing` | compose / ingest → snapshot | « Je prépare ton prompt… » / « Je note ça… » | gribouille |
| `organizing` | moteur planning / orchestrateur | « J'organise ton planning… » | range des blocs |
| `almost` | tâche longue (> 10 s) | « Presque fini ! » | accélère |
| `done` | résultat livré | « Voilà ! » | pop + sourire → idle |
| `ask` | besoin d'un choix (rare, plafonné) | « Je peux te demander un truc ? » | lève la main, « ? » |
| `retry` | **ta** tentative à refaire | « Presque ! On réessaie ? » | hochement |
| `error` | **vraie** erreur technique | « Oups, un petit souci de mon côté. » | épaules basses (pas de rouge) |
| `offline` | pas de réseau | « Je n'arrive pas à me connecter. » | « zzz » |

**Règle non-punitive cardinale** : `error` (faute du *compagnon*, il s'excuse) est **strictement séparé** de
`retry` (ta tentative). Le compagnon **ne confond jamais son erreur avec la tienne, et ne culpabilise
jamais**. Il **remplace** la micro-copie dispersée actuelle (« réfléchit/prépare/génère/un instant ») par une
**seule voix cohérente**.

## 5. Règles d'interaction (anti-Clippy)

- **Silencieux par défaut** : le *statut* s'affiche car lié à un **vrai** travail ; les **questions
  proactives** sont l'exception **plafonnée** (≤ 1/session, recule si ignorée) et déclenchées **sur les
  pauses**, jamais pendant la frappe/un exercice.
- **Une** question à la fois, réponse en 1 tap ; **toujours** une croix ; **ignorer = réponse valide**.
- **Se souvient** des refus. **« Mode calme »** pour le mettre en veille. **Jamais bloquant.**
- Debounce < ~700 ms : si ça répond vite, on saute direct à `done` (pas de clignotement « faux »).

## 6. Architecture technique

- **`lib/companion-bus.ts`** (TS pur, hors React) : machine à états + émetteur. `aiTask(opts, fn)` enveloppe
  une promesse IA → `thinking` (debounced) → `done`/`error`, avec **compteur d'actifs** (concurrence). Piloté
  par le **cycle de vie réel** des requêtes (pas de frise fake). Détection `navigator.onLine` → `offline`.
- **`components/companion/companion-provider.tsx`** : s'abonne au bus, tient l'état + la position, rend
  l'overlay. Monté dans `app/layout.tsx` → **présent sur TOUTES les pages** (publiques et app).
- **`components/companion/companion.tsx`** : personnage SVG + bulle + **drag (Pointer Events, souris+tactile,
  `setPointerCapture`)** + accessibilité. Seuil pour distinguer clic (toggle bulle) et déplacement.
- **`app/globals.css`** : keyframes (`breathe`, `bob`, `dots`, `pop`) sur `transform`/`opacity` ; coupées par
  `prefers-reduced-motion`.
- **Câblage** : `api.ts` enveloppe les appels IA (`composeSession`, `ingestSummary`, `generate*`,
  `composeLanguageSession`, `translateMessage`…) avec `aiTask` + message spécifique. Une ligne par appel.
- **Tâches de fond** (worker/BullMQ) : réutiliser le **SSE/Redis** existant (comme la messagerie) pour pousser
  les états (« je prépare tes exercices… ») même en changeant de page. *(phase C3)*
- **Rendu** : SVG inline + keyframes CSS (léger, GPU, CSP-safe, cohérent Lucide). Lottie seulement si un jour
  une réaction « hero ».

## 7. Accessibilité

- Le dessin est **`aria-hidden`** ; le sens passe par une région **`role="status" aria-live="polite"`**
  (transitions seulement, throttlées) et **`role="alert"`** réservé aux vraies erreurs. `aria-atomic`.
- **`prefers-reduced-motion`** coupe les boucles (pose statique + fondu), le **texte** de statut reste.
- Bulle/pastilles au clavier ; le focus n'est **jamais** volé quand la bulle apparaît.

## 8. Garde-fous (RGPD, enfants, responsable)

- **Opt-in / désactivable** sans le chercher ; **consentement** pour le personnel (rappels, humeur).
- **Zéro dark pattern** : pas de culpabilité, pas de fausse urgence, pas de faux travail, pas de streak-
  couperet. **Honnête** : c'est l'assistant IA de Dowze, pas un vrai ami. **Modeste** (contre la sur-confiance).

## 8bis. Mode « cam » / mondes (immersion « study-with-me »)

**Idée.** Un mode d'affichage optionnel où le compagnon passe du petit pet flottant à une **tuile façon
visio Discord** (rectangle à bords arrondis) : le pet, à **taille fixe**, posé devant un **décor** (« monde »)
au choix, avec pastille « en direct » + nom — comme s'il était **en appel/en cours avec l'élève**. Pensé pour
les phases de **concentration / cours** : présence, immersion, ambiance de travail.

**Pourquoi (recherche).** Combinaison de trois leviers connus :
- **Body-doubling / « study with me »** (*Focusmate*, *StudyStream*, *Study Together*) : travailler « en
  présence » de quelqu'un réduit la procrastination et crée de la responsabilité.
- **Compagnon de focus** (*Forest*, *Finch*, *Flora*) : un pet qui « travaille avec toi » motive et casse la
  solitude du travail.
- **Ambiance cozy** (*Lofi Girl*) : personnage qui étudie + décor cohérent = atmosphère de concentration.

**Mise en œuvre (en prod, 2026-07-23).**
- **Décors en SVG/CSS** (`components/companion/companion-worlds.tsx`), zéro asset externe, nets et theme-safe :
  salle de classe, plage, piscine, espace, forêt, café. Faciles à étendre (ajouter une scène + une entrée `WORLDS`).
- **Tuile cam** (`companion-cam.tsx`) : rounded-2xl, décor plein cadre, pet centré au sol à taille **fixe**
  (≈ 62 % de la hauteur), ratio 4:3 ; **seule la tuile se redimensionne** (`camSize`), pas le pet.
- **Global** (`companion.tsx`) : quand `camMode`, on rend la tuile (déplaçable, redimensionnable) au lieu du pet ;
  dimensions généralisées (largeur/hauteur) pour le clamp/drag.
- **Réglages** (picker « Mon compagnon », dans *Mon Copilote*) : interrupteur *Mode cam*, choix du monde
  (miniatures live), curseur *Taille de la cam*, aperçu live. **Perso au compte** : `camMode/world/camSize`
  ajoutés à `profiles.companion` (jsonb) et à la synchro.
- **Suite possible** : activation automatique en page de séance/focus ; sons d'ambiance ; anim « étudie » dédiée.

## 8ter. Tamagotchi (soin du compagnon)

**Idée.** Le compagnon devient un **Tamagotchi** : on s'en occupe (nourrir, jouer, dormir, nettoyer, soigner,
câliner). Objectif : **humaniser + rendre attachant + boucle d'engagement quotidienne** (revenir chaque jour
prendre soin de lui → et par la même occasion étudier). À faire **avant les cours / pendant les pauses**.

**Fonctions Tamagotchi (A→Z) implémentées.**
- **Jauges de besoins** (0..100) : satiété, bonheur, énergie, hygiène, santé.
- **Décroissance en temps réel** : recalculée **au timestamp** côté serveur (pas de cron) — à chaque lecture/action
  on applique le temps écoulé depuis `last_tick`. Santé baisse si négligé, régénère sinon.
- **Actions de soin** : `feed / play / sleep / clean / heal / cuddle` (effets sur les jauges + réaction visuelle).
- **Âge** (jours depuis `born_at`) et **humeur** dérivée (`affamé/fatigué/sale/triste/malade/content/ok`) → mappée
  sur une animation du pet (l'écran réagit).

**Calibrage (aligné philo non-punitive).** Décroissance **douce**, récupération **facile**, **pas de mort
permanente** : négligé, il devient triste/malade puis « s'endort », toujours réveillable en s'en occupant.

**Implémentation (en prod, 2026-07-23).**
- Backend : table `pet_care(profile_id, satiety, happiness, energy, hygiene, health, born_at, last_tick)`
  (migration `0052`) ; `PetCareService` (décroissance + actions) ; routes `GET /companion/care` et
  `POST /companion/care/:action`.
- Front : page dédiée **`/compagnon`** (lien nav « Apprendre ») — le pet dans son **monde** (réutilise les décors),
  5 **jauges**, humeur, âge, 6 **boutons de soin** ; refresh périodique (reflète la décroissance).
- **Suite** : lier à l'étude (gagner des friandises/soins en révisant), évolution/stades, notifications de rappel,
  poids, mini-jeux.

## 8quater. La « Maison » — jeu isométrique (Habbo × Animal Crossing × Dofus)

**Vision.** Des **espaces** (pièces intérieures : chambre, salon, cuisine, bureau ; extérieurs : jardin, plage…)
en **2,5D isométrique**, vides au départ (sol + murs), que l'utilisateur **meuble** et où le **compagnon se
déplace librement**. Style **rétro pixel cute / cosy / chill** — un mélange Habbo Hotel, Animal Crossing, Dofus,
Tamagotchi. But : maison à soi, confort du compagnon, attachement.

**Références & analyse.** Habbo Hotel (pièces iso à meubler, « furni », depth-sorting) ; Animal Crossing
(déco cosy, extérieur/intérieur) ; Dofus (iso 2,5D, tuiles, personnages qui passent devant/derrière) ; Tamagotchi
(soin). Le socle technique commun = **projection isométrique sur grille de tuiles** + **tri par profondeur**
(painter's algorithm) pour le premier/arrière-plan.

**Technique (implémenté — socle, en prod 2026-07-23).**
- **Grille iso** `COLS×ROWS`, tuile 2:1 : `screen(c,r) = ( (c−r)·TW/2 , (c+r)·TH/2 )`. Sol = losanges SVG, deux
  **murs** (parallélogrammes) pour l'intérieur ; extérieur = ciel, sans murs.
- **Compagnon qui marche** : clic sur une case → déplacement animé (rAF, lerp), anim `running-right/left` selon la
  direction, `idle` à l'arrêt.
- **Profondeur & perspective** : entités (meubles + compagnon) **triées par `c+r`** (premier/arrière-plan → passe
  devant/derrière les meubles) et **mises à l'échelle selon la profondeur** (plus loin = plus petit) — la « perspective »
  demandée.
- **Meubles** : palette + placement au clic (une entrée par case), retrait au clic en mode *Aménager* ; **sauvegardés
  par compte** (table `pet_room(profile_id, room, items jsonb)`, migration `0053` ; `GET/PUT /companion/room`).
- **Pièces** : presets (couleurs sol/murs, intérieur/extérieur) commutables.
- Fichiers : `components/companion/companion-room.tsx` ; onglets **Soin / Maison** dans la page `/compagnon`.

**Pipeline PNG (meubles générés par IA).** Objectif : générer des **PNG transparents** (ChatGPT/image gen) et les
placer. Le catalogue de meubles supporte deux rendus : **SVG** (starter, actuel) ou **image PNG**. Pour ajouter des
PNG : soit les déposer dans `public/furniture/<id>.png` + une entrée catalogue, soit (mieux) un **flux d'upload**
identique aux pets (stockés/servis par l'API, cf. bibliothèque de pets). À faire.

**Roadmap.** Meubles PNG (upload IA) ; footprints multi-cases + rotation ; objets « au mur » ; collisions/pathfinding
(A*) ; interactions (le pet utilise les meubles : dort dans le lit, mange à la table) ; visites d'amis (social) ;
extérieurs (mer/piscine/jardin public) ; zoom/scroll ; économie (acheter des meubles en étudiant).

## 9. Plan phasé

| Phase | Contenu |
|---|---|
| **C0** | Bus + machine à états + provider + personnage SVG déplaçable (premier plan, toutes pages), région aria-live. |
| **C1** | Brancher les **états de statut** sur les appels IA existants (`api.ts`) → remplace la copie dispersée. |
| **C2** | **Bulle + questions socratiques** (plafonnées, une à la fois) + « mode calme » + anti-Clippy complet. |
| **C3** | Tâches de fond via **SSE** + encouragements (jamais de culpabilité). |
| **C4** | Étendre aux satellites (fitness/sports/alimentation) — visage unique de l'IA de Dowze partout. |

## 10. Sources (recherche 2026)

Codex « Pets » (docs OpenAI `learn.chatgpt.com/docs/pets`) ; Clippy / Office Assistant (Wikipedia) ; Duolingo
(KDD'20 Yancey & Settles ; Lenny's Newsletter) ; CASA / *The Media Equation* (Reeves & Nass) ; « Labor
Illusion » (Buell & Norton 2011, *Management Science*) ; seuils de réponse (Nielsen / NN/g) ; vallée de
l'étrange (Mori) ; détails séduisants / multimédia (Mayer) ; agents pédagogiques & effet-persona (Lester
1997) ; parasocial & sur-confiance des enfants (Vollmer 2018) ; dark patterns (Brignull ; FTC/UE) ; guidelines
Human-AI (Microsoft, Amershi et al. 2019 ; Google PAIR) ; Khanmigo ; Woebot ; ARIA live regions & reduced-
motion (MDN/W3C).
