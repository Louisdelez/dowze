# Sûreté & démarrage de la communauté

> *Un système communautaire riche impose deux choses : une **sûreté sérieuse** (surtout pour les mineurs)
> et une stratégie pour **amorcer** la communauté depuis zéro. Voici les deux.*

---

## PARTIE 1 — Sûreté & modération

### Pourquoi c'est non négociable
Pour des mineurs, la sécurité n'est pas une fonctionnalité, c'est une **condition légale et éthique**.

**Le contre-exemple à ne JAMAIS reproduire — École 42** : une communauté peer-to-peer **non encadrée** →
climat toxique documenté (contenus misogynes/pornographiques sur des canaux gérés par les élèves, **<10 %
de femmes**, harcèlement, aucune sanction). La direction s'est défendue en disant que les canaux étaient
« gérés par les étudiants eux-mêmes ». **Leçon : ne jamais déléguer la modération à la communauté par
défaut.**

**Le modèle à imiter — Khan Academy / Khanmigo** :
- plateforme **sans publicité**, contenu éducatif uniquement, **modération stricte** ;
- **Khan Academy Kids** : **aucune fonction sociale** pour les plus jeunes (jardin clos total) ;
- **Khanmigo** : détection automatique d'interactions inappropriées/dangereuses → **notification e-mail à
  un adulte** lié au compte ; pas d'entraînement des LLM sur les données élèves.

### Les règles de sûreté — par la modération + le suivi parental (PAS par le bridage)

> **Mise à jour majeure** : on ne **bride pas** les mineurs (mêmes fonctionnalités pour tous). La sécurité
> vient de la **modération forte** + du **système parental**, détaillés dans
> [système parental & modération](06-systeme-parental-et-moderation.md). Résumé :

| Règle | Détail |
|-------|--------|
| **Mêmes fonctionnalités pour tous** | DM, visio, communauté identiques pour mineurs et adultes — les toxiques sont **modérés**, pas l'inverse |
| **Modération forte (type Discord)** | Bots AutoMod (mots-clés/regex/spam) + ML toxicité **bidirectionnel** (qui harcèle ET qui est harcelé) → **modérateurs humains** qui tranchent. L'IA priorise, ne bannit jamais seule |
| **Système parental (type Pronote)** | Email du responsable légal à l'inscription (consentement « email plus ») ; **compte parent optionnel** (suivi) ou **bilan email** ; **alertes urgentes** si un mineur est auteur OU victime d'un incident grave |
| **Vérification d'âge + consentement parental** | COPPA (<13), RGPD art. 8 (France 15, UE 16), nLPD (Suisse) |
| **Détresse / auto-mutilation** | Escalade humaine immédiate + orientation vers de l'aide + alerte parent |
| **Minimisation des données** | Pas d'entraînement LLM sur données élèves ; ne stocker que le nécessaire |
| **Journalisation + signalement/blocage 1 clic** | Audit ; rate-limit des signalements (anti-abus) |
| **Cadre naturel** | La communauté = **membres inscrits** (classes, Guildes), pas d'inconnus aléatoires → risque réduit sans rien retirer |

### Les rôles de modération (montée graduelle)
```
novice → pair-reviewer (après calibration) → mentor (après maîtrise) → modérateur (formé)
```
**La plateforme conserve la modération de dernier ressort.** Détail complet :
[système parental & modération](06-systeme-parental-et-moderation.md).

> Détail réglementaire : [juridique & conformité](../../06-GOUVERNANCE-ECONOMIE/03-juridique-conformite.md)
> et [conformité de l'app](../06-stack-et-conformite.md). Implémentation : [03 §8](03-implementation-technique.md#8-modération-technique).

---

## PARTIE 2 — Le démarrage à froid (faire vivre la communauté de 1 à N)

Un système communautaire riche **ne sert à rien si la communauté est vide**. Voici comment l'amorcer.
Principe directeur (Andrew Chen, *The Cold Start Problem*) : ne pas viser « une communauté » d'emblée, mais
le **plus petit groupe qui s'auto-entretient** — dense et complet — puis croître.

### La « communauté minimale viable » : 1 → 2 → guilde
```
n = 1     l'IA-tuteur tient le lieu (affichée comme IA) + le carnet de bord
n = 2-3   binôme de redevabilité (le format le plus solide à petit effectif)
n = groupe   première cohorte / guilde de matière → ligues, study halls, Q&A
```

### Les 6 leviers d'amorçage (sans jamais tricher)

1. **Asynchrone d'abord** : galerie de quêtes/projets, Q&A, « défi de la semaine ». Pas besoin de 2
   personnes en ligne simultanément pour que le lieu soit vivant.
2. **Seeding de contenu, PAS de fausses personnes** : pré-remplir les Guildes avec des questions-réponses
   exemplaires, des projets modèles, des parcours commentés — **clairement étiquetés comme contenu
   officiel/IA**. (Reddit a démarré avec de faux comptes humains : **inapplicable ici**, *a fortiori* avec
   des mineurs.)
3. **L'IA comme premier membre actif** : elle peut répondre aux premières questions, animer un study hall,
   être le partenaire de body-doubling — **toujours identifiée comme IA**, jamais déguisée en élève.
4. **Le fondateur très présent** : répondre personnellement, animer les premiers lives (comme tous les
   produits communautaires réussis).
5. **Jamais afficher du vide** : pas de « 0 membre en ligne », pas de feed désert. Montrer la valeur
   (contenu seedé, activité de l'IA) sans dépendre des pairs.
6. **Capturer les contributions des premiers élèves** : leurs solutions, explications, bonnes questions
   deviennent le *seed* pour les suivants → enclenche le moteur « qui maîtrise devient mentor ».

### La trajectoire de croissance des fonctionnalités

| Effectif | Ce qu'on active |
|----------|-----------------|
| **1** | Feed (seedé) + Q&A (seedé) + IA-animatrice + carnet de bord |
| **2-5** | Binômes de redevabilité ; premières vraies Q&A ; salle d'étude partagée |
| **~10-30** | Une **cohorte/classe** : ligues hebdo, study halls, challenges, mentorat |
| **plusieurs classes** | **Guildes par matière** (Q&A inter-classes durable) ; AMA ; rythme live complet |
| **échelle** | Auto-modération distribuée progressive ; réputation → rôles |

> Chaque fonctionnalité riche (ligues, study halls, guildes) **s'active au bon palier** — on ne montre pas
> une ligue de 1 personne. Le système est conçu pour **dégrader gracieusement** vers le bas (utile à 1) et
> **monter en puissance** avec le nombre.

---

## Synthèse

- **Sûreté = condition, pas option** : jardin clos, modération hybride, notification adulte, plateforme qui
  garde le veto. Le modèle Khan, pas le modèle 42.
- **Cold-start maîtrisé** : l'IA et le contenu seedé tiennent le lieu à n=1 ; les fonctionnalités riches
  s'activent par paliers ; jamais de faux comptes humains, jamais de vide affiché.
- **Le système communautaire est complet et ambitieux** — et il sait vivre petit avant de vivre grand.

Retour à la [vue d'ensemble](README.md) · [fonctionnalités](01-fonctionnalites.md) ·
[mécaniques](02-mecaniques-engagement.md) · [implémentation](03-implementation-technique.md).
