# Le noyau de règles strictes — zéro trou par construction

> *Le cœur de l'école générative, livré. L'intra est un **CORE** : il tient un **petit ensemble de règles
> strictes, fixées dès le départ et immuables**. Tout le reste — branches, matières, compétences, cours —
> est **généré par l'IA** (prompt + `.json` fournis par l'intra). Et grâce à la **loi de clôture**, il est
> **mathématiquement impossible** qu'il y ait un trou dans la chaîne d'apprentissage.*

---

## L'idée en une loi

> **LOI DE CLÔTURE — On ne génère jamais une compétence seule.** Générer une compétence, c'est générer la
> compétence **ET toute la chaîne de ses prérequis**, en cascade, jusqu'à toucher les **compétences-racines**
> du socle. Une compétence n'existe pour l'élève **que si tout ce dont elle dépend existe déjà**.

Conséquence directe et prouvée : **il ne peut jamais y avoir de trou.** Un trou = un prérequis manquant.
Or, par la loi de clôture, un prérequis manquant déclenche immédiatement sa propre génération. Une
compétence dont la chaîne n'est pas complète **n'est tout simplement pas publiée**. Le trou est impossible
*par construction*, pas « rare ».

C'est exactement le mécanisme des gestionnaires de paquets (npm, apt) et des systèmes de build (Bazel) :
on n'installe jamais un paquet sans **toutes** ses dépendances — sinon l'opération échoue, elle ne laisse
jamais un état à moitié fait.

---

## Ce que l'intra tient (le CORE, fixé dès le départ, immuable)

Quatre choses seulement, toutes petites et intemporelles. **Aucun cours, aucune compétence détaillée.**

| Le CORE contient | Quoi | Taille |
|------------------|------|--------|
| **① Le socle de racines** | la liste finie des compétences fondamentales (lire, compter, raisonner…), seules autorisées à n'avoir aucun prérequis | quelques dizaines |
| **② Les règles génératives** | la « grammaire » qui dit à l'IA comment générer n'importe quelle compétence/cours/grille | ~10-20 règles |
| **③ Les schémas + contraintes** | le format valide d'une sortie + les lois de complétude vérifiables | un fichier |
| **④ Les principes** | qualité, éthique, sûreté, véracité (la [constitution](../00-FONDATIONS/03-principes-fondateurs.md)) | un fichier |

Tout le reste est **généré, validé, mis en cache, réutilisé** — et personne ne l'écrit à la main.

---

## Les 8 règles strictes (le noyau)

Ce sont les règles que l'intra applique à **chaque** génération. Ensemble, elles garantissent le « zéro
trou ». (Fondées sur : clôture transitive, intégrité référentielle, fonctions totales, programmation par
contraintes/ASP, récursion bien fondée, build hermétique — voir [bibliographie](../09-ANNEXES/01-bibliographie.md).)

