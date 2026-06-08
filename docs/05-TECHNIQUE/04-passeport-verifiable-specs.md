# Spécification — le Passeport vérifiable

> *Comment rendre une preuve de compétence **infalsifiable, portable et vérifiable en secondes** — avec
> des standards mûrs, et **sans blockchain**.*

---

## Le socle : W3C Verifiable Credentials + Open Badges 3.0

Dowze bâtit sur deux standards **mûrs** et convergents :

- **W3C Verifiable Credentials Data Model 2.0** — recommandation officielle depuis **mai 2025**. Modèle de
  confiance en triangle : **émetteur** (signe) → **détenteur** (stocke dans son wallet) → **vérifieur**
  (valide la signature **sans recontacter l'émetteur**).
- **Open Badges 3.0** (1EdTech, 2024) — désormais **construit sur les VC du W3C**. C'est la convergence
  entre l'écosystème éducatif et l'écosystème identité.

> **Pourquoi pas la blockchain ?** Parce qu'elle n'est **pas nécessaire** à l'infalsifiabilité : la
> signature cryptographique de l'émetteur suffit. La tendance de fond (y compris 1EdTech) s'en éloigne.
> MIT Blockcerts fut un pionnier, mais la voie « VC signés » l'a dépassé. Dowze l'évite (complexité, coût
> énergétique, fragmentation) — voir [crise du diplôme](../01-DIAGNOSTIC/04-crise-du-diplome.md).

> **Et les DID (identifiants décentralisés) ?** Standard W3C de 2022, mais **fragmenté et contesté**
> (objections formelles de Google, Apple, Mozilla). Dowze **peut s'en passer** au démarrage et adopter une
> approche pragmatique d'identité, en gardant la porte ouverte aux DID si l'écosystème mûrit.

---

## Anatomie d'une preuve (credential)

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2",
               "https://purl.imsglobal.org/spec/ob/v3p0/context.json"],
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "issuer": { "id": "noos:guilde:data", "name": "Guilde Data — Dowze" },
  "validFrom": "2026-05-01T00:00:00Z",
  "credentialSubject": {
    "id": "noos:learner:wallet:...",          // l'apprenant (auto-détenu)
    "achievement": {
      "id": "noos:skill:data-viz-tableau-de-bord",   // nœud d'Atlas
      "name": "Concevoir un tableau de bord de données",
      "criteria": { "narrative": "A livré un tableau de bord exploité..." }
    },
    "evidence": [                              // les preuves multi-source
      {"type": "livrable_reel", "url": "...", "usageReel": true},
      {"type": "revue_pairs", "cercleId": "...", "verdict": "..."},
      {"type": "attestation_guilde", "maitreId": "...", "signature": "..."},
      {"type": "epreuve_observee", "identiteVerifiee": true}    // enjeux élevés
    ]
  },
  "proof": { "type": "DataIntegrityProof", "cryptosuite": "...", "...": "..." }
}
```

Chaque preuve référence un **nœud de l'Atlas** (langage commun) et porte ses **evidences** (les traces
réelles). La signature (`proof`) garantit l'authenticité.

---

## Les cinq niveaux de vérification (rappel)

La confiance vient du **croisement**, calibré selon l'enjeu (voir [couche Preuve](../03-ARCHITECTURE/05-preuve-passeport.md)) :

1. évaluation du Mentor (formatif, faible enjeu) ;
2. revue par les pairs du Cercle ;
3. attestation d'experts / de la Guilde ;
4. **performance réelle** (le travail a servi) ;
5. **épreuve observée + identité vérifiée** (santé, sécurité, droit…).

---

## Ce que la cryptographie résout — et ne résout PAS

| Question | Résolu par… |
|----------|-------------|
| Le credential vient-il bien de l'émetteur annoncé ? | ✅ **signature** (VC) |
| Le credential a-t-il été altéré ? | ✅ **signature** (VC) |
| L'émetteur est-il digne de confiance ? | ⚠️ **réputation** (Guilde, gouvernance) |
| La personne sait-elle *vraiment* faire ? | ⚠️ **preuve de travail réel + multi-source** |
| Est-ce bien *cette* personne qui a fait le travail ? | ⚠️ **identité vérifiée + épreuve observée** (enjeux élevés) |

C'est pourquoi Dowze **ne se repose pas** sur la seule signature : la **validité** vient de la preuve de
travail et du croisement de sources. On évite le **proctoring intrusif** (reconnaissance faciale —
biaisée, attentatoire à la vie privée, base empirique faible) au profit de l'épreuve observée et de la
preuve d'usage réel.

---

## Anti-fraude

- **Signature** : credential infalsifiable, émetteur non usurpable.
- **Identité vérifiée** pour les preuves à fort enjeu.
- **Épreuve observée** en conditions réelles (on ne triche pas une démonstration en direct).
- **Croisement** : un faux ne passe pas les cinq filtres.
- **Révocation** : un émetteur peut révoquer une preuve erronée (liste de statut/révocation standard VC).

---

## Portabilité et propriété par l'apprenant

- Les preuves vivent dans un **wallet contrôlé par l'apprenant** (principe 11), exportable.
- Vérifiables **hors de Dowze** par n'importe quel employeur/interlocuteur, sans permission de Dowze.
- Interopérables via **CLR / LER** (relevés agrégés émergents) pour s'intégrer aux écosystèmes RH.

---

## Statut des briques (rappel honnête)

| Brique | Statut |
|--------|--------|
| W3C VC 2.0 | ✅ Mûr (standard mai 2025) |
| Open Badges 3.0 | ✅ Mûr (2024, sur VC) |
| CLR / LER | 🟡 Émergent (adoption faible hors pilotes) |
| DID | 🟡 Contesté/fragmenté — optionnel |
| Blockchain | 🔴 Évité (non nécessaire) |

Voir [interopérabilité & standards](06-interoperabilite-standards.md).
