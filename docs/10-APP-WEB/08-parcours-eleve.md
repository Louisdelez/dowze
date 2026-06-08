# Le parcours d'un nouvel élève (le premier jour, et après)

> *« Je m'inscris, j'ai mon intra, j'ai mon abonnement IA — je fais quoi ? »*
>
> *Réponse en une phrase : **tu ne choisis rien, et tu n'as rien à savoir.** Tu es **placé** sur le tronc
> commun prescrit à ton niveau, et l'intra te dit **quoi faire ensuite** — comme une école. Le choix d'une
> spécialité viendra **bien plus tard** (voir [le Cursus](../03-ARCHITECTURE/07-cursus-et-specialisation.md)).*

Tu as deux fenêtres : **l'intra Dowze** (le portail web qui pilote) et **ton IA** (Claude/ChatGPT, qui
enseigne). Mode copier-coller : l'intra te donne les prompts, tu les colles dans ton IA, tu recolles le
résultat.

---

## Étape 0 — Tu crées ton compte (2 min)

E-mail / Google, un pseudo, et **une seule question** : *quelle IA utilises-tu ?* → tu choisis. C'est tout.
➡️ Tu arrives sur ton **tableau de bord**, avec un bouton **« Commencer ».**

> ❌ Ce qu'on **ne** te demande **pas** : « qu'est-ce que tu veux apprendre ? ». Tu es un élève, pas un
> professeur — ce n'est pas à toi de savoir le programme.

---

## Étape 1 — Le diagnostic (l'intra te place sur le tronc commun)

L'intra t'explique : *« Tu vas suivre un parcours complet d'éducation générale, comme à l'école. Pour
commencer au bon endroit, on situe d'abord ton niveau — aucune mauvaise réponse. »*

Elle te donne un **prompt de diagnostic** à coller dans ton IA. L'IA te pose des questions ciblées (sur les
domaines du tronc commun : langue, maths, sciences, etc.) pour voir **ce que tu maîtrises déjà**. À la fin,
elle produit un bloc résultat que tu **recolles dans l'intra**.

➡️ L'intra te **place** sur la carte du tronc commun : elle sait ce que tu maîtrises déjà (on le valide,
tu ne le refais pas) et où tu dois commencer.

---

## Étape 2 — L'intra t'affiche TON parcours (déjà tracé)

Tu vois ton **tronc commun** : non pas des « matières » cloisonnées, mais ta progression sur les **3 fils**
du [Cursus](../03-ARCHITECTURE/07-cursus-et-specialisation.md) (Fondations, Aptitudes durables,
Concepts-clés) et **ta prochaine Expédition** — mise en avant, **une seule**.

Une **Expédition**, c'est un défi réel autour d'une grande question (ex. *« Peut-on faire confiance à ce
qu'on lit ? »*) qui te fait travailler plusieurs disciplines d'un coup, pendant 2 à 6 semaines.

Tu n'as **rien choisi**. Le programme est là, complet et ordonné, comme dans une école. L'intra te dit
simplement : *« Voici où tu en es. Prochaine étape : [telle Expédition]. »*

> C'est l'intra (le **Cursus**) qui tient ce programme — pas l'IA qui l'invente. L'IA *enseigne* dessus.

---

## Étape 3 — Tu apprends (l'Expédition, avec ton IA)

L'intra te donne un **fichier `.json`** (l'« ALLER ») qui contient le prompt de l'Expédition (déjà rempli
avec ton niveau et la grande question du moment), **le format exact de la réponse attendue, et un exemple** :

> 📋 *« Copier »* / 💾 *« Télécharger le .json »*

Tu le **donnes à ton IA** (tu colles le contenu, ou tu uploades le fichier). Là, **ton IA devient ton
prof** : elle lance l'**Étincelle** (la grande idée), te fait formuler ta **Question**, **te pose des
questions** au lieu de donner les réponses, te corrige, adapte le niveau. Tu avances dans le défi
(recherche, données, raisonnement) vers l'**Acte** : produire quelque chose de réel. Au fil de l'Expédition,
tu exerces des **aptitudes durables** (esprit critique…) et tu appliques des **concepts-clés** (preuve,
causalité…) — sans que ce soit « une matière ».

