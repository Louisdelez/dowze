# 03 — Audit complet (03-08-2026) : sécurité, bugs, perf — corrigé / restant

> Audit à 4 axes (bugs backend, sécurité, frontend, performance) + audit opérationnel de la prod,
> mené le 03-08-2026. Chaque finding a été **vérifié dans le code** (fichier:ligne) ; les plus critiques ont
> été **corrigés et déployés le jour même** (API + web), avec vérification en prod. Ce document liste ce qui
> a été corrigé et le backlog priorisé de ce qui reste.

---

## 1. Corrigé et DÉPLOYÉ (03-08-2026)

### Sécurité — CRITIQUE

- **IDOR généralisé (le finding le plus grave)** : le guard `SupabaseAuthGuard` *authentifiait* (JWT valide)
  mais n'*autorisait* rien — ~26 contrôleurs prenaient le `profileId` du client (body/URL) sans vérifier son
  appartenance au compte. Tout utilisateur connecté pouvait **lire/écrire les données de n'importe qui**
  (progression, carnet, réglages) et **dépenser les crédits d'autrui** (cours, ingest, traduction).
  **Fix** : `auth/ownership.service.ts` (profils du compte + comptes supervisés via `guardians`, cache 60 s,
  re-lecture avant refus) + le guard vérifie désormais tout `profileId` revendiqué → **403**.
  *Vérifié en prod : son profil = 201, profil d'autrui = 403 (compose ET observe).*
- **4 contrôleurs SANS authentification** : `bridge`, `community`, `moderation`, `spaced-repetition` étaient
  accessibles sans jeton. **Fix** : `@UseGuards(SupabaseAuthGuard)` au niveau classe.
  *Vérifié : `GET /moderation/incidents` sans jeton = 401.*
- **`GET /accounts/:id/profile` sans guard** : fuite de profil (pseudo, date de naissance) pour tout
  accountId. **Fix** : guard ajouté.
- **Traduction non facturée** : `translate()` n'appelait jamais `tryDebit`/`reconcile` en mode crédits →
  usage LLM plateforme gratuit illimité. **Fix** : même plomberie hold→reconcile (+ refund sur échec) que le
  reste du Copilote.
- **Jeton admin comparé en temps non constant** (`credits/grant`). **Fix** : `crypto.timingSafeEqual`
  (helper `safeEqual`), + bypass admin propre dans le guard pour les opérations transverses.

### Bugs — CRITIQUE/HAUTE

- **Boucle infinie du parser Markdown** : une ligne `$$$$` (ou toute ligne « spéciale » non consommée)
  figeait l'onglet (régex `isSpecial` ≠ branches de la boucle). **Fix** : régex harmonisées + garde-fou
  anti-blocage + support des blocs `$$ … $$` **multilignes** (forme courante chez les LLM).
- **Clôture de séance qui perdait le travail** : `closed=true` était posé AVANT l'appel réseau → un échec de
  `closeCourse` laissait le bouton « Séance clôturée » définitivement inactif, maîtrise jamais enregistrée.
  **Fix** : verrouillage seulement après succès, le parent relance l'erreur, bouton ré-essayable
  (séance + langues).
- **Pont IA : progression écrite sur le MAUVAIS profil** (multi-profils : le parcours peut vivre sur un
  autre profil que le 1er du compte, cf. `ensureServiceOrg`). **Fix** : `studentProfileIdForAuth` (profil
  porteur du `learner_rank`) utilisé pour `compose`/`applyProgress` du pont ; `profileIdForAuth` rendu
  déterministe (`orderBy createdAt`).
- **Erreurs 402/503 invisibles ou fuyantes** : le mode AUTO avalait tout (« Réessaie » en boucle avec un
  solde à 0) ; `/langues` affichait le body brut de l'API et cachait l'erreur dans une section conditionnelle ;
  page blanche hors connexion. **Fix** : messages différenciés 402 (crédits) / 503 (modèle) partout, note
  d'erreur au niveau page, EmptyState de connexion, catch sur `getLanguages`.

### Bugs — MOYENNE/BASSE

