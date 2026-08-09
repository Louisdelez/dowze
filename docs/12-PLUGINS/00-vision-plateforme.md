# 00 — Vision : Dowze, une super-app de style de vie

## De l'académie au style de vie

Dowze a commencé comme une école du futur. Mais l'ambition est plus large : **un style de vie et une
manière de penser** qui ne s'arrêtent pas à l'étude. Apprendre, bouger son corps, bien se nourrir,
progresser dans une passion — ce sont des facettes d'une même vie, et elles devraient vivre dans **un seul
système cohérent**, pas dans dix apps déconnectées.

Les **plugins** matérialisent cette ambition : des applications satellites (`fitness.dowze.ch`,
`sports.dowze.ch`, `alimentations.dowze.ch`, et d'autres) qui **réutilisent le cœur de Dowze** au lieu de le
réinventer.

## Le modèle : super-app à cœur partagé

La recherche (a16z sur les super-apps, WeChat mini-programmes) est claire : une super-app repose sur un
**socle non négociable — identité + services communs partagés** — que les modules **consomment** sans
jamais le dupliquer. La croissance est **verticale** (résoudre plusieurs problèmes du **même** utilisateur,
mesurée en visites/jour) plutôt qu'horizontale. L'échec des tentatives occidentales vient du **siloing** et
de la monétisation par app plutôt que de l'intégration de l'écosystème.

**Pour Dowze**, le cœur partagé, c'est :
- **l'identité** (un seul compte Supabase pour toutes les apps `*.dowze.ch`) ;
- **l'IA de Dowze et le RAG** (le Copilote, `generateStructured`, la mémoire, le RAG structuré/GraphRAG) ;
- **le profil / dossier de l'apprenant** ;
- **le planning / calendrier** — la pièce maîtresse : c'est là que l'étude, le sport et les repas
  s'orchestrent ensemble ;
- **la philosophie et les garde-fous** (voir plus bas).

Chaque plugin apporte sa **verticale** (le corps, le mouvement, l'alimentation) mais s'appuie sur ce cœur.
Un utilisateur d'`academie` découvre `fitness` **sans recréer de compte** ; ses séances de sport
apparaissent **dans le même calendrier** que ses cours, arbitrées par la même IA.

## La philosophie comme fil rouge (obligatoire pour tout plugin)

Un plugin Dowze n'est pas une app générique repeinte. Il **hérite de la philosophie** et doit la respecter :

1. **L'IA de Dowze orchestre, elle n'est jamais le prof/coach à ta place.** Comme pour « Ma séance » et le
   cours de langue (modèle *compose → ton IA → ingest*), un plugin peut composer un prompt/contexte et
   ingérer un résumé, mais ne se substitue pas à l'humain. Cf. [[dowze-academie]], la mémoire projet.
2. **Non-punitif, jamais culpabilisant.** Un raté ne « casse » rien (science des habitudes) ; on replanifie
   avec bienveillance. Pas de streak « zéro-remise-à-zéro », pas de honte.
3. **Régularité > intensité.** L'ancrage d'une habitude vient de la répétition dans un contexte constant.
4. **Sobriété et anti-obsession.** Pas de comptage calorique obsessionnel, pas de classement social, pas de
   métrique délétère. On mesure la **régularité**, la **maîtrise** et la **croissance**.
5. **Zéro fuite technique dans le visible + UI épurée, icônes Lucide only** ([[ui-icones-lucide]]).
6. **RGPD par conception.** Les données sensibles (santé pour fitness) sont traitées avec un consentement
   explicite séparé (RGPD Art. 9), cloisonnées, chiffrées.

## Ce que ça change pour Dowze

- Dowze devient une **plateforme**, pas une seule app. Le cœur expose des **contrats stables** (API
  versionnée + événements) que les plugins consomment.
- Le **planning/calendrier** devient le point de rendez-vous de toute la vie de l'utilisateur : l'IA y
  place l'étude ET le sport ET les repas, en respectant la récupération et la charge.
- La création de plugins reste **réservée à l'équipe Dowze** (first-party) : pas de marketplace public, donc
  pas de sandbox de code hostile — mais des **contrats, des scopes et des versions** pour rester découplé.

Voir [01-architecture-plugins.md](01-architecture-plugins.md) pour l'architecture, et
[04-plan-implementation.md](04-plan-implementation.md) pour le plan.
