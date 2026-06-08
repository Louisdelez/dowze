# Le pont `.json` entre l'intra et l'IA (sans API)

> *Le lien entre l'intra et l'IA n'est **pas** une connexion API. C'est un **échange de fichiers `.json`**,
> à la main : l'intra te donne un `.json` (le prompt « quoi faire » + le format exact « comment l'écrire »
> + un exemple), tu le donnes à ton IA, l'IA te rend un `.json` bien formaté, tu le réimportes dans l'intra
> qui le lit. **Zéro API, zéro clé, ça marche avec n'importe quel abonnement.***

---

## Pourquoi ce choix (et pas l'API)

| | Pont `.json` (choisi) | Connexion API (écartée) |
|---|------------------------|--------------------------|
| Coût IA pour l'intra | **0 €** | payant (ou clé à gérer) |
| Compatible abonnement grand public | ✅ Claude Pro, ChatGPT Plus… | ❌ l'abonnement web n'a pas d'API |
| Couplage | **nul** (les deux côtés indépendants) | fort |
| Vie privée | l'élève **voit et contrôle** le fichier | tout transite par un serveur |
| Hors-ligne | possible (préparer/lire sans réseau) | impossible |
| Clé / config | aucune | clé API requise |

> Le « fichier comme passage d'état » est un pattern d'intégration établi entre systèmes qui ne se parlent
> pas directement. Avantages : découplage, hors-ligne, vie privée. C'est exactement ce qu'on veut.

---

## Le flux complet (le va-et-vient)

```
┌────────────────────────────┐                      ┌──────────────────────────┐
│  INTRA                      │                      │  TON IA (Claude/ChatGPT)  │
│                             │                      │                          │
│ ① génère un .json ALLER :   │  ── tu le donnes ──► │ ② lit le .json, suit les │
│   • prompt (quoi faire)     │   (copier/coller     │   instructions, enseigne │
│   • response_schema         │    ou upload)        │   ...                    │
│     (comment écrire)        │                      │ ③ produit un .json RETOUR│
│   • exemple (gabarit)       │                      │   au format demandé      │
│   [Copier] [Télécharger]    │ ◄── tu le ramènes ── │   [bloc à copier]        │
│ ⑤ importe & VALIDE le       │   (coller ou upload) │                          │
│   .json retour → met à jour │                      │                          │
└────────────────────────────┘                      └──────────────────────────┘
```

1. **L'intra génère le `.json` ALLER** et te le donne (bouton **Copier** *et* **Télécharger .json**).
2. Tu le **donnes à ton IA** (tu colles le contenu, ou tu uploades le fichier dans le chat).
3. L'IA **enseigne** ; à la fin, elle **produit le `.json` RETOUR** au format exact demandé.
4. Tu **rapportes** ce `.json` (copier le bloc, ou télécharger le fichier si ton IA le permet).
5. L'intra **l'importe, le valide, et met à jour** ta progression / ton carnet de bord.

---

## Le `.json` ALLER (ce que l'intra te donne) — exactement ta demande

C'est un fichier **template + prompt + exemple** : il dit à l'IA **quoi faire** et **comment écrire** sa
réponse.

```json
{
  "schema_version": "1.0",
  "type": "noos.aller",
  "eleve_id": "e_123",
  "contexte": {
    "objectif": "Tronc commun — Expédition : « Peut-on faire confiance à ce qu'on lit ? »",
    "niveau_estime": "intermédiaire",
    "carnet_resume": "A compris la notion de source ; à travailler : recouper plusieurs sources."
  },
  "instructions": "Tu es mon professeur Dowze. Mène l'Expédition pas à pas (Étincelle → Question → Défi → Acte). Fais-moi PENSER, ne donne pas les réponses. À la FIN de la session, produis UNIQUEMENT un objet JSON conforme à response_schema ci-dessous, sans aucun texte autour, sans bloc Markdown. N'invente aucun champ. Recopie eleve_id à l'identique.",
  "response_schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["schema_version", "type", "eleve_id", "competences", "carnet"],
    "properties": {
      "schema_version": { "const": "1.0" },
      "type": { "const": "noos.retour" },
      "eleve_id": { "const": "e_123" },
      "competences": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["code", "auto_valide", "preuve"],
          "properties": {
            "code": { "type": "string" },
            "auto_valide": { "type": "boolean" },
            "preuve": { "type": "string" }
          }
        }
      },
      "carnet": { "type": "string" },
      "prochaine_etape": { "type": "string" }
    }
  },
  "exemple_de_reponse": {
    "schema_version": "1.0", "type": "noos.retour", "eleve_id": "e_123",
    "competences": [ { "code": "esprit-critique.sources", "auto_valide": true, "preuve": "a recoupé 3 sources sur un sujet et produit un mini-guide" } ],
    "carnet": "Sait recouper des sources ; à approfondir : biais de confirmation.",
    "prochaine_etape": "Expédition « Statistiques qui mentent »"
  }
}
```

Les **3 ingrédients** que tu demandais y sont :
- **le prompt** (`instructions` : *quoi faire*) ;
- **le format exact** (`response_schema` : *comment écrire*, un **JSON Schema** strict) ;
- **un exemple** (`exemple_de_reponse` : un gabarit concret à imiter).

