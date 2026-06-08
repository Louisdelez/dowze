# Architecture technique — vue d'ensemble

> *Note : ce document décrit une **architecture de référence**, pas une implémentation figée. Il montre la
> faisabilité et oriente les choix, en respectant les [12 principes](../00-FONDATIONS/03-principes-fondateurs.md).*

---

## Principes d'ingénierie

1. **Protocole ouvert d'abord.** Dowze est défini par des **spécifications ouvertes** (formats, API,
   schémas) avant d'être un logiciel. Plusieurs implémentations peuvent coexister et interopérer (comme
   pour le web). Cela rend la [capture impossible](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md).
2. **Fédéré, pas centralisé.** Les données et services peuvent être hébergés par région/institution
   (souveraineté, résilience, conformité locale). Un nœud qui tombe ne fait pas tomber le système.
3. **Offline-first.** Le terminal fonctionne sans connexion permanente ; la synchronisation est
   opportuniste. Voir [offline-first](05-offline-first.md).
4. **Données possédées par l'apprenant.** Le stockage de référence des preuves et du parcours est
   **portable** et contrôlé par la personne (principe 11).
5. **Léger par défaut.** Texte/voix avant vidéo ; basse consommation de données ; terminaux modestes.
6. **Sûreté et vie privée par conception.** Minimisation, chiffrement, journalisation des accès,
   human-in-the-loop sur les enjeux élevés.
7. **Auditable.** Code open source, modèles et décisions traçables (surtout pour l'IA, usage « haut
   risque » au sens de l'AI Act).

---

## Composants principaux

```
                         ┌───────────────────────────┐
                         │   TERMINAL (web / mobile / │
                         │   borne de Foyer) — PWA     │
                         │   + cache offline local     │
                         └───────────┬─────────────────┘
                                     │ (sync opportuniste)
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                             │
┌───────▼────────┐          ┌────────▼─────────┐          ┌────────▼─────────┐
│  SERVICE ATLAS │          │  SERVICE MENTOR  │          │ SERVICE PREUVE   │
│  graphe de     │          │  orchestration   │          │  émission &      │
│  compétences   │◄────────►│  pédagogique +   │◄────────►│  vérification    │
│  + ressources  │          │  LLM + RAG +     │          │  VC / Open Badge │
│  (versionné)   │          │  knowledge trace │          │                  │
└───────┬────────┘          └────────┬─────────┘          └────────┬─────────┘
        │                            │                             │
┌───────▼────────────────────────────▼─────────────────────────────▼─────────┐
│  SERVICE COMMUNAUTÉ (Cercles, Guildes, Foyers, mentorat, modération)        │
├─────────────────────────────────────────────────────────────────────────────┤
│  SOCLE : identité & wallet apprenant · gouvernance · journal d'audit ·       │
│          conformité (RGPD/COPPA/FERPA/AI Act) · télémétrie de bien-être      │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Service | Rôle | Standards/technos candidats |
|---------|------|------------------------------|
| **Atlas** | Graphe de compétences + ressources, versionné | Base graphe ; ESCO/O*NET en amorçage ; schéma ouvert |
| **Mentor** | Orchestration pédagogique, LLM encadré, RAG, knowledge tracing | LLM + RAG ; BKT interprétable ; règles pédagogiques |
| **Preuve** | Émission/vérification de credentials | **W3C VC 2.0**, **Open Badges 3.0** |
| **Communauté** | Cercles, Guildes, Foyers, modération | Services temps réel + asynchrone, modération |
| **Socle** | Identité, wallet, gouvernance, conformité, audit | Wallet apprenant ; journalisation ; chiffrement |

---

## Le terminal : une application web progressive (PWA)

- **PWA** (Progressive Web App) installable, fonctionnant sur smartphone bas de gamme, PC ancien, ou
  borne de Foyer — un seul socle, partout.
- **Cache local** : Mentor « allégé » et tranches d'Atlas téléchargées pour l'usage hors-ligne.
- **Mode dégradé** : texte/voix quand la bande passante manque ; vidéo seulement si possible.
- **Accessibilité** native : taille, contraste, voix, navigation simplifiée.

---

## Le rôle du LLM (et ses limites techniques)

- Le LLM **n'est pas** la source de vérité : il est **ancré** dans l'Atlas et des sources citées (RAG)
  pour limiter l'hallucination (~5-10 % d'énoncés faux pour un LLM brut).
- Il est **encadré par des règles pédagogiques** (scaffold-and-fade, mode socratique) — c'est ce qui fait
  la différence entre +1,3σ (Kestin) et −17 % (Bastani). Voir [conception du Mentor](03-conception-mentor-IA.md).
- Il est **journalisé et supervisable** ; pour les mineurs, garde-fous renforcés et modération.
- **On peut faire tourner des modèles plus légers** côté périphérie/offline pour les fonctions de base,
  et réserver les modèles lourds au cloud quand la connexion le permet.

---

## Ce que l'architecture garantit

| Principe | Garantie technique |
|----------|--------------------|
| Équité (3) | Offline-first, léger, PWA universelle, Foyers-relais |
| IA qui fait penser (5) | LLM encadré + RAG + validation sans IA |
| Vie privée (11) | Données possédées par l'apprenant, minimisation, chiffrement |
| Bien commun (12) | Protocole ouvert, fédération, open source |
| Sûreté (10) | Journalisation, modération, human-in-the-loop |

---

## Ce que ce document ne fait pas

Il ne fige **pas** un langage, un framework ou un fournisseur précis — ce sont des décisions
d'implémentation, à prendre en phase pilote, et susceptibles d'évoluer. L'important est le respect des
**principes** et des **standards ouverts**.

Détails par composant : [Atlas](02-modele-donnees-atlas.md) · [Mentor](03-conception-mentor-IA.md) ·
[Passeport](04-passeport-verifiable-specs.md) · [Offline](05-offline-first.md) ·
[Interopérabilité](06-interoperabilite-standards.md).
