# Vision produit : le modèle « BYO-AI »

> *L'app NE fait PAS tourner de LLM. Elle tient le structuré (compte, niveau, carte, progression, planning,
> autoévaluation) et **génère les bons prompts** que l'élève donne à **son** IA. L'IA enseigne ; l'app se
> souvient et orchestre.*

---

## Ce que l'élève voit dans le portail

| Écran | Contenu |
|-------|---------|
| **Compte / profil** | Identité, objectif, préférences, IA choisie |
| **Tableau de bord** | Niveau, progression, **le prochain pas** (un seul mis en avant) |
| **La carte** | Les compétences du domaine, leur état de maîtrise (à venir / en cours / maîtrisé) |
| **Le cours du jour** | Le **prompt contextualisé** à copier dans son IA + la ressource éventuelle |
| **Le planning** | Le rythme proposé de la semaine |
| **L'autoévaluation / les quêtes** | Valider une compétence en démontrant (QCM, projet) |
| **Le carnet de bord** | La mémoire de continuité entre les sessions IA |

---

## Le modèle « BYO-AI » (Bring Your Own AI) — le pont est un fichier `.json`, pas une API

L'élève apporte **son** accès IA. Le lien entre l'intra et l'IA n'est **pas** une connexion API : c'est un
**échange de fichiers `.json` à la main** (détail : [le pont `.json`](10-pont-json.md)).

- L'intra **génère un `.json` ALLER** : le prompt (*quoi faire*) + le format exact attendu (*comment
  l'écrire*, un JSON Schema) + un exemple. Bouton **Copier** / **Télécharger**.
- L'élève le **donne à son IA** (colle le contenu ou uploade le fichier).
- L'IA **rend un `.json` RETOUR** au format demandé.
- L'élève le **réimporte dans l'intra**, qui le **lit, le valide et met à jour** sa progression.

| Critère | Pont `.json` (choisi) | API (écartée) |
|---------|------------------------|----------------|
| Coût IA pour l'intra | **0 €** | payant / clé à gérer |
| Compatible abonnement grand public | ✅ Claude Pro, ChatGPT Plus… | ❌ l'abonnement web n'a pas d'API |
| Vie privée | l'élève **voit et contrôle** le fichier | tout transite par un serveur |
| Couplage / config | **nul**, aucune clé | fort, clé requise |

> **C'est *exactement* « il suffit d'un abonnement IA ».** Pas d'API, pas de clé, pas de coût d'inférence.
> La friction du va-et-vient `.json` est le compromis assumé — on la réduit par l'UX (boutons copier/
> télécharger, glisser-déposer, validation au collage), pas par une API.

---

## La boucle d'état (le mécanisme central)

Pour que l'intra reste synchronisée avec ce que fait l'IA, le `.json` ALLER **impose à l'IA de terminer par
un `.json` RETOUR au format exact** (champ `response_schema`). L'élève le **réimporte** → l'intra parse,
**valide le schéma** (Ajv, strict, `additionalProperties:false` pour rejeter tout champ inventé),
**répare** si besoin (`jsonrepair`), puis met à jour la progression et le **carnet de bord**.

C'est ce qui empêche l'intra et la réalité de diverger. **L'intra est la mémoire ; l'IA est un
correspondant sans état qui lit et écrit du `.json`.** Détail complet : [le pont `.json`](10-pont-json.md).

---

## Positionnement : outil d'apprentissage, et validation par les pairs (pas par le `.json`)

L'intra **ne voit pas** la conversation avec l'IA, et le `.json` retour est **contrôlé par l'élève** (il
pourrait le trafiquer). Donc le `.json` ne transporte qu'une **auto-validation** (palier 1, confiance
faible) qui **débloque la suite** — il ne **certifie** rien.

**La vraie validation se fait par les pairs**, pas par un QCM ni par le `.json` (modèle École 42) — voir
[le système de validation](09-validation.md). On ne crée donc **aucune banque de QCM** : le seul artefact
par compétence est une **grille (checklist)**. La preuve forte (pair-validé, endossé) alimente le
[Passeport](../03-ARCHITECTURE/05-preuve-passeport.md). Voir
[évaluation](02-cerveau-pedagogique.md#5-évaluation).

---

## Le « moat » : la donnée, pas le prompt

La leçon des wrappers d'IA est claire :

- **Échec type — Jasper** : valorisé 1,5 Md$, revenu effondré quand ChatGPT s'est amélioré, car la valeur
  n'était que des prompts/templates (« les gens obtenaient 80 % du résultat directement dans ChatGPT »).
- **Réussite type — Cursor** : défendable grâce à l'intégration profonde et aux workflows, pas au prompt.

→ **Le moat de Dowze** = l'**état pédagogique accumulé** par élève (carte de compétences, historique de
maîtrise, progression, carnet de bord) + l'orchestration (séquencement, planning) + (plus tard) la
communauté. L'IA est une **commodité interchangeable** ; la valeur est le système autour.

**Protection supplémentaire** : rester **portable multi-IA**. L'élève garde *son* IA ; si un fournisseur
change ses conditions ou ses prix, l'app continue. Ne jamais dépendre d'un seul fournisseur.

---

## Ce que la vision produit n'est pas

- ❌ Un chatbot de plus (l'IA est externe et interchangeable).
- ❌ Un wrapper « prompt joli » (la valeur est l'état structuré).
- ❌ Un outil de certification par le `.json` (la preuve forte vient des [pairs](09-validation.md)).
- ❌ Une plateforme qui paie l'inférence LLM ou qui se connecte en API (l'élève apporte son IA ; le pont
  est un [fichier `.json`](10-pont-json.md)).
- ❌ Un système à QCM (le seul artefact par compétence est une grille ; validation par les pairs).

**Suite** : le [cerveau pédagogique](02-cerveau-pedagogique.md) — comment l'app tient le structuré.
