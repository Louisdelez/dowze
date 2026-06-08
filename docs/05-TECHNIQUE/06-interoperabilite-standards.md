# Spécification — interopérabilité & standards ouverts

> *Dowze est un **protocole**, pas un silo. Il réussit s'il s'intègre dans l'écosystème existant et reste
> ouvert à plusieurs implémentations. Voici les standards retenus et leur statut honnête.*

---

## Le principe : assembler des standards mûrs

| Brique Dowze | Standard / techno | Statut | Raison |
|-------------|-------------------|--------|--------|
| Compétences (Atlas) | **ESCO**, **O*NET** (+ crosswalk) | ✅ Mûr | Référentiels publics, interopérables |
| Preuves (Passeport) | **W3C VC 2.0** | ✅ Mûr (mai 2025) | Couche de confiance neutre, sans blockchain |
| Badges | **Open Badges 3.0** | ✅ Mûr (2024) | Bâti sur VC, 74 M+ badges émis |
| Relevés agrégés | **CLR / LER** (1EdTech) | 🟡 Émergent | Pour l'intégration RH future |
| Identité décentralisée | **DID** (W3C) | 🟡 Contesté | Optionnel — fragmenté |
| Credentials blockchain | Blockcerts | 🔴 Évité | Non nécessaire |
| Contenu offline | format type **Kolibri** | ✅ Éprouvé | Diffusion hors-ligne validée |
| Contenu ouvert | **OER** + licences **CC** | ✅ Mûr | Ressources libres et réutilisables |
| Interop. pédagogique | **xAPI / Caliper** | ✅ Mûr | Traçabilité d'apprentissage standardisée |

---

## Pourquoi ces choix (et ces rejets)

### On adopte
- **ESCO/O*NET** : ne pas réinventer une taxonomie mondiale de compétences ; bénéficier du crosswalk
  transatlantique. (En complétant le volet non-professionnel, leur angle mort.)
- **W3C VC 2.0 + Open Badges 3.0** : la couche de confiance est mûre, neutre, et **n'exige pas de
  blockchain**.
- **OER + Creative Commons** : l'Atlas pointe vers des ressources libres et réutilisables quand elles
  existent.
- **xAPI / Caliper** : standards de traçabilité d'apprentissage, utiles pour l'interopérabilité avec
  d'autres systèmes (sans jamais trahir la vie privée — principe 11).

### On évite / on diffère
- **Blockchain** : complexité, coût, fragmentation, **non nécessaire** (la signature suffit).
- **DID** : standard contesté (Google/Apple/Mozilla) ; on garde la porte ouverte sans en dépendre.
- **Formats propriétaires fermés** : contraires au principe « bien commun » (12).

---

## API ouvertes (esquisse)

Dowze expose des API publiques et documentées, par service :

- **Atlas** : `GET /atlas/skill/{id}`, `GET /atlas/path?from=…&to=…` (chemin personnalisé), `GET
  /atlas/search`, mappings ESCO/O*NET.
- **Preuve** : émission VC, **vérification** (`POST /verify` — utilisable par tout employeur), révocation.
- **Communauté** : Cercles, Guildes, Foyers (avec contrôles de confidentialité stricts).
- **Wallet apprenant** : export/import portable des preuves et du parcours.

Toutes les API respectent : authentification, minimisation des données, journalisation des accès, et
consentement explicite (renforcé pour les mineurs).

---

## Fédération

Dowze est **fédéré** : différentes instances (par pays, région, institution) interopèrent via le protocole
commun, comme des serveurs de courriel ou du Fediverse.

- **Souveraineté** : une région peut héberger ses propres données (conformité locale, RGPD…).
- **Résilience** : pas de point unique de défaillance.
- **Anti-capture** : aucun acteur ne contrôle l'ensemble (principe 12).
- **Cohérence** : l'Atlas et le format des preuves restent communs (langage partagé), tout en autorisant
  l'enrichissement local (branches culturelles/linguistiques).

---

## Portabilité : l'apprenant n'est jamais prisonnier

- Les **preuves** sont des VC standard, vérifiables et utilisables hors Dowze.
- Le **parcours et les données** sont exportables (principe 11 : données possédées par l'apprenant).
- Quitter une instance Dowze pour une autre (ou même sortir de Dowze) ne fait perdre ni ses preuves ni son
  identité d'apprenant.

C'est l'**inverse** d'une plateforme propriétaire qui retient ses utilisateurs par enfermement.

---

## Gouvernance des standards

Les spécifications Dowze (schéma d'Atlas, profil de credential, API) sont **ouvertes, versionnées et
gouvernées en commun** (couche 6). Elles s'alignent autant que possible sur les standards externes (W3C,
1EdTech, ESCO) plutôt que d'en créer de nouveaux. Voir
[gouvernance](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md).
