# Ruche Dowze — continuité universelle, contrats de rôle et routage social

> Consolidation de la conversation « Ruche IA et modèle Kimi » (16 messages, export Chrome du
> 2026-08-09) avec l'architecture Compagnon déjà implémentée. L'export contient huit marqueurs littéraux
> `Afficher plus` : le texte récupéré est archivé sans altération, mais les fragments non développés ne
> peuvent pas être reconstitués. Ce document est la référence de conception
> pour éviter deux systèmes concurrents.

## 1. Principe directeur

Dowze n'est ni un chatbot unique, ni une collection de conversations isolées. C'est une **Ruche** :

- le compagnon principal est l'interface universelle et le *Chief of Staff* de l'utilisateur ;
- les compagnons spécialisés sont des membres incarnés d'organisations et d'espaces ;
- la fonderie crée, évalue, consolide, fusionne ou retire les spécialistes ;
- les sessions de modèles sont des détails d'exécution jetables ;
- la continuité réelle est un journal durable d'événements significatifs ;
- toute personne virtuelle est une porte d'entrée valide, mais aucune ne prétend tout savoir ;
- le même contenu est présenté différemment selon le canal humain.

Formellement :

```text
Dowze = Hive + Companions + Organizations + Memory + Channels + Tools + Governance
Output = Content × Personality × Emotion × Relationship × Channel
Route = shortest valid organizational path
```

## 2. Alignement avec l'existant

| Vision consolidée | Brique Dowze existante | Consolidation |
|---|---|---|
| Reine / compagnon principal | `companion_agents.is_primary`, orchestration Maison | conservé ; devient point d'entrée et de retour |
| Abeilles spécialisées | agents `mode=agent`, rôles, embeddings, open-spaces | conservé ; contrat de rôle explicite ajouté |
| Ruche scalable | shortlist lexicale + pgvector, fan-out borné | conservé |
| Fonderie | création à la volée, qualité EMA, merge, prune, retrain | conservé |
| Entreprises / écoles | `companion_spaces`, templates, service Académie | conservé |
| Travail structuré | orchestration par rôle, SOP projet, QA et retry borné | conservé |
| Mémoire d'un compagnon | `companion_messages` | conservée comme projection locale pour l'UI |
| Mémoire d'organisation | `companion_space_knowledge` | conservée comme connaissance/RAG |
| Mémoire universelle | absente auparavant | `hive_events` devient le registre transverse |
| Délégation sociale | implicite dans les appels d'agents | `hive_handoffs` rend le passage de relais traçable |
| Direct / Messages / mail / push / voix | UI téléphone et relais partiels | `hive_deliveries` unifie la représentation par canal |
| Fidélité de rôle | prompts/catalogue de rôles | `role_contract` encode capacités, limites et escalades |

`companion_messages` n'est donc pas supprimée : c'est une **vue conversationnelle locale**. Elle ne doit
plus être considérée comme la mémoire fondamentale. Une future reconstruction de fil peut être produite à
partir de `hive_events` et `hive_deliveries`.

## 3. Modèle de mémoire

### 3.1 Événement universel

Un `hive_event` représente un fait significatif : demande reçue, message envoyé, règle apprise, outil
utilisé, délégation, décision, livrable, erreur, validation ou changement d'état. Il contient :

- l'acteur et le sujet éventuels ;
- l'espace/organisation ;
- le type, le canal, la visibilité et l'importance ;
- le contenu et des métadonnées structurées ;
- les événements sources pour la provenance ;
- le moment réel de l'événement, indépendant d'une session LLM.

Les événements sont append-only dans le flux normal. Les synthèses, embeddings et vues sont dérivés ; ils
ne remplacent jamais la source.

### 3.2 Niveaux dérivés

```text
Événements bruts
├── mémoire de travail (contexte récent pertinent)
├── mémoire compagnon (relation, préférences, règles)
├── mémoire espace (projet, équipe, artefacts)
├── mémoire utilisateur (continuité transverse autorisée)
└── consolidations (résumés, embeddings, connaissances stables)
```

La récupération doit combiner récence, importance, pertinence sémantique, permissions et portée. La
compaction d'une session ne doit jamais supprimer la mémoire durable.

## 4. Contrat de rôle et fidélité

Chaque compagnon peut porter un `role_contract` :

```text
responsibilities  ce dont il est responsable
capabilities      ce qu'il sait légitimement traiter
limitations       ce qu'il ne doit pas traiter
delegatesTo       les rôles auxquels il peut transmettre
escalationPath    la chaîne de responsabilité
allowedTools      les outils autorisés dans ce rôle
```

Règle impérative : **role fidelity before answer generation**. Un compagnon hors périmètre ne simule pas
une expertise généraliste ; il reconnaît naturellement la limite et crée un handoff vers la bonne personne.

## 5. Handoff organisationnel

Le handoff porte la demande originale, un contexte résumé, les événements sources, l'urgence, les
permissions, l'action attendue et son état. Le destinataire ne recommence jamais par « Comment puis-je vous
aider ? » : il reçoit le contexte et arrive avec une continuité humaine.

Cycle :

```text
pending → accepted → in_progress → completed
                  └──────────────→ failed
pending → declined | cancelled
```

La hiérarchie décrit la responsabilité, mais le moteur choisit le plus court chemin organisationnel valide.
Il n'imite pas les lenteurs bureaucratiques lorsque le destinataire est certain.

## 6. Canaux humains

Le contenu métier reste stable. Sa présentation varie :