> 💡 Si l'IA ne sait pas lire un fichier joint (selon le compte), tu peux simplement **coller le contenu**
> du `.json` dans le chat — ça marche pareil. On conçoit pour le **bloc copiable** (universel), l'upload de
> fichier étant un bonus.

---

## Le `.json` RETOUR (ce que l'IA te rend)

L'IA répond par un objet conforme au `response_schema`. Tu le rapportes à l'intra (coller le bloc, ou
uploader le fichier si ton IA en génère un).

**Honnêteté technique** : sans API, **aucune garantie** que l'IA produise un JSON parfait à 100 % (le
« JSON garanti » n'existe que via l'API). Les ratés typiques : texte autour, bloc Markdown ```` ```json ````,
virgule en trop, JSON tronqué. → C'est pourquoi **toute la fiabilité est côté intra** (ci-dessous).

---

## Comment l'intra lit le `.json` retour (robuste)

Pipeline d'import (ordre important) :

1. **Extraire** le JSON (retirer le texte autour et les ```` ```json ```` éventuels, isoler l'objet `{…}`).
2. **Parser** ; si échec → **réparer** automatiquement (lib `jsonrepair` : corrige virgules manquantes,
   guillemets, JSON tronqué, etc.).
3. **Valider** contre le `response_schema` avec **Ajv** (le validateur JSON Schema standard en JS), en mode
   **strict** : `additionalProperties: false` (⟵ rejette tout **champ inventé** par l'IA), types et bornes
   vérifiés, `eleve_id` qui doit correspondre.
4. **Vérifier la cohérence** (un niveau ne régresse pas sans raison, IDs connus, dates plausibles).
5. Si tout est bon → **mise à jour** de la progression + carnet. Sinon → **message clair** (« champ manquant :
   carnet ») + bouton **« redemander à l'IA »** (l'intra regénère un petit prompt de correction).

> Règle : **réparer ≠ valider**. On répare pour rendre lisible, mais on **valide toujours** le schéma —
> et on ne « corrige » jamais les valeurs en douce : en cas de doute, on fait resoumettre.

---

## UX du va-et-vient (le rendre indolore)

- Côté intra → sortie : bouton **« Copier »** *et* **« Télécharger .json »** (le copier est souvent le plus
  rapide).
- Côté intra → entrée : **plusieurs façons** d'importer — **glisser-déposer**, choisir un fichier, **ou
  coller le bloc** directement (avec détection automatique au collage + validation en direct).
- **Instructions pas-à-pas** à côté du bouton : *1. Copier → 2. Coller dans ton IA → 3. Copier sa réponse →
  4. Coller ici.*
- Toujours un **fallback clic** (le glisser-déposer n'est pas fiable partout, surtout mobile).

---

## Sécurité : et si quelqu'un trafique son `.json` pour tricher ?

Le `.json` retour est une **entrée contrôlée par l'utilisateur** : il pourrait l'éditer pour gonfler sa
progression. Principe directeur :

> **Le `.json` ne valide jamais une compétence à lui seul. Il transporte une *auto-validation* (palier 1),
> pas une preuve forte.** La vraie validation vient des **pairs** (voir [le système de validation](09-validation.md)).

Garde-fous :
- Le `.json` ne porte qu'une **auto-validation** (badge « confiance faible ») — ce qui débloque la suite,
  mais ne « certifie » rien. La montée en preuve (pair-validé, endossé) passe par la communauté, pas par le
  fichier.
- Les payloads **émis par l'intra** peuvent être **signés** (HMAC, secret côté serveur) et horodatés
  (anti-rejeu) — pour vérifier qu'on n'a pas trafiqué la consigne.
- **Validation stricte des types/bornes** à l'import (un `niveau` est un entier borné, jamais du texte
  libre) ; ne **jamais exécuter** le contenu.
- Cohérence vérifiée ; dédup par horodatage (réimporter deux fois le même fichier est sans effet).

> Conséquence : même si quelqu'un truque son `.json`, il ne se ment qu'à lui-même au palier 1 — il n'obtient
> **aucune preuve reconnue** sans passer la validation par les pairs.

---

## Stack technique (rappel)

`Ajv` (+ `ajv-formats`) pour la validation de schéma · `jsonrepair` pour la réparation · `crypto` natif
(HMAC, comparaison en temps constant) pour la signature · UX : copier/télécharger + glisser-déposer +
coller. Tout tient **côté intra** ; l'IA reste un simple correspondant qui lit et écrit du `.json`.

---

## Articulation

- C'est le mécanisme concret derrière les [prompts & la continuité](03-prompts-et-continuite.md) (le carnet
  de bord = ce que l'intra reconstitue à partir des `.json` retour).
- L'**auto-validation** transportée par le `.json` est le **palier 1** du [système de validation](09-validation.md).
- Vu côté élève : [le parcours élève](08-parcours-eleve.md).

**Sources** : Anthropic (structured outputs « API-only ») ; Ajv (validation JSON Schema) ; `jsonrepair` ;
HMAC-SHA256 ; bonnes pratiques prompt→JSON (few-shot, schéma, `additionalProperties:false`). Détail :
[bibliographie](../09-ANNEXES/01-bibliographie.md).
