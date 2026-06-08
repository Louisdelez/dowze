# Le système communautaire de l'école

> *La communauté n'est pas un gadget collé à côté des cours : c'est **la moitié vivante de l'école**. Ce
> sous-dossier conçoit un **vrai système communautaire complet** pour l'application web — fonctionnalités,
> mécaniques, architecture technique — inspiré des plateformes qui font réellement vivre des communautés
> d'apprentissage (Skool, Discord study servers, Duolingo, Stack Overflow, Circle/Mighty, Focusmate).*

| Fichier | Contenu |
|---------|---------|
| [01-fonctionnalites.md](01-fonctionnalites.md) | **Toutes les fonctionnalités** du système communautaire, organisées en 7 couches, avec leurs mécaniques concrètes. |
| [02-mecaniques-engagement.md](02-mecaniques-engagement.md) | Gamification, réputation, ligues, study-together, événements live — comment on rend la communauté vivante (et les garde-fous). |
| [03-implementation-technique.md](03-implementation-technique.md) | Modèles de données, temps réel, feed/ranking, matching, notifications, modération — sur Next.js + Supabase. |
| [04-securite-cold-start.md](04-securite-cold-start.md) | Sûreté des mineurs, modération, et démarrage à froid (faire vivre la communauté de 1 à N). |
| [05-classes-et-communication.md](05-classes-et-communication.md) | **Les Classes** (formées auto par niveau/langue, cycle de vie + brassage) et la **communication** (messagerie, visio, appels, groupes, binômes). |
| [06-systeme-parental-et-moderation.md](06-systeme-parental-et-moderation.md) | **Sécurité sans brider** : système parental (à la Pronote : consentement, compte parent, bilans email, alertes) + modération (à la Discord : bots + ML toxicité + modérateurs). |

---

## La vision en une image

L'unité de base est l'**Espace-Classe** (modèle Mighty Networks + Skool) : un seul écran qui regroupe
**feed + cours/parcours + calendrier d'événements + annuaire + salles d'étude + Q&A**. Au-dessus, des
**Guildes par matière** (espaces transverses inter-classes pour l'entraide).

```
┌──────────────────────────────────────────────────────────────────────┐
│  ESPACE-CLASSE (cohorte de ~20-30 élèves)                              │
│  ┌──────────┬───────────┬────────────┬──────────┬─────────┬─────────┐  │
│  │  Feed    │  Parcours │  Calendrier│ Annuaire │ Salles  │  Q&A    │  │
│  │ (posts,  │  (cours + │  (lives,   │ +matching│ d'étude │(entraide│  │
│  │ shoutouts)│  quêtes)  │  challenges)│ partenaire│(vidéo+ │ votée)  │  │
│  │          │           │            │          │ pomodoro)│         │  │
│  └──────────┴───────────┴────────────┴──────────┴─────────┴─────────┘  │
└──────────────────────────────────────────────────────────────────────┘
        ▲                                                      ▲
   alimentée par                                         alimentent
   l'IA-tuteur (XP réel, mérité)                   les Guildes par matière
                                                   (Q&A inter-classes durable)
```

---

## Le fil conducteur (comment IA et communauté se nourrissent)

> **L'IA-tuteur alimente la communauté en signaux d'apprentissage fiables** (l'XP est *mérité*, validé par
> la maîtrise — pas farmé). **La communauté alimente la rétention** (ligues, study halls, accountability,
> Q&A) — exactement ce que l'IA seule ne peut pas créer.

Et un principe repris de **Skool** : les **niveaux communautaires débloquent du contenu** → la
participation à la communauté devient *la porte d'entrée* de l'apprentissage, pas un à-côté décoratif.

---

## Les 7 couches du système (vue d'ensemble)

| # | Couche | Rôle | Inspiration |
|---|--------|------|-------------|
| 1 | **Espaces** (Classes + Guildes) | L'architecture : où vit la communauté | Mighty + Circle |
| 2 | **Feed & contenu** | Poster, partager ses progrès, shoutouts | Skool, Coursera (fil par leçon) |
| 3 | **Q&A / Entraide** | Questions votées → base de connaissances durable | Stack Overflow |
| 4 | **Étude ensemble** | Salles vidéo, body-doubling, pomodoro, temps d'étude | Discord/StudyLion, Focusmate |
| 5 | **Gamification** | Deux monnaies : XP d'apprentissage + points communauté | Duolingo + Skool |
| 6 | **Social & accountability** | Binômes, streaks, quêtes coopératives, mentorat | Duolingo + Focusmate |
| 7 | **Rythme live** | Le battement hebdomadaire : challenges, AMA, study halls | Cohortes / CBC |

Détail complet : [01-fonctionnalites.md](01-fonctionnalites.md).

---

## Note de cadrage (honnêteté)

Ce système est **riche par conception** — c'est un vrai réseau d'apprentissage. Deux précautions, traitées
en détail dans [04-securite-cold-start.md](04-securite-cold-start.md) :

1. **Sûreté des mineurs** : un système communautaire puissant impose une modération sérieuse (le
   contre-exemple École 42 le prouve). Non négociable.
2. **Démarrage** : la communauté se construit progressivement ; les mécaniques sont conçues pour
   **fonctionner dès les premiers membres** (asynchrone d'abord, l'IA et le contenu modèle amorcent le
   lieu) et **monter en puissance** avec le nombre.

Mais le cœur du sujet, ici, c'est **le système lui-même** : ce qu'on construit, comment ça marche, et
comment ça rend la communauté vivante.
