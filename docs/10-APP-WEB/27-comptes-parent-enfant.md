# 27 — Comptes parent/enfant liés (paliers d'âge, invitation, validation)

> Lien parent ↔ enfant demandé à l'inscription, avec **3 paliers d'âge** de sévérité croissante,
> **liaison automatique** du compte parent (à la Revolut/Family Link), et **email réel** envoyé via
> le serveur mail dédié Dowze. Fondé sur la recherche juridique (COPPA/RGPD/DSA/nLPD).

## 1. Paliers d'âge (déduits de la date de naissance)

| Palier | Âge | Email parent | Régime |
|---|---|---|---|
| **Enfant** | `< 13` | **obligatoire** | Le plus strict : compte créé mais **`activation_status = pending_parent`** — l'enfant ne débloque tout qu'après **validation parentale** (double confirmation : email enfant **+** action du parent). |
| **Mineur** | `13–17` | **obligatoire** | L'enfant valide seul (son email) ; le parent est **notifié par email** et peut, s'il le veut, suivre/superviser (auto-lié). |
| **Majeur** | `18+` | **optionnel** (« contact de confiance ») | Un proche peut suivre la progression et recevoir les alertes (harcèlement…) ; jamais d'accès au compte ; retirable à tout moment. |

> Overlay pays possible sur l'axe consentement (FR 15, UK 13, DE/IE/NL 16) — non implémenté en v1,
> seuils `< 13` / `< 18` retenus (voir recherche). Pour `< 13` + fonctions sociales, la recherche
> alerte que le simple email est insuffisant au sens COPPA → **renforcement futur** (carte à montant
> nul / pièce d'identité) ; v1 = validation parentale via compte.

## 2. Mécanisme de liaison (auto, « à la Revolut »)

- À l'inscription, si un email parent est fourni (et **≠ l'email de l'enfant**, anti-abus) :
  - création d'un lien `guardians` (tier, `child_confirmed_at`, `invite_token` usage unique TTL 72 h) ;
  - **si le parent a déjà un compte** avec cet email → **liaison immédiate** (`guardian_account_id`) ;
  - **email réel** au parent (invitation/notification, wording selon le palier).
- **Auto-adoption** : quand un compte s'inscrit, tout lien `guardians` en attente dont l'email
  d'invitation = son email est **automatiquement relié** à lui (le parent récupère ses enfants).
- Les deux sens fonctionnent : parent-déjà-là → enfant, et enfant-d'abord → parent-ensuite.

## 3. Côté parent (Espace responsable)

- **`GET /accounts/me/children`** : liste des enfants liés — affichés **automatiquement** (plus besoin
  du « code élève », qui reste en repli).
- **`POST /accounts/me/confirm-child/:id`** : le parent **valide** le compte d'un enfant `< 13`
  (→ `activation_status = active`).
- Suivi (bulletin, contrôles parentaux, mode supervisé, remise à 0) via l'enfant sélectionné.

## 4. Emails (serveur mail dédié Dowze)

Envoyés par `EmailService` (nodemailer → `dowze-mailserver`, DKIM `dowze.ch`, relais VPS). Voir
memory `dowze-mail-server`. Contenus : invitation parent (par palier), et **alerte harcèlement**
(l'IA de modération envoie l'alerte au parent lié par email en plus du dashboard).

## 5. Données

```
accounts.activation_status        -- 'active' | 'pending_parent' (<13 tant que non validé)
guardians (
  minor_account_id,               -- le compte supervisé (enfant/mineur/adulte lié)
  email,                          -- email du parent / contact de confiance
  guardian_account_id,            -- le compte du parent une fois lié (auto-liaison)
  tier,                           -- enfant | mineur | majeur
  child_confirmed_at, parent_confirmed_at,
  invite_token, invite_expires_at,
  supervised                      -- (doc 26 §7.6) mode validation de chaque message/ami
)
```

Garde-fous : `email_parent ≠ email_enfant`, token usage unique + TTL, activation gelée `< 13`.
Migration `0037_parent_child_linkage.sql`. Vérifié E2E (inscription enfant → auto-lien + email +
pending → validation parentale → actif ; auto-adoption parent-après-enfant).
