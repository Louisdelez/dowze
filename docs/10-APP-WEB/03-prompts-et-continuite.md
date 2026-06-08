# Bibliothèque de prompts & continuité

> *L'app ne « parle » pas à l'élève : elle **génère le bon prompt au bon moment**, contextualisé avec son
> niveau et sa progression, que l'élève donne à son IA. Et comme un LLM oublie d'une session à l'autre, le
> **carnet de bord** de l'app est la vraie mémoire.*
>
> ⚙️ **Forme concrète** : ces prompts ne sont pas du texte nu mais des **fichiers `.json`** (prompt + format
> attendu + exemple), et l'état revient en `.json` que l'app valide. Tout le mécanisme du va-et-vient est
> décrit dans [**le pont `.json`**](10-pont-json.md) — ce document-ci se concentre sur le *contenu*
> pédagogique des prompts et du carnet.

---

## La bibliothèque de prompts (6 prompts de base)

Chaque situation pédagogique = un **prompt-modèle** versionné, avec des emplacements remplis au runtime.

| Prompt | Quand | Ce qu'il fait |
|--------|-------|---------------|
| **Diagnostic** | À l'inscription / nouveau domaine | Situe le niveau (relié au placement, [02 §7](02-cerveau-pedagogique.md#7-le-diagnostic-initial-placement)) |
| **Cours** | Apprendre une compétence | Explication courte adaptée + mode socratique (scaffold-and-fade) |
| **Quiz** | Vérifier | Questions de récupération (alimentent le BKT côté app) |
| **Quête** | Appliquer | Un vrai mini-projet pour prouver par l'acte |
| **Révision** | Début de session | Rappel espacé des compétences dues |
| **Bilan / carnet** | Fin de session | Produit le « rapport de session » structuré à recoller |

**Stockage** : un fichier par modèle, **versionné en Git**, avec des métadonnées (`id`, `version`,
`objectif`, `variables`, `format_sortie`). Pas besoin d'un CMS de prompts au MVP (sur-ingénierie) ; un outil
comme **Langfuse** ne devient utile que pour itérer/évaluer à grande échelle.

---

## La contextualisation (prompt templating)

Un prompt-modèle contient des variables injectées par l'app à l'exécution :

```
Tu es mon professeur Dowze. Voici mon état (NE le révèle pas brut, sers-t'en pour adapter) :
- Objectif : {{objectif}}
- Niveau estimé : {{niveau}}
- Compétence du jour : {{competence.nom}} ({{competence.id}})
- Ce que je maîtrise déjà : {{competences_maitrisees}}
- Mon dernier point : {{carnet_resume}}

Donne-moi un cours court et adapté sur {{competence.nom}}, puis passe en mode socratique
(ne donne pas les réponses que je dois trouver). Termine par le bloc [RAPPORT DE SESSION].
```

Bonnes pratiques (prompt engineering) :
- **Sortie structurée imposée** : exiger un bloc final JSON/balisé (le « rapport de session ») → l'élève
  recolle un état propre (mode A), ou l'app le parse (mode B).
- **Few-shot** si besoin (un exemple de bon comportement).
- **Rôle + format + contraintes** explicites.
- ⚠️ **Non-déterminisme** : même prompt, réponses variables (et plus encore entre Claude/ChatGPT/Gemini).
  Tester chaque modèle sur plusieurs IA ; viser la robustesse, pas la reproductibilité parfaite.
- ⚠️ **Injection de prompt** : ne jamais réinjecter du contenu élève non filtré dans le template.

---

## La continuité : l'app est la mémoire

Les LLM sont **sans état** : ce qui ressemble à de la « mémoire » dans ChatGPT, c'est l'app qui **réinjecte
l'historique** à chaque requête. Donc :

> **La base de données de Dowze EST la mémoire. L'IA est un exécuteur jetable.**

Pattern retenu : **fenêtre courte + résumé canonique (le carnet de bord)**. L'app maintient un résumé
compact de la progression et l'injecte dans chaque prompt. Le carnet contient : objectif, compétences
(maîtrisées / en cours / à venir), quête actuelle, dernier point atteint, prochaine étape.

### La boucle fermée (rappel)
Chaque session se **termine par un « rapport de session »** structuré que l'élève recolle → l'app met à jour
l'état et regénère le carnet. C'est ce qui empêche l'app et la réalité de diverger en mode copier-coller.

```
App → génère prompt (avec carnet injecté) → élève le colle dans son IA
                                                   ↓
IA → enseigne, puis produit [RAPPORT DE SESSION]  ↓
                                                   ↓
élève → recolle le rapport dans l'app → l'app met à jour l'état + le carnet → (boucle)
```

### Conteneur de persona (optionnel)
On peut héberger les instructions du tuteur dans un **Claude Project** ou un **Custom GPT** (persona stable).
Mais **l'état canonique reste dans l'app** : la mémoire des « Projects » est opaque, non portable et non
garantie. Ne jamais déléguer l'état pédagogique au fournisseur — sinon on perd la portabilité multi-IA et
l'auditabilité.

---

## Le carnet de bord, objet central

C'est à la fois :
- la **mémoire** technique (injectée dans les prompts) ;
- l'**objet d'UX** que l'élève consulte pour savoir où il en est et reprendre (voir
  [produit/UX](04-produit-ux.md)) ;
- la **trace** qui, plus tard, alimentera le [Passeport](../03-ARCHITECTURE/05-preuve-passeport.md).

Règle de conception : le carnet doit offrir une **synthèse actionnable** (« ton prochain pas est X »), pas
une accumulation de données brutes.

**Suite** : [produit & UX](04-produit-ux.md).