| # | Règle | Ce qu'elle garantit |
|---|-------|---------------------|
| **R1 — Clôture** | Générer une compétence = générer **toute sa chaîne de prérequis** jusqu'aux racines. | Aucun prérequis transitif ne manque |
| **R2 — Tout ou rien** | Une génération est **atomique** : soit la chaîne est complète, soit on annule tout (jamais d'état à moitié publié). | Pas d'état incomplet |
| **R3 — Aucune référence dans le vide** | Tout prérequis cité **doit pointer vers une compétence qui existe** ; sinon l'IA la génère sur-le-champ. | Aucune compétence « orpheline » référencée |
| **R4 — Le générateur répond toujours** | Pour toute demande valide, l'IA **doit** produire une compétence bien formée (conforme au schéma), **jamais « rien »**. | Aucun cas non traité |
| **R5 — Les deux lois de complétude** | Avant publication, on vérifie : (a) **aucune arête ne pointe vers le vide**, (b) **toute compétence non-racine a ≥ 1 prérequis**. | Les 2 formes de trou interdites |
| **R6 — Socle fini + niveaux décroissants** | La cascade s'arrête **toujours** sur une racine ; chaque prérequis est d'un **niveau strictement inférieur**. | Terminaison + pas de cycle |
| **R7 — Contrôle + réparation en boucle** | Un **validateur** scanne le graphe ; à chaque trou détecté, il **régénère juste le fragment manquant** et re-vérifie, jusqu'à **zéro violation**. | Convergence vers zéro trou |
| **R8 — Échec visible, jamais trou silencieux** | Si quelque chose ne peut être complété, le système **échoue bruyamment en désignant le manque** — il ne publie jamais un parcours troué. | Aucun trou ne passe |

> **Le théorème (ce que ces 8 règles te donnent) :** si le socle de racines est fini (R6), si toute
> génération calcule la clôture (R1), si toute arête pendante et tout orphelin sont interdits (R3+R5), si le
> système échoue plutôt que de publier un état partiel (R2+R8), et si la boucle de réparation converge
> (R7) — **alors tout parcours publié est complet, sans aucun prérequis manquant. Zéro trou. CQFD, par
> construction.**

---

## Le `.json` de génération (ce que l'intra envoie à l'IA)

Quand un élève a besoin d'une compétence, l'intra compose ce `.json` et le lui fait donner à l'IA. Il
**impose** les règles ci-dessus dans la consigne et dans le schéma de sortie.

```json
{
  "schema_version": "1.0",
  "type": "noos.generation.competence",
  "cible": "analyser un jeu de données réel",
  "socle_racines": ["lire", "compter", "raisonnement-logique", "..."],
  "regles": {
    "cloture": "Génère la compétence cible ET, récursivement, TOUS ses prérequis, jusqu'à n'aboutir qu'à des compétences du socle_racines. N'arrête JAMAIS une chaîne sur un prérequis qui n'existe pas.",
    "aucune_reference_vide": "Toute compétence citée comme prérequis DOIT figurer dans ta sortie OU dans le socle_racines. Si elle manque, génère-la aussi.",
    "non_orphelin": "Toute compétence qui n'est pas dans socle_racines DOIT avoir au moins un prérequis.",
    "acyclique": "Le graphe doit être un DAG : un prérequis a toujours un 'level' strictement inférieur.",
    "format": "Réponds UNIQUEMENT par un JSON conforme à response_schema. N'invente aucun champ."
  },
  "response_schema": {
    "type": "object", "additionalProperties": false,
    "required": ["competences"],
    "properties": {
      "competences": {
        "type": "array",
        "items": {
          "type": "object", "additionalProperties": false,
          "required": ["id", "nom", "level", "is_root", "prerequis"],
          "properties": {
            "id": { "type": "string" },
            "nom": { "type": "string" },
            "level": { "type": "integer", "minimum": 0 },
            "is_root": { "type": "boolean" },
            "prerequis": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    }
  }
}
```

L'IA renvoie un `.json` : la cible **+ toute sa chaîne de prérequis**. L'intra le **valide** (les 8 règles).
Si un trou est détecté (R5), l'intra renvoie un mini-`.json` de réparation ciblée (R7) jusqu'à ce que le
graphe soit clos. Une fois validé, il est **mis en cache** et réutilisé (déterminisme entre élèves).

---

## Le flux complet (zéro trou, de bout en bout)

```
1. L'élève a besoin de la compétence X
2. L'intra → .json de génération (loi de clôture + socle + schéma)  ──►  IA
3. L'IA génère X + TOUTE sa chaîne de prérequis jusqu'aux racines    ◄──  .json
4. L'intra VALIDE (R5) :
      • aucune arête vers le vide ?         ✅
      • aucune compétence non-racine sans prérequis ?  ✅
      • DAG, niveaux décroissants ?         ✅
   ├─ trou détecté → réparation ciblée (R7) → revalide (boucle)
   └─ tout est clos → CACHE → servi à l'élève
5. Garantie : le parcours de X jusqu'aux racines est COMPLET. Zéro trou.
```

L'intra ne stocke aucun contenu à maintenir : elle tient les **règles** et orchestre la **génération +
validation**. Le contenu est toujours frais, toujours à jour, **toujours complet**.

---

## Pourquoi c'est le système parfait recherché

- ✅ **Zéro création manuelle** : branches, matières, compétences, cours, grilles, ossature — **tout est
  généré** par l'IA depuis les règles. L'humain n'écrit que les ~10-20 règles du CORE, une fois.
- ✅ **Zéro trou** : garanti *par construction* via la loi de clôture (R1) + les lois de complétude (R5) +
  l'échec-visible (R8). Pas « peu de trous » : **aucun**.
- ✅ **Jamais obsolète** : le contenu est régénéré à la demande ; on améliore **les règles**, pas des
  milliers de cours ([école générative](09-ecole-generative.md)).
- ✅ **Cohérent et déterministe** : DAG sans cycle (R6), validation stricte, cache des résultats validés.
- ✅ **Le rôle de core de l'intra** : exactement ce que tu décris — l'intra donne le prompt + `.json`,
  l'IA fait le reste, l'intra valide et garde la trace.

---

## Articulation

- Met en œuvre le principe de l'[école générative](09-ecole-generative.md) (règles, pas contenu).
- S'appuie sur le [pont `.json`](../10-APP-WEB/10-pont-json.md) (le canal intra ↔ IA).
- L'ossature ([Atlas](01-atlas.md)) est le **résultat** de ces règles, jamais une donnée écrite à la main.
- La validation des compétences acquises (auto-validation → pairs) est un autre système :
  [validation par paliers](../10-APP-WEB/09-validation.md).

**Sources** : clôture transitive (arXiv 1902.02013) ; intégrité référentielle (Wikipedia) ; résolution de
dépendances (npm/apt, Bazel — A ⊆ D) ; fonctions totales ; contraintes d'intégrité ASP (Gebser/Schaub,
Potsdam) ; récursion bien fondée (Leroy/INRIA) ; gate validation + réparation ciblée (Moghaddam 2026).
Détail : [bibliographie](../09-ANNEXES/01-bibliographie.md).
