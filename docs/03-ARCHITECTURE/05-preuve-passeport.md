# Couche 5 — LA PREUVE · le Passeport de compétences

> *Le problème résolu : la confiance sans diplôme (le [paradoxe 85 % / 1-sur-700](../01-DIAGNOSTIC/04-crise-du-diplome.md)).
> Le Passeport est la « couche d'infrastructure de confiance » qui manque aujourd'hui.*

---

## L'idée

Le Passeport remplace le diplôme. Ce n'est pas un parchemin de fin d'études : c'est un **registre vivant,
portable et vérifiable** de ce qu'une personne a réellement démontré savoir faire.

| Le diplôme | Le Passeport |
|------------|--------------|
| Atteste un temps passé | Atteste une compétence démontrée |
| Bloc unique, daté | Granulaire, cumulable à vie |
| Détenu par l'institution | **Possédé par la personne** |
| Vérification lente, parcellaire | Vérifiable en secondes, cryptographiquement |
| Proxy social | Preuve directe + multi-source |

---

## Comment il fonctionne

### Granulaire et cumulable
Une preuve **par compétence** (et non un diplôme-bloc). On en accumule toute sa vie, dans tous les domaines
(professionnels *et* civiques, artistiques, etc. — l'Atlas est large).

### Fondé sur la preuve, pas le temps
Derrière chaque compétence validée, il y a des **traces réelles** : le projet rendu (Quête), l'évaluation,
la performance observée. (Voir comment [les Quêtes produisent les preuves](03-quetes.md).)

### Des niveaux de preuve qui montent (le système de validation par paliers)
Chaque compétence porte un **niveau de preuve croissant**, qui coexiste sur le même acquis (détail :
[système de validation](../10-APP-WEB/09-validation.md)) :

1. 🟡 **Auto-validé** — l'apprenant coche une checklist factuelle (palier 1, **débloque la suite**). Preuve
   *faible mais honnête*. **Ne certifie rien à lui seul.**
2. 🟢 **Pair-validé** — ≥2 membres de la communauté valident le travail avec une **grille** (modèle École
   42 ; corrélation pairs/expert r≈0,69). Preuve *moyenne-forte*. Arrive **en file**, sans bloquer.
3. 🔵 **Endossé** — attestation d'un **maître de Guilde/expert**, **performance réelle** (le travail a
   servi), ou **épreuve observée + identité** pour les enjeux élevés (santé, sécurité, droit). Preuve
   *forte*.

> **Pas de QCM** : on ne valide pas une compétence en surveillant un questionnaire, mais en vérifiant un
> **travail réel** par plusieurs regards humains. Le seul artefact à créer par compétence est une **grille**
> (réutilisée à l'infini), pas une banque de questions. Un employeur sérieux regarde les niveaux
> « pair-validé » et « endossé ».

### Infalsifiable et auto-détenu
- **Signé cryptographiquement** (standard **W3C Verifiable Credentials 2.0**, devenu recommandation
  officielle en mai 2025 ; compatible **Open Badges 3.0**).
- **Possédé par la personne** (dans son portefeuille), pas par une institution.
- **Vérifiable par n'importe qui** (employeur, Guilde, autre apprenant) en quelques secondes, **sans
  demander la permission de Dowze**.

Spécification technique complète (VC, schéma, révocation, sans blockchain) :
[05-TECHNIQUE/04-passeport-verifiable-specs.md](../05-TECHNIQUE/04-passeport-verifiable-specs.md).

---

## Pourquoi c'est exactement la pièce manquante

Le recrutement « sur compétences » échoue aujourd'hui (<1 embauche sur 700) **non par mauvaise volonté**,
mais parce que les employeurs n'ont aucun moyen *fiable et standardisé* de vérifier une compétence sans
diplôme. Quand un employeur peut vérifier **en un clic** qu'une personne a réellement livré 14 projets de
ce type, évalués par des maîtres reconnus et utilisés dans le monde réel, le diplôme devient **inutile**.

Le Passeport fournit précisément cette infrastructure de confiance — ce qui distingue Dowze d'un simple
empilement de badges (dont la valeur dépend de la seule réputation de l'émetteur).

---

## Anti-fraude

- **Identité vérifiée** pour les preuves à fort enjeu.
- **Épreuves observées** en conditions réelles devant témoins (on ne peut pas « tricher » une compétence
  qu'il faut démontrer en direct).
- **Croisement des sources** (un faux passe difficilement les cinq filtres).
- **Signature cryptographique** : le credential ne peut pas être falsifié ni l'émetteur usurpé.

⚠️ **Distinction importante** : la cryptographie résout l'**authenticité** (le credential vient bien de
qui il prétend), pas la **validité de l'apprentissage** ni l'identité lors de l'évaluation. C'est pourquoi
Dowze ne se repose **pas** sur la seule signature : la validité vient de la **preuve de travail réel** et de
la vérification multi-source. Le proctoring intrusif (reconnaissance faciale) est évité au profit de
l'épreuve observée et de la preuve d'usage.

---

## Choix techniques assumés

- **On bâtit sur W3C VC 2.0 + Open Badges 3.0** (mûrs, neutres, sans blockchain).
- **On évite la blockchain comme socle** : elle n'est *pas nécessaire* pour l'infalsifiabilité (la
  signature suffit) ; la tendance de fond (y compris 1EdTech) s'en éloigne. Voir
  [crise du diplôme](../01-DIAGNOSTIC/04-crise-du-diplome.md).
- **On reste prudent sur les DID** (identifiants décentralisés) : standard contesté/fragmenté ; Dowze peut
  s'en passer au départ.
- **On s'aligne sur CLR/LER** (relevés agrégés, émergents) pour l'interopérabilité future.

---

## Ce que le Passeport n'est pas

- ❌ Un diplôme numérisé (il est granulaire, vivant, multi-source).
- ❌ Une collection de badges creux (chaque preuve repose sur un travail réel vérifié).
- ❌ Un produit Dowze verrouillé (il appartient à l'apprenant, portable, vérifiable hors Dowze).
- ❌ Une promesse d'emploi (c'est un *signal de compétence fiable*, pas un placement garanti — on ne
  reproduit pas les métriques gonflées des bootcamps).

**Suite** : [le Socle](06-socle.md) — ce qui garantit que tout cela reste un bien commun.
