# Registre des risques

> *Inventaire structuré. Chaque risque : description, probabilité, gravité, mitigation, statut. Les
> risques majeurs ont leur chapitre dédié.*

Échelle : Probabilité / Gravité = Faible · Moyenne · Élevée.

---

## Risques pédagogiques

| # | Risque | Prob. | Grav. | Mitigation | Statut |
|---|--------|-------|-------|-----------|--------|
| P1 | **Délestage cognitif** : l'IA pense à la place de l'apprenant (−17 %, Bastani) | Élevée | Élevée | Mentor scaffold-and-fade, questionnement, **validation sans IA** | Traité — [détail](02-delestage-cognitif.md) |
| P2 | **Décrochage de masse** (comme les MOOC, ~88 %) | Élevée | Élevée | Couche humaine : Cercles (redevabilité), Guildes, Foyers | Traité — [couche 4](../03-ARCHITECTURE/04-cercles-guildes-foyers.md) |
| P3 | **Autonomie livrée à elle-même** (échec Hole-in-the-Wall) | Moyenne | Élevée | Guidage explicite, scaffolding obligatoire pour novices | Traité — [Quêtes](../03-ARCHITECTURE/03-quetes.md) |
| P4 | **Sur-promesse d'efficacité** (citer le « 2 sigma » comme un fait) | Moyenne | Moyenne | Honnêteté sur les preuves ; RCT indépendants | Traité — [le mythe](../01-DIAGNOSTIC/03-mythe-2-sigma-et-verite-tutorat.md) |
| P5 | **Hallucinations** du LLM (~5-10 % d'énoncés faux) | Élevée | Moyenne | RAG (ancrage + citations), transparence sur l'incertitude | Atténué |
| P6 | **Course à la performance précoce** (pression sur les enfants) | Moyenne | Moyenne | Pas de classement ; ampleur/jeu avant accélération | Traité — [enfance](../04-PARCOURS-DE-VIE/02-enfance.md) |

---

## Risques d'équité

| # | Risque | Prob. | Grav. | Mitigation | Statut |
|---|--------|-------|-------|-----------|--------|
| E1 | **Effet Matthew** : profite d'abord aux favorisés | Élevée | Élevée | Déploiement inversé, ciblage des exclus, accompagnement renforcé | Traité — [équité](../04-PARCOURS-DE-VIE/06-equite-inclusion.md) |
| E2 | **Fracture numérique** : exclut 2,6 Md hors ligne | Élevée | Élevée | Offline-first, Foyers, basse conso, plaidoyer accès | Atténué — [détail](04-equite-biais.md) |
| E3 | **Biais algorithmiques** (groupes défavorisés mal servis) | Moyenne | Élevée | Données représentatives, audits de biais indépendants | Traité — [détail](04-equite-biais.md) |
| E4 | **Biais linguistique** (LLM majoritairement anglophones) | Élevée | Moyenne | Multilinguisme radical, branches locales de l'Atlas | Atténué |
| E5 | **Exclusion par le handicap / l'âge / la littératie** | Moyenne | Moyenne | Accessibilité de conception, mode voix | Traité |

---

## Risques de sûreté & vie privée

| # | Risque | Prob. | Grav. | Mitigation | Statut |
|---|--------|-------|-------|-----------|--------|
| S1 | **Danger pour les mineurs** (chatbots compagnons) | Moyenne | **Très élevée** | Jamais de compagnon ; modération ; détection de détresse | Traité — [détail](03-securite-mineurs.md) |
| S2 | **Atteinte à la vie privée** (données de mineurs) | Moyenne | Élevée | Privacy by design, données possédées, conformité | Traité — [conformité](../06-GOUVERNANCE-ECONOMIE/03-juridique-conformite.md) |
| S3 | **Surveillance de masse** (le système sait tout de tous) | Moyenne | Élevée | Minimisation, fédération, zéro pub, gouvernance commun | Traité |
| S4 | **Addiction / dark patterns** | Moyenne | Élevée | Interdiction structurelle ; métriques de bien-être | Traité — principe 9 |
| S5 | **Désinformation dans l'Atlas** | Moyenne | Élevée | Curation exigeante, provenance, arbitrage | Atténué — [Atlas](../05-TECHNIQUE/02-modele-donnees-atlas.md) |

---

## Risques de gouvernance & économie

| # | Risque | Prob. | Grav. | Mitigation | Statut |
|---|--------|-------|-------|-----------|--------|
| G1 | **Capture** par une entreprise ou un État | Moyenne | **Très élevée** | Commun, fondation non lucrative, fédération, droit de fork | Traité — [gouvernance](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md) |
| G2 | **Dépendance à un fournisseur fragile** (cas LAUSD) | Moyenne | Élevée | Standards ouverts, plusieurs implémentations, continuité | Traité |
| G3 | **Financement non soutenable** | Élevée | Élevée | Réorientation budgets + philanthropie + redevance ; déploiement progressif | Partiellement — pari à valider |
| G4 | **Fraude aux preuves** | Moyenne | Élevée | Signature crypto, multi-source, épreuve observée, identité | Traité — [Passeport](../05-TECHNIQUE/04-passeport-verifiable-specs.md) |
| G5 | **Métriques gonflées** (cas BloomTech, École 42) | Moyenne | Moyenne | Résultats auditables et conservateurs ; RCT | Traité — [métriques](../08-MISE-EN-OEUVRE/03-metriques-evaluation.md) |

---

## Risques du projet (mise en œuvre)

| # | Risque | Prob. | Grav. | Mitigation | Statut |
|---|--------|-------|-------|-----------|--------|
| M1 | **Rejet par le corps enseignant** (peur du remplacement) | Élevée | Élevée | Transformation (pas suppression) du rôle ; co-conception | Traité — [risques projet](../08-MISE-EN-OEUVRE/04-risques-projet.md) |
| M2 | **Résistance institutionnelle / politique** | Élevée | Élevée | Déploiement progressif, preuves par pilote, alliances | Partiellement |
| M3 | **Non-reconnaissance du Passeport** par le marché | Moyenne | Élevée | Co-construction avec employeurs ; reconnaissance légale (phase 3) | Pari à valider |
| M4 | **Effet de mode / sous-estimation de la complexité** | Moyenne | Moyenne | Humilité, RCT, pas de big bang | Traité |

---

## Risques liés à l'IA interne (le Copilote) — RÉVISION 2026

Depuis que l'app exploite une IA interne (voir [L'IA de Dowze](../10-APP-WEB/23-ia-de-dowze-le-moteur.md)),
de nouveaux risques réels apparaissent — l'ancien argument « rien ne transite / pas de fournisseur » est
caduc.

