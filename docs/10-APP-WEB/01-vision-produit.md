# Vision produit : deux IA, un moteur interne indispensable

> ⭐ **RÉVISION 2026.** Le modèle initial « BYO-AI pur » (l'app ne fait tourner aucun LLM ; tout passe par un
> fichier `.json` que l'élève fait voyager) a **évolué**. Dowze fonctionne désormais avec **deux IA** : l'**IA
> de tutorat** (externe, l'abonnement de l'élève — elle *parle*) et **l'IA de Dowze, le « Copilote »**
> (interne, **indispensable** — elle *fait tourner l'école*). Le récit complet : **[L'IA de Dowze, le
> moteur](23-ia-de-dowze-le-moteur.md)**.

---

## Ce que l'élève voit dans le portail

| Écran | Contenu |
|-------|---------|
| **Compte / profil** | Identité, date de naissance, photo, code de suivi ([profil](19-onboarding-profil-placement.md)) |
| **Présentation → dossier** | L'IA de Dowze bâtit un **dossier élève** depuis sa présentation |
| **Placement** | Le **test d'entrée adaptatif** (situe le niveau) |
| **Tableau de bord** | Niveau, progression, **le prochain pas** (un seul mis en avant) |
| **Ma séance** | Le **prompt lisible** à copier dans son IA + le **minuteur 45 min** |
| **Mes résultats** | La **maîtrise** par palier + les tests d'entraînement (sans note ni classement) |
| **Expéditions / Tests / Planning / Carnet / Validation** | Le reste de la boucle |

---

## Les deux IA (le cœur de la vision)

1. **L'IA de tutorat — externe, « BYO-AI »** : l'élève apporte **son** abonnement (Claude/ChatGPT). Elle
   tient la **conversation** d'enseignement. L'élève y **colle un prompt lisible** (plus jamais de `.json`).
   Interchangeable, « jetable », **sans mémoire fiable**. Le BYO-AI reste vrai — **uniquement pour cette
   conversation**.
2. **L'IA de Dowze — interne, le Copilote** : une IA **multi-fournisseurs** (par API) qui **compose** les
   prompts, **transforme le bilan de séance (texte) en état**, et **sous-tend toutes les features**
   (dossier, placement, exercices, tests, expéditions, mémoire des erreurs). Elle a un **coût réel**,
   monétisé en **crédits** ou **gratuit en BYOK**. Détail : [le Copilote](15-copilote-orchestrateur.md).

> Donc **oui, l'app fait tourner un LLM** désormais (en interne), contrairement au modèle initial. Ce qui
> reste vrai : **la mémoire et la vérité vivent dans Dowze**, jamais dans l'IA.

---

## La boucle d'état (le mécanisme central, révisé)

L'intra reste synchronisée avec ce que fait l'IA **sans `.json` côté élève** :

1. Le Copilote **compose** un prompt lisible (contextualisé par la mémoire de l'élève). L'élève le **colle**
   dans son IA et apprend.
2. À la fin, l'élève demande un **bilan en texte libre** à son IA et le **recolle** dans Dowze.
3. Le Copilote **ingère** ce texte → **état structuré** (schéma Zod strict, filet `jsonrepair`) → l'app
   **recalcule** la maîtrise (BKT), écrit le **carnet**, planifie la **révision** (FSRS), met à jour la
   **mémoire des erreurs**.

**L'app est la mémoire ; l'IA de tutorat est un correspondant sans état.** Ce qui a changé : le transport
n'est plus un `.json` bricolé par l'élève, mais du **texte clair structuré par le Copilote** (le va-et-vient
`.json` côté élève a échoué au test réel — une vraie IA rend du contenu, pas l'enveloppe).

---

## Le pont `.json` n'a pas disparu — il a changé de rôle

Le `.json` n'est **plus le mécanisme de l'élève**. Il reste un **outil d'auteur** (École générative :
générer cours, grilles, ossature d'expéditions → **persister au graphe**, avec validation par la loi de
clôture) et un **repli hors-ligne**. Détail : [le pont `.json`](10-pont-json.md).

---

## Validation par les pairs (inchangé)

Dowze ne **certifie pas** par un score : la validation d'une **compétence** se fait **par les pairs**
(modèle École 42), pas par un QCM. On ne crée **aucune banque de QCM-couperet** ; le seul artefact de
validation par compétence est une **grille**. Les QCM/tests existants sont **formatifs** (s'entraîner), pas
certifiants — voir [validation](09-validation.md) et [tests & examens](18-tests-et-examens.md).

---

## Le « moat » : la donnée, pas le prompt (inchangé)

- **Échec type — Jasper** : valorisé 1,5 Md$, revenu effondré quand ChatGPT s'est amélioré (la valeur
  n'était que des prompts).
- **Le moat de Dowze** = l'**état pédagogique accumulé** par élève (graphe de compétences, maîtrise BKT,
  mémoire des erreurs, carnet, FSRS) + l'orchestration + (plus tard) la communauté. Un simple wrapper de LLM
  se fait absorber ; **un ITS avec modèle d'élève, non.**
- **Portabilité multi-IA** : le Copilote peut basculer entre fournisseurs ; l'élève garde son IA de tutorat.
  Ne jamais dépendre d'un seul fournisseur — mais **attention** : cette portabilité doit être **encapsulée**
  (repli automatique, résidence UE des données de mineurs) — voir [le moteur §6](23-ia-de-dowze-le-moteur.md).

---

## Ce que la vision produit n'est PAS

- ❌ Un chatbot de plus (l'IA **de tutorat** est externe ; l'IA **de Dowze** est un ITS, pas un chatbot).
- ❌ Un wrapper « prompt joli » (la valeur est l'état structuré + le modèle d'élève).
- ❌ Un outil de certification par un score (la preuve forte vient des [pairs](09-validation.md)).
- ❌ Un système à QCM-couperet (les tests sont formatifs ; validation par les pairs).
- ⚠️ ~~« Une plateforme sans coût d'inférence / sans API »~~ — **plus vrai** : le Copilote a un coût réel
  (crédits/BYOK). Le **cœur** reste gratuit ; le Copilote est un **confort payant ou gratuit en BYOK**.

**Suite** : **[L'IA de Dowze, le moteur](23-ia-de-dowze-le-moteur.md)** · le [cerveau pédagogique](02-cerveau-pedagogique.md).