- `direct` : bulle courte au-dessus du compagnon ;
- `messages` : échange naturel dans le téléphone ;
- `email` : salutation, formulation adaptée et signature du compagnon ;
- `push` : information essentielle bornée ;
- `voice` : texte prononçable sans syntaxe visuelle ;
- `system` : trace interne, non jouée comme un dialogue humain.

Chaque rendu est enregistré dans `hive_deliveries`, relié à son événement source. Une évolution ultérieure
pourra ajouter des renderers IA intégrant personnalité, émotion et relation, tout en gardant les faits
immuables.

## 7. État d'implémentation consolidé

- migration `0069_hive_universal_memory.sql` : journal, handoffs, livraisons, contrat de rôle, RLS et index ;
- `HiveContinuityService` : accès profil-scopé, validation de propriété, événements, transitions et rendu ;
- `hive-domain.ts` : fidélité de rôle, sélection d'un spécialiste et rendu de canal testés sans I/O ;
- routes `/companion/hive/events`, `/handoffs` et `/deliveries` ;
- chat compagnon publié automatiquement dans le journal universel ;
- orchestration générale : demande, réponse et passages de relais publiés avec provenance ;
- types client web pour événements et handoffs.
- contrats dérivés automatiquement du catalogue de rôles et générés par l'auto-builder ;
- fidélité de rôle exécutée avant le chat, avec routage et handoff automatiques hors périmètre ;
- projets/SOP, verdicts QA, pont IA et relais MCP publiés dans le journal universel ;
- page `/memoire` : timeline, handoffs, provenance, filtres, préférences et export ;
- livraison `messages` réellement projetée dans `companion_messages` pour le téléphone ;
- migration `0070_hive_memory_governance.sql` : mémoires consolidées, consentements et rétention ;
- consolidation manuelle et nocturne, export complet et oubli sélectif avec tombstones.
- migration `0071_hive_vault_approvals.sql` : coffre AES-256-GCM, demandes temporaires, décision humaine,
  jeton de réclamation hashé, consommation unique et révocation ; application `/autorisations` ;
- migration `0072_hive_memory_search.sql` : plein texte, trigrammes, pgvector/HNSW, recherche multi-filtres,
  enrichissement progressif et graphe récursif de provenance visible dans `/memoire` ;
- conversation vocale locale dans le téléphone via Web Speech quand le navigateur le permet, avec
  nettoyage prononçable et rythme/hauteur adaptés aux traits du compagnon ;
- migration `0073_hive_runtime_registry.sql` et page `/runtimes` : modèle, harness et adaptateur séparés,
  sélection par capacités/modalité/qualité/coût/latence/confidentialité/entitlement, exécution Copilote ou
  file MCP code, disponibilité réelle, activation et audit ; les moteurs image/audio/3D restent déclarés
  mais indisponibles tant qu'un fournisseur réel n'est pas choisi.
- migrations `0074` à `0077` : épisodes et relations de mandat, centre d'attention humain, relation durable
  humain-compagnon et inventaire visuel d'actifs lié au coffre ; pages `/attention` et `/infrastructure`.
- migration `0078` : graphe d'exécution persistant `run → tâches → handoffs`, transitions, profondeur,
  fan-out, nombre de tâches et durée bornés ; page `/operations` mise à jour en direct ;
- migration `0079` : registre normalisé des capacités et mémoire temporelle versionnée (faits contradictoires
  conservés avec `valid_from`, `valid_to` et `supersedes_id`) ;
- migration `0080` : énoncés structurés séparant intention, faits, émotion, prosodie et animation, y compris
  l'état `interrupted` ;
- migration `0081` : état opérationnel des compagnons distinct du visuel et registre de calcul sélectionné
  par modalité, mémoire, confidentialité, santé, charge et coût ;
- migration `0082` : packages d'espaces signés par checksum, versionnés, installables en mode créer/rejoindre,
  avec manifeste borné ; page `/espaces` ;
- migration `0083` : budget réel en crédits et échéance par run ; dépassement bloquant et visible dans le
  centre d'attention.
- délégation récursive réellement exécutable par une abeille via outil interne, loi économique
  `gain attendu > communication + calcul + coordination`, anti-cycle et traçabilité complète.
- chaque abeille dispose de `chercher_memoire_ruche` et le relais MCP de `dowze_search_context` : les anciennes
  décisions traversent les sessions, canaux et harness sans copier-coller.

## 8. Dépendances d'activation, sans duplication

1. Installer les adaptateurs spécialisés image, musique, chant et 3D après choix des moteurs et accès réels ;
   le registre les expose sans prétendre qu'ils sont disponibles.
2. Ajouter les transporteurs externes email/push lorsque les fournisseurs et consentements de notification
   seront choisis ; les rendus et leur file de livraison sont déjà prêts.
3. Ajouter une voix premium si souhaité : la boucle locale Web Speech fonctionne sans compte, mais un accent
   naturel stable, une identité vocale entraînée et le streaming temps réel dépendent d'un moteur STT/TTS.
4. Appliquer les migrations et déployer l'API/web en production après autorisation explicite ; fournir
   `HIVE_VAULT_SECRET_KEY` dans le gestionnaire de secrets de l'environnement.
5. Activer le relais MCP avec un jeton généré par l'utilisateur et son abonnement officiel Codex/Claude.

Ces étapes prolongent le système existant ; elles ne créent jamais une seconde Ruche ou une seconde mémoire.
