# Le parcours d'un nouvel élève (le premier jour, et après)

> *« Je m'inscris, j'ai mon intra, j'ai mon abonnement IA — je fais quoi ? »*
>
> *Réponse en une phrase : **tu ne choisis rien, et tu n'as rien à savoir.** Tu es **placé** sur le tronc
> commun prescrit à ton niveau, et l'intra te dit **quoi faire ensuite** — comme une école. Le choix d'une
> spécialité viendra **bien plus tard** (voir [le Cursus](../03-ARCHITECTURE/07-cursus-et-specialisation.md)).*

Tu as deux fenêtres : **l'intra Dowze** (le portail web qui pilote) et **ton IA** (Claude/ChatGPT, qui
enseigne). Mode copier-coller : l'intra te donne les prompts, tu les colles dans ton IA, tu recolles le
résultat.

> 🔎 **Le détail de l'entrée** (inscription, profil, présentation, dossier élève, test de placement) est
> dans [onboarding, profil & placement](19-onboarding-profil-placement.md). Ci-dessous, la vue d'ensemble.

---

## Étape 0 — Tu crées ton compte, ton profil et tu te présentes

**Inscription minimale** : e-mail + mot de passe, c'est tout. Après validation de ton e-mail, tu complètes
ton **profil** (photo, pseudo, **date de naissance**) — c'est la date de naissance, et non une case à
cocher, qui gère le statut mineur et le consentement parental (&lt; 15 ans en France).

Puis tu **te présentes** : un formulaire libre (« parle-nous de toi : passions, hobbies, rêves, ce que tu
veux apprendre »). L'IA de Dowze en fait ton **dossier élève** — comme un prof qui apprend à te connaître —
que **tu valides**. Il servira à personnaliser tes exemples et à te motiver.

> ❌ Ce qu'on **ne** te demande **pas** : « qu'est-ce que tu veux apprendre *en programme* ? ». Tu es un
> élève, pas un professeur — ce n'est pas à toi de savoir le programme. On te demande **qui tu es**, pas ce
> que tu dois étudier.

---

## Étape 1 — Le test de placement (l'intra te place sur le tronc commun)

L'intra t'explique : *« Tu vas suivre un parcours complet d'éducation générale, comme à l'école. Pour
commencer au bon endroit, on situe d'abord ton niveau — aucune mauvaise réponse. »*

Tu passes un **test de placement adaptatif** court et **sans stress** : chaque question s'ajuste à tes
réponses (comme une recherche binaire), et on s'arrête dès qu'on a situé ton niveau. Un adulte diplômé ne
commence pas en maternelle ; un débutant peut même le sauter et démarrer au niveau 1.

➡️ L'intra te **place** sur la carte du tronc commun : elle sait ce que tu maîtrises déjà (on le valide,
tu ne le refais pas) et **où** tu dois commencer. Détail : [le test de placement](19-onboarding-profil-placement.md#5-le-test-de-placement--situer-le-bon-niveau-maternelle--master).

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

## Étape 3 — Tu apprends (ta séance, avec ton IA)

> ⭐ **RÉVISION 2026** — le va-et-vient `.json` **côté élève** est supprimé : c'est désormais le
> **[Copilote](15-copilote-orchestrateur.md)** (petite IA interne à Dowze) qui compose un **prompt lisible**
> et qui **structure ton résumé de séance**. Tu ne manipules plus jamais de `.json`. Ci-dessous, le principe
> reste le même (copier-coller), mais avec du **texte clair**.

L'intra te donne le **prompt du jour** (déjà rempli avec ta compétence, ton niveau, ta mémoire de
progression). Ta **séance dure 45 minutes**, avec un **minuteur** dans la barre du haut et une **alarme** à
la fin → puis un **bilan** et une **pause** ([la séance & le minuteur](17-seance-et-minuteur.md)).

Tu **colles le prompt dans ton IA**. Là, **ton IA devient ton prof** : elle t'accueille, **te pose des
questions** au lieu de donner les réponses, te corrige, adapte le niveau — sur **une compétence précise**.
À la fin, tu colles le **prompt de bilan** ; ton IA écrit un résumé sincère que tu **recolles dans
l'intra**, où le Copilote le transforme en progression.

> Sur du plus long cours, ce n'est plus une séance mais une **[Expédition](20-expeditions.md)** : un projet
> guidé (Étincelle → Question → Défi → Acte → Trace) autour d'une grande question. Différence détaillée :
> [Ma séance vs Expéditions](21-seance-vs-expeditions.md).

---

## Étape 4 — Tu valides (par paliers, sans QCM, non-bloquant)

Le [Copilote](15-copilote-orchestrateur.md) a mis à jour ta progression à partir de ton résumé. La
validation d'une **compétence**, elle, se fait **par paliers** (modèle École 42, pas de QCM) — à ne pas
confondre avec les [tests & examens](18-tests-et-examens.md), qui servent à **réviser** et **ne valident
rien** :

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