- Toggle AUTO/manuel masqué pendant un cours en cours (il démontait la feuille → réponses perdues).
- Cul-de-sac après clôture `progres`/`bloque` → bouton « Nouvelle séance ».
- Minuteur arrêté à la clôture du cours (la cloche ne sonne plus 30 min après avoir fini).
- Module `exemple` : la 1re étape est toujours visible (liste vide si le LLM marquait tout `reveal`).
- Emoji `⏱` du minuteur → `IconClock` (convention Lucide-only).
- Debounce d'ingest du pont IA nettoyé au démontage.

### Performance

- **`loadGraph()` sans les embeddings** : le chemin le plus chaud de l'API (chaque compose/cours) chargeait
  ~8 Ko de vecteur par compétence pour rien. **Fix** : projection explicite.
- **Feuille A4 : re-renders** : chaque réponse re-rendait TOUTE la feuille (re-parse Markdown + KaTeX).
  **Fix** : `memo` sur `ModuleView` + `Markdown`, `useCallback` sur le callback de réponse.
- **Opérationnel** : 30 images Docker orphelines purgées (**10,6 Go** récupérés). RAM/CPU/disque sains,
  zéro erreur dans les logs 24 h, tables < 5 Mo bien indexées.

*Qualité : typecheck 0 erreur (api, web, schemas) ; tests 68/68 (api) + 7/7 (schemas).*

---

## 2. Backlog PRIORISÉ (vérifié dans le code, non corrigé)

### P1 — intégrité des données — ✅ FAIT (04-08-2026, migration 0067 + déployé, vérifié prod)

1. ✅ **Idempotence des clôtures** : table `course_closures` (PK `(profile, skill, jour)`) →
   `copilote.closeCourse` idempotent (*vérifié prod : 2e/3e clôture = `alreadyClosed`, attempts +1 une
   seule fois*). Langues : garde `alreadyPracticedToday` → une seule progression `level += step` et une
   seule ligne d'activité par jour.
2. ✅ **Races find-or-create** : index uniques (migration `0067`) — `(profile_id, lower(name))` sur les
   espaces, partiels `mode='bridge'`/`mode='relay'`, `status='active'` par profil pour les langues — +
   `onConflictDoNothing` + re-lecture dans `ensureSpaceByName`/`ensureBridgeAgent`/`ensureRelayAgent`.
   *(Restent : `assignLanguageClass` MAX_SIZE, `MAX_PETS` — impact faible.)*
3. ✅ **BKT/FSRS** : `progression.observe` et `fsrs.rate` en `db.transaction` + `SELECT … FOR UPDATE`.
4. ✅ **`ingest`** : application pédagogique D'ABORD (échec → refund du hold), réconciliation ENSUITE.
5. ✅ **Dates locales** : `common/local-date.ts` (`Europe/Zurich`) pour streak langues, maintenance et
   clôtures (fini le décalage autour de minuit).

### P2 — sécurité résiduelle

6. ✅ **Rate limiting par COMPTE** (04-08) : `AccountThrottlerGuard` (tracker = `sub` du JWT, repli IP)
   remplace le guard global, + limites dédiées sur les routes LLM : `cours` 6/min, `ingest` 10/min,
   `exercises/generate` 10/min, `translate` 20/min, langues `course` 6/min · `ingest` 10/min.
   *Vérifié prod : 6× 201 puis 429 sur `/copilote/cours`.* (Plafond JOURNALIER par profil : reste à faire.)
7. **Pont IA desktop : événements non fiables** : une page piégée dans le panneau peut émettre
   `dowze://ai-capture` forgé → empoisonnement de la mémoire RAG + inflation de maîtrise (auto-scopé).
   Fix : capture sur action explicite de l'élève + confirmation avant toute progression issue du pont.
8. ✅ **`chatbot` langues** (04-08) : l'appelant doit désormais être PARTICIPANT de la conversation
   (`conversationParticipants`), sinon 400.

### P3 — robustesse IA — ✅ FAIT (04-08-2026, déployé)

9. ✅ **`ensureServiceOrg`** ne recalibre plus que si le **rang** a changé (`seedRank` stocké dans le
   persona) — le ré-entraînement des profs (`retrainAgent`) n'est plus écrasé à chaque passage.