| # | Risque | Prob. | Grav. | Mitigation | Statut |
|---|--------|-------|-------|-----------|--------|
| IA1 | **Transit de données de mineurs hors UE** (résumés, présentation → fournisseur LLM ; DeepSeek en Chine) | Élevée | Élevée | Forcer endpoints **UE** (Mistral, Azure/Bedrock UE), minimiser le contexte, **non-entraînement + zéro-rétention** contractualisés, registre des sous-traitants | **À traiter** |
| IA2 | **Dépendance à l'IA (point de défaillance unique)** : plus d'IA → app inerte | Moyenne | Élevée | **Gateway** multi-fournisseurs avec **repli automatique + circuit-breaker**, cache de secours, dégradation gracieuse | **À traiter** |
| IA3 | **Hallucination / dévaluation** : le LLM invente ou sur-simplifie le contenu | Élevée | Moyenne | **Ancrage** sur le graphe, sorties structurées, **scoring de fidélité + rubrique + revue humaine** (le prompt « sois rigoureux » est prouvé insuffisant) | Partiellement traité |
| IA4 | **Dérive des coûts** (crédits, fallback vers modèle premium) | Moyenne | Moyenne | Suivi coût/requête, budgets, alertes P95 | À suivre |
| IA5 | **EU AI Act** (éducation = haut risque probable) : logging, supervision humaine | Moyenne | Élevée | Journalisation, human-in-the-loop, préparation conformité (applicable 08/2026) | À anticiper |

---

## Les trois risques les plus graves (à surveiller en priorité)

1. **S1 — Danger pour les mineurs** (gravité très élevée) → [chapitre dédié](03-securite-mineurs.md).
2. **G1 — Capture** (gravité très élevée) → [gouvernance](../06-GOUVERNANCE-ECONOMIE/01-gouvernance-commun.md).
3. **P1 + E1 — Délestage cognitif & effet Matthew** (les deux risques qui pourraient faire de Dowze le
   contraire de sa promesse) → [délestage](02-delestage-cognitif.md), [équité](04-equite-biais.md).

> **Statut « pari à valider »** : certains risques (G3 financement, M3 reconnaissance) reposent sur des
> hypothèses qui ne peuvent être prouvées qu'en déployant. C'est pourquoi le déploiement est **progressif
> et mesuré** ([feuille de route](../08-MISE-EN-OEUVRE/01-feuille-de-route.md)) — pas un acte de foi.
