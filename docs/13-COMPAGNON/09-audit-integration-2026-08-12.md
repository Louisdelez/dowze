# Contre-audit d’intégration Ruche — 12 août 2026

## Portée et règle de vérité

Ce contre-audit ne déduit pas qu’une fonction est utilisable parce qu’une table, une route ou une interface
existe. Une exigence est considérée intégrée uniquement si le chemin métier ordinaire l’emploie réellement.
La source reste l’export de 16 messages conservé dans `Master/05-journal`, soit 191 406 caractères rendus.
Ses huit marqueurs littéraux `Afficher plus` sont absents du DOM exporté et du JSON brut : aucune affirmation
de couverture ne peut inclure ces fragments inconnus.

L’architecture existante a été conservée : profils Supabase, API Nest, projections compagnon, Copilote,
événements Ruche et frontends Next. Aucune seconde mémoire, seconde orchestration ou seconde identité n’a été
créée.

## Chemin métier réellement audité

```text
demande humaine
  → profil et compagnon
  → contrôle du contrat de rôle
  → réponse directe ou handoff
  → run/tâches bornés si orchestration
  → modèle+harness puis ressource de calcul compatible
  → événement source
  → livraison + énoncé structuré
  → projection direct/messages/voix
  → consolidation et recherche sous politique de portée
```

## Écarts découverts et corrigés

### 1. Consentement mémoire appliqué trop tard

La politique `crossSpaceEnabled` existait, mais l’outil interne `chercher_memoire_ruche` recherchait dans tous
les événements du profil. Le cloisonnement RLS empêchait l’accès à un autre utilisateur, pas la fuite entre
deux sphères du même utilisateur. La recherche interne charge maintenant la politique : sans opt-in, elle
ne retourne que les événements globaux et ceux de l’espace du compagnon demandeur. Les agents de production,
les chats directs, la Reine et les runtimes fournissent explicitement leur portée.

### 2. Communication structurée contournée par le chemin principal

`hive_deliveries` et `hive_utterances` existaient, mais le chat direct ordinaire se limitait encore à
`companion_messages` et `hive_events`. Les réponses directes, les synthèses de la Reine, les replis et le relais
runtime créent maintenant une livraison liée à l’événement, puis un énoncé séparant faits, intention, émotion,
confiance, prosodie et animation. Direct, Messages, voix et système sont marqués livrés ; email et push restent
en file tant qu’aucun transport externe n’est configuré.

### 3. Relation persistée mais peu utilisée pendant la génération

L’affinité, la confiance et la familiarité étaient mises à jour et utilisées lors d’un rendu différé, mais pas
dans le prompt du chat direct. Elles sont désormais injectées comme consigne de formulation bornée : chaleur et
proximité peuvent évoluer, les faits ne peuvent jamais être altérés et le compagnon ne peut pas simuler une
intimité supérieure à l’état réel.

### 4. Scheduler visible mais non administrable et non consulté par le runtime

Une ressource créée avait l’état `unknown`, sans route ni contrôle d’interface permettant de la déclarer saine.
Le runtime sélectionnait seulement le couple modèle+harness. Une route de mise à jour profil-scopée, ses deux
clients et les contrôles d’interface permettent maintenant de changer santé et activation. Avant l’exécution,
le runtime choisit un nœud sain selon modalité, confidentialité, charge, coût et mémoire, bloque si des nœuds
sains existent mais qu’aucun n’est compatible, et journalise la ressource retenue.

Cette intégration ne prétend pas réserver physiquement un GPU propriétaire : le dispatch matériel exige un
adaptateur de calcul réel. Le statut reste donc `PARTIEL`, avec une frontière exacte.

## Couverture confirmée

- Reine, abeilles, contrats de rôle, routage social et handoffs : utilisés dans le chat/orchestrateur réel ;
- runs, tâches, récursion, anti-cycle, fan-out, échéance et crédits : persistés dans la branche orchestrée ;
- mémoire universelle, provenance, temporel, consolidation, export et oubli : services et routes actifs ;
- Maison, organisations, services rejoints/créés et packages : même identité/profil et mêmes espaces ;
- direct, Messages et voix locale : interfaces présentes ; email/push ont seulement le rendu et la file ;
- coffre : chiffrement, approbation, durée, révocation et consommation unique présents ;
- modèles et harness : registre séparé, disponibilité vérifiée et adaptateurs Copilote/MCP exécutables ;
- état compagnon : persistant et séparé de l’animation isométrique.

## Dettes honnêtes restantes

1. Les moteurs image, musique, chant, 3D, la voix premium, les transports email/push et le dispatch GPU réel
   nécessitent encore un fournisseur, des accès ou du matériel. Un adaptateur déclaré n’est pas déclaré actif.
2. Le coffre fournit une primitive sûre, mais tous les outils futurs susceptibles d’utiliser un secret devront
   obligatoirement passer par la demande puis la consommation ; il n’existe pas encore d’action de déploiement
   autonome utilisant un secret réel.
3. `companion.service.ts`, `hive-continuity.service.ts`, `companion.controller.ts`, l’API web et la grande scène
   compagnon dépassent largement la limite de taille du lint. La séparation conceptuelle existe dans les données,
   mais le découpage physique du code doit être poursuivi pour tenir la promesse non monolithique.
4. La réservation matérielle possède son schéma mais n’est pas encore reliée à un exécuteur de nœud ; le choix
   de ressource est réel, l’allocation physique reste une frontière d’adaptateur.
5. Les huit fragments `Afficher plus` ne peuvent être ni analysés ni implémentés sans une source qui les contient.

## Validation du 12 août

- `npm test` : 180 tests réussis ;
- `npm run typecheck` : 14 paquets réussis ;
- `npm run lint` : zéro erreur, avertissements historiques de taille/variables consignés ;
- `npm run build` : 10 tâches réussies, incluant les 43 routes web et les paquets natifs Tauri
  `.deb`, `.rpm` et `.AppImage` ;
- audit npm de production : 0 critique, 0 haute, 2 modérées et 9 faibles ; la correction automatique impose
  toujours une migration majeure vers AI SDK 7 et n’a pas été forcée dans ce chantier d’intégration ;
- test Chrome local de `/infrastructure` : rendu 200, aucune erreur console ni requête en échec après ajout
  de l’icône applicative manquante ;
- production publique : accueil, infrastructure, fitness, sports, alimentation et santé API disponibles ;
- inspection interne des conteneurs non répétable lors de ce contre-audit, car le compte SSH ne dispose plus de
  `sudo` non interactif. Cela n’autorise pas à affirmer que les changements de ce contre-audit sont déployés.

Le verdict est donc : la vision disponible est consolidée dans une architecture unique et les quatre écarts
d’intégration identifiés ont été corrigés localement. La complétude absolue reste impossible à affirmer pour les
fragments source absents et les fournisseurs non raccordés.
