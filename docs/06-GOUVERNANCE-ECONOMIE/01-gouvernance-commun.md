# Gouvernance : un bien commun, pas un empire

> *Dowze est un **protocole ouvert** gouverné collectivement — conçu pour qu'aucune entreprise ni aucun
> État ne puisse le capturer.*

---

## Le modèle : le commun numérique

Dowze s'inspire des **communs numériques durables** qui ont transformé le monde sans appartenir à
personne :

- le **web** (protocoles ouverts, W3C) ;
- **Wikipédia** (savoir co-produit, fondation à but non lucratif) ;
- **Linux** (open source, gouvernance distribuée).

Ces communs ont en commun : ouverture, gouvernance multi-acteurs, et **impossibilité de capture par un
seul acteur**. C'est le modèle de Dowze.

---

## Structure de gouvernance

```
┌──────────────────────────────────────────────────────────────┐
│             FONDATION Dowze (à but non lucratif)                │
│   Mission : garantir le protocole, les principes, le commun    │
└───────────────┬──────────────────────────────────────────────┘
                │
   ┌────────────┼─────────────┬──────────────┬──────────────────┐
   ▼            ▼             ▼              ▼                  ▼
┌────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌────────────────┐
│ États / │ │ Société  │ │Éducateurs│ │ Apprenants  │ │ Scientifiques /│
│publics  │ │ civile   │ │ & Guildes│ │ (voix réelle)│ │ comité éthique │
└────────┘ └──────────┘ └──────────┘ └─────────────┘ └────────────────┘
   instances fédérées (par région/pays) — souveraineté & résilience
```

- **Multi-acteurs** : États, société civile, éducateurs, apprenants, scientifiques — aucun ne domine.
- **Fédérée** : chaque région peut héberger sa part (souveraineté des données, conformité locale,
  résilience). Voir [interopérabilité](../05-TECHNIQUE/06-interoperabilite-standards.md).
- **Open source** : code et protocole ouverts, auditables par tous.
- **Fondation à but non lucratif** : gardienne des principes, sans actionnaires à rémunérer.

---

## Les mécanismes anti-capture

| Risque de capture | Garde-fou |
|-------------------|-----------|
| Rachat par une entreprise | Fondation non lucrative ; protocole ouvert ; pas d'actif à racheter |
| Mainmise d'un État | Fédération ; gouvernance multi-acteurs ; code ouvert (forkable) |
| Dépendance à un fournisseur (cas LAUSD) | Standards ouverts ; plusieurs implémentations possibles |
| Monétisation cachée des données | Interdiction structurelle (statuts) ; audits ; principe 11 |
| Dérive vers l'addiction | Interdiction des *dark patterns* (principe 9) ; métriques de bien-être |
| Verrouillage des apprenants | Portabilité garantie (données et preuves exportables) |

> **Le droit de *forker*** : parce que le code et le protocole sont ouverts, si la gouvernance dérivait,
> la communauté pourrait reprendre (forker) le projet. C'est l'ultime garde-fou démocratique des communs
> numériques.

---

## Comment les décisions se prennent

- **Les principes fondateurs** ([12 principes](../00-FONDATIONS/03-principes-fondateurs.md)) sont
  « constitutionnels » : ils ne peuvent être modifiés qu'à une majorité qualifiée et après débat public.
- **Les évolutions du protocole** (Atlas, Passeport, API) suivent un processus ouvert de propositions,
  versionné (modèle des standards W3C : RFC, revue, consensus).
- **La curation de l'Atlas** est déléguée aux Guildes et experts, sous supervision de la gouvernance
  (arbitrage des litiges, lutte contre la désinformation).
- **La voix des apprenants** est structurellement représentée — ce ne sont pas de simples « usagers ».

---

## Le comité éthique & sûreté

Un organe indépendant veille à :

- la **sûreté des mineurs** (voir [sécurité des mineurs](../07-RISQUES-ETHIQUE/03-securite-mineurs.md)) ;
- l'**équité et les biais** (audits indépendants — voir [équité/biais](../07-RISQUES-ETHIQUE/04-equite-biais.md)) ;
- la **sécurité de l'IA** (alignement, transparence, human-in-the-loop) ;
- le respect du **bien-être** (pas de *dark patterns*, métriques saines).

Il a un **pouvoir de veto** sur les fonctionnalités qui violeraient les principes.

---

## Pourquoi pas une entreprise (même « à mission ») ?

Une entreprise, même bien intentionnée, subit la pression de ses investisseurs et la tentation de la
monétisation (cas BloomTech). Une infrastructure éducative mondiale qui détient les données
d'apprentissage de milliards de personnes **ne peut pas** être un actif privé : ce serait un risque
systémique pour la liberté et l'équité. Le commun est le **seul modèle compatible** avec les principes 11
et 12.

**Suite** : [le modèle économique](02-modele-economique.md).