> Pas d'API : le lien intra ↔ IA passe par ce **fichier `.json`** que tu fais voyager à la main. Détail :
> [le pont `.json`](10-pont-json.md).

---

## Étape 4 — Tu valides (par paliers, sans QCM, non-bloquant)

À la fin, ton IA produit le **`.json` RETOUR** (au format demandé) ; tu le **réimportes dans l'intra**, qui
le lit et met à jour ta progression. La validation se fait **par paliers** (modèle École 42, pas de QCM) :

1. **Auto-validation** (instantanée) : tu coches une **checklist factuelle** (« mon livrable existe », « je
   peux l'expliquer »). → ça **débloque tout de suite** la compétence suivante. **Tu n'attends personne.**
2. **Validation par les pairs** (en file, plus tard) : ton livrable part dans une file ; un ou deux membres
   de la communauté le valident avec une grille — ça peut prendre des jours ou des semaines, **et pendant
   ce temps tu continues**. Quand c'est fait, ta preuve **monte en niveau** (de « auto-validé » à
   « pair-validé »).

➡️ Tu n'es **jamais bloqué** : l'auto-validation suffit pour avancer ; la validation par les pairs renforce
ta preuve ensuite. Détail : [le système de validation](09-validation.md).

---

## Étape 5 — L'intra retient et t'amène au pas suivant

Automatiquement : ta carte se met à jour, ton **carnet de bord** est sauvegardé (pour reprendre demain pile
où tu en es), une **révision** est programmée pour ne pas oublier, et l'intra te **félicite et t'invite à
t'arrêter** (pas de scroll sans fin).

---

## La boucle, chaque jour

```
Intra : « voici ton prochain pas + le prompt »
        →  tu colles dans ton IA  →  tu apprends / tu fais
        →  ton IA produit un rapport  →  tu le recolles dans l'intra
        →  l'intra valide, retient, et t'amène au pas suivant
```

Tu n'as **jamais** à te demander « je fais quoi ? ». L'intra te le dit (le programme), ton IA te l'enseigne
(le cours). Exactement comme une école — mais à ton rythme, et avec un prof particulier rien que pour toi.

---

## Et après ? La spécialisation (bien plus tard)

Tu avances ainsi dans **tout le tronc commun** (l'éducation générale complète). Ce n'est **qu'à la fin** —
quand tu maîtrises le tronc commun, à l'adolescence avancée — que la question change :

- l'intra te fait **explorer** plusieurs spécialités (te les faire goûter) ;
- tu passes un **inventaire d'intérêts** (un déclencheur, pas un verdict) ;
- un **mentor** t'accompagne ;
- **là, et seulement là, tu choisis** une spécialité à approfondir (comme une filière de lycée ou une
  majeure d'université), tout en gardant une base générale.

C'est le moment où l'élève, devenu assez avancé pour *savoir* ce qui existe et ce qu'il aime, prend la main.
Détail : [le Cursus](../03-ARCHITECTURE/07-cursus-et-specialisation.md).

---

## Résumé

| Quand | Qui décide du *quoi* | Ce que fait l'élève |
|-------|----------------------|----------------------|
| **Inscription → tronc commun** | **Le système** (programme prescrit) | Il est placé, il suit, il maîtrise à son rythme |
| **Fin du tronc commun** | Transition accompagnée | Il explore, teste, est conseillé |
| **Spécialisation** | **L'élève** (choix accompagné) | Il choisit une voie à approfondir |
| **Âge adulte** | **L'élève** | Il approfondit, pivote, se reconvertit |

> L'élève ne commence pas par choisir. Il commence par **être pris en charge** — et gagne progressivement
> le droit et la capacité de choisir, à mesure qu'il maîtrise.