10. ✅ **`verifyDrafts`** : vérificateur indisponible → ébauches en **quarantaine** (`emergent`, sources
    retirées) + log — plus de fail-open silencieux.
11. ✅ **Dimension d'embedding** : `updateSettings` refuse tout modèle ≠ 1024 dims avec un message
    actionnable (la ruche pgvector est en `vector(1024)`).
12. ✅ **Prompt QA du cours** : plus de troncature en plein JSON (revue sautée au-delà de 20 k, cf. §P4.14).

### P4 — performance

13. ✅ **pgvector `skills` + `carnet_entries`** (04-08, migration `0068`) : colonnes `embedding_vec
    vector(1024)` + HNSW + **triggers de synchro** (`sync_embedding_vec` — les chemins d'écriture `real[]`
    restent inchangés) + backfill (202/202 skills). `semanticRelatedSkills`/`semanticRelatedNotes` = KNN SQL
    (plus de full scan + cosinus JS) ; backfill paresseux du carnet borné à 20 notes récentes.
14. ✅ **Cache Redis de la feuille de cours + QA hors chemin critique** (04-08) : clé
    `course:{profileId}:{skillId}` TTL 24 h, invalidée par `applyProgress`/`ingest` ; l'Évaluateur tourne
    EN FOND et remplace la version en cache s'il corrige ; plus de troncature du JSON de revue (skip > 20 k).
    *Vérifié prod : 1er appel 15,3 s (génération seule), réouverture **0,4 s** (0 crédit).*
15. ✅ **`compose()` parallélisé** (04-08) : les blocs indépendants en `Promise.all` (2 vagues) + nouvelle
    `carnet.lastNoteFor(profile, skill)` `LIMIT 1` (fini le chargement de TOUT le carnet).
    *Vérifié prod : compose = 372 ms à chaud, section sémantique présente (KNN OK).*
16. **`carnet.list` sans pagination ni projection** (embedding inclus dans le payload HTTP) — reste à faire
    pour l'endpoint HTTP (le chemin chaud `compose` n'en dépend plus).
17. ✅ **KaTeX en `next/dynamic`** (04-08) : chargé à l'affichage d'une fiche seulement, ne pèse plus sur
    /seance et /langues au chargement.
18. **Dockerfile web : `output: 'standalone'`** (image 1,78 Go → ~300 Mo) + ordre des layers
    (`package.json` avant les sources pour cacher `npm ci`).
19. **`seedRoleAgent` en boucle** (~26 requêtes pour créer une école) → insert multi-lignes.
20. **`orchestrateSpace`/`runProject`** : re-QA après retry supprimable ; re-déléguer seulement aux membres
    pointés par la note QA.
21. Divers : `relayPull` non atomique (livraison en double) ; écart de `reconcile` non journalisé ;
    index `(profile_id, skill_id, created_at desc)` sur carnet si fix 15.

---

## 3. Vérifié SAIN (à ne pas « re-fixer »)

- **Injection SQL** : toutes les requêtes brutes utilisent le tag `sql` de drizzle (bind params), zéro
  concaténation.
- **Crypto BYOK** : AES-256-GCM correct (IV aléatoire, tag vérifié), clé jamais exposée ni loggée.
- **XSS KaTeX** : `renderToString` sans `trust:true` → sortie échappée.
- **Sorties LLM** : contraintes par schémas Zod avant toute écriture (pas d'écriture arbitraire),
  prompts scopés au profil (pas de fuite cross-profil par le LLM).
- **Comptage des modules de la feuille** (`expected`/`onGraded`) : cohérent, un seul grade par item.
- **`aiTask`** : l'état ne reste pas coincé sur erreur.

**Voir aussi** : [01-reste-a-faire](01-reste-a-faire.md) · [02-deploiement](02-deploiement.md) ·
[le moteur (garde-fous)](../10-APP-WEB/23-ia-de-dowze-le-moteur.md) ·
[cours natif](../10-APP-WEB/30-cours-natif-feuille-modules.md).
