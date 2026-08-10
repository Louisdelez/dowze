# Audit complet du système Ruche — 10 août 2026

## Verdict vérifiable

Dowze possède désormais un noyau Ruche cohérent et exécutable : mémoire universelle, graphe d'exécution
récursif, contrats de rôle, handoffs, budgets, centre d'attention, coffre, registre de capacités/runtimes,
état des compagnons, communication multicanale et packages d'espaces reposent sur la même identité de
profil, les mêmes événements et la même provenance. Il ne s'agit pas de prototypes parallèles.

Ce verdict ne signifie pas « 100 % de toute phrase imaginable ». La seule source récupérée contient 16
tours et 191 406 caractères, mais aussi huit marqueurs littéraux `Afficher plus`. Aucun export plus complet
n'a été trouvé localement. L'audit couvre donc tout le texte disponible et toutes les exigences explicites
formalisées dans les réponses, pas les fragments que l'export n'a jamais contenus.

## Source et méthode

- source lisible : `Master/05-journal/2026-08-09-conversation-chatgpt-ruche-complete.md` ;
- source brute : fichier JSON voisin, 8 messages utilisateur et 8 réponses assistant ;
- atomisation : matrice `07-matrice-vision-ruche.md`, identifiants stables et preuve par couche ;
- inspection : schéma, services Nest, outils agents/MCP, clients, interfaces, migrations, tests et dépendances ;
- validation de base : PostgreSQL 15 + pgvector vierge, migrations `0001` à `0083` dans l'ordre réel et seed
  avant `0023` ;
- validation logicielle : typecheck du monorepo, tests, lint, builds Next et API.

## Architecture consolidée

```text
humain / canal / espace
        ↓
événement universel immuable ──→ mémoire temporelle / épisodes / relations
        ↓                                      ↑
run borné → tâche → handoff → tâche enfant ────┘
        ↓
contrat de rôle → capacité → runtime/harness → ressource de calcul
        ↓
énoncé structuré → rendu direct/messages/email/push/voix
        ↓
état opérationnel du compagnon + centre d'attention humain
```

La projection isométrique n'est jamais la base métier. Les compagnons lisent un état durable ; leurs
animations, bulles et déplacements ne font que le représenter.

## Ce qui a été ajouté ou renforcé pendant l'audit

1. Graphe de runs/tâches et écran `/operations`, avec transitions et sorties persistantes.
2. Délégation récursive depuis une abeille, anti-cycle et limites profondeur/fan-out/tâches/temps/crédits.
3. Loi économique de délégation avec coûts explicites dans le plan structuré.
4. Registre normalisé de capacités et bindings agent/runtime.
5. Mémoire temporelle contradictoire conservant toutes les versions.
6. Énoncés séparant faits, personnalité, émotion, relation, prosodie et animation.
7. Interruption vocale et micro-état d'attente correctement nettoyé, y compris pour le relais MCP.
8. État opérationnel distinct de l'animation et sélection de calcul consciente de la confidentialité.
9. Packages d'espaces versionnés/checksummés ; manifestes stricts ; créer/rejoindre réellement distincts.
10. Dépassement de budget transformé en blocage visible dans le centre d'attention.
11. Next.js migré vers 16.3.0 ; configuration Serwist maintenue sous webpack ; vulnérabilités hautes éliminées.

## Données et sécurité

- 23 tables `hive_*`, chacune avec RLS activé et une politique profil-scopée ; 70 index ;
- coffre AES-256-GCM, jetons de réclamation hashés, accès finalisé/temporisé/usage unique/révocable ;
- recherche FTS, trigrammes et pgvector, sans faire de l'embedding une condition de disponibilité ;
- provenance récursive et source brute conservée ; oubli explicite par tombstone ;
- packages vérifiés par checksum et entrée bornée ; mode join limité aux packages officiels/partagés ;
- audit npm production : 0 critique, 0 haute, 2 modérées, 9 faibles. Les 11 restantes sont dans AI SDK 4
  (`ai`/`jsondiffpatch` et utilitaires fournisseurs). Une tentative de migration AI SDK 5 a montré une
  explosion mémoire du typecheck ; elle a été retirée plutôt que livrée instable. Une migration isolée vers
  le SDK actuel reste une dette de sécurité connue.

## Validation effectuée

- migrations `0001..0083` sur base vierge : succès ;
- schéma Ruche : 23/23 tables avec RLS, 23 politiques, 70 index ;
- `npm run typecheck` : 14/14 paquets ;
- `npm test` : 180/180 tests ;
- builds hors paquet natif : 9/9 cibles, dont API et 43 routes web ;
- build web Next 16 + service worker Serwist : succès ;
- lint : les avertissements historiques `max-lines` sont non bloquants ; toute erreur liée à ce chantier doit
  être corrigée avant clôture.

## Limites qui ne peuvent pas être honnêtement déclarées actives

- moteurs réels image, musique, chant et 3D : adaptateurs/registre prêts, fournisseur non choisi ;
- allocation de GPU physique et contrôle des couches internes d'un modèle propriétaire : hors contrôle de
  Dowze ; le scheduler local sélectionne les ressources déclarées, pas les internals du fournisseur ;
- transports push/email et voix premium : rendu/file locale prêts, compte fournisseur absent ;
- connexion aux abonnements Codex/Claude : pont MCP prêt, activation volontaire et jeton utilisateur requis ;
- production : migrations, secrets et déploiement demandent une autorisation et un environnement réel ;
- fragments derrière les huit `Afficher plus` : absents de l'export disponible, donc impossibles à auditer.

Ces limites sont des frontières externes ou des données sources absentes. Elles ne justifient ni une fausse
affirmation de complétude absolue, ni la création d'une seconde architecture concurrente.

## Déploiement production du 10 août 2026

Production auditée avant changement : serveur `epicube-prod`, Traefik, Supabase autohébergé, API et worker
NestJS, Redis et frontends Next.js conteneurisés. Tous les domaines publics répondaient en 200. La base était
au registre `0068`, le web au commit `f865fbd` et l'API à `e6b90ef`.

Déploiement effectué avec :

- dump pré-release vérifié par `gzip -t`, checksum SHA-256 conservé sur le serveur ;
- archive de l'ancien source et anciennes images Docker immuables conservées pour rollback ;
- release principale `281970409a95`, correctif session `dfa2050a01a1`, puis correctif d'hydratation du décor
  `59d9ce5a30c2` ;
- migrations additives `0069..0083`, chacune en transaction et enregistrée avec son checksum ;
- images finales : API `281970409a95`, web `59d9ce5a30c2` ;
- schéma final : 23 tables Ruche, 23 avec RLS, 23 politiques, 70 index, extensions `vector` et `pg_trgm` ;
- `/health`, API/worker, huit routes web Ruche, contrôles 401 sans jeton et lectures 200 avec jeton éphémère ;
- Lighthouse production `/operations` : 100 accessibilité, 100 bonnes pratiques, 100 SEO et 100 navigation
  agentique, 0 audit échoué.

Aucune donnée utilisateur de test n'a été créée. Le jeton de smoke-test authentifié expirait après cinq
minutes et n'a servi qu'à des lectures. Les services satellites sont restés disponibles pendant la release.
