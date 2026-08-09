# 26 — Social, Classes assignées, Traduction temps réel & Modération

> Système « ÉCHANGER » de Dowze : amis, messages privés, groupes, **Ma Classe** (classes
> assignées chaque année), traduction temps réel par l'IA de Dowze, et modération stricte
> mais non-punitive. Ce document est le cahier des charges **corrigé par la recherche**
> (pédagogie, ingénierie temps réel, droit UE/CH/UK/US, Trust & Safety).
>
> **Deux exigences initiales ont été redessinées pour rester légales** (voir §7.0). Le reste
> du cahier des charges est conservé, souvent renforcé.

---

## 0. Philosophie

- **Le social sert l'apprentissage**, pas l'inverse (42/Epitech : on apprend en expliquant aux
  autres et en écoutant les autres expliquer).
- **« Ce n'est pas parce qu'une poignée d'abrutis existe que tout le monde doit être puni »** —
  principe directeur de la modération. On protège sans sur-restreindre par l'âge.
- **Ce qui fait apprendre en groupe, c'est la cohésion, pas l'homogénéité de niveau** (Hattie :
  cohésion de classe d = 0,44 ; tri par niveau d = 0,12). Le niveau et la langue servent à créer
  un groupe *où l'on se comprend et où l'on reste ensemble* — c'est l'appartenance qui produit le
  résultat, pas le tri.

---

## 1. Système d'amis

> **✅ Ajout d'ami — 3 méthodes (implémenté, inspiré Discord/WhatsApp/Meta)** : (1) **par pseudo**
> `Nom#tag` (discriminateur `profiles.tag`, recherche exacte `Nom#1234` ou nom partiel) ; (2) **lien
> d'invitation** personnel `/amis?add=<profileId>` (ouverture = demande auto) ; (3) **QR code** du
> lien. La liste des amis permet **Message / Retirer / Bloquer / Signaler**. (La « Remise à 0 » a été
> **déplacée dans les paramètres du compte** `/profil`, ce n'est pas une action d'amitié.)

### 1.1 Modèle de données (symétrique, ordre canonique)

Une **seule ligne par paire**, pour éviter doublons et incohérences :

```
friendships(
  user_low     uuid,   -- min(a,b)
  user_high    uuid,   -- max(a,b)
  requested_by uuid,   -- qui a initié
  status       text,   -- 'pending' | 'accepted' | 'blocked'
  created_at   timestamptz,
  PRIMARY KEY (user_low, user_high)
)
```

### 1.2 Flux

- **Demande** : A → `insert(requested_by=A, status='pending')`. Notification à B. B accepte
  (`accepted`) / refuse / bloque (`blocked`).
- **Garde-fou mineur (obligation légale, voir §6)** : un adulte ne peut PAS envoyer de demande
  ni de MP non sollicité à un mineur **hors de sa classe**. Les demandes d'inconnus à un mineur
  sont filtrées dans une boîte séparée (modèle Discord/Instagram/Snapchat).
- **Compte mineur = privé par défaut**, réglages restrictifs verrouillés tant que l'âge adulte
  n'est pas prouvé ou le consentement parental donné.

---

## 2. Messagerie (individuelle, groupes d'amis, canaux de classe)

> **✅ Terminologie « Messages individuels » (PAS « privés/MP »)** : le contenu n'est **pas chiffré**
> et reste **exploitable par la modération** (ex. harcèlement) — Dowze est une **école, pas un réseau
> social** ; les échanges intimes/trop personnels n'y ont pas leur place. **UX (implémentée, style
> WhatsApp/Meta, épurée)** : liste des conversations → bulles, barre en bas, **bouton d'envoi = icône
> seule** (pas de texte). **Actions utilisateur via menu clic-droit** sur un message (Traduire /
> Message individuel / Signaler / Bloquer / Retirer l'ami) — pas d'en-tête surchargé, droit au but.

### 2.1 Modèle unifié

Un seul type `conversation` couvre MP / groupe / canal de classe (`type ENUM`). Pointeur de
lecture léger `last_read_message_id` par participant (pas de table `message_reads` en v1).

```
conversations(
  id uuid, type text,           -- 'direct' | 'group' | 'class_channel'
  class_id uuid null,           -- si canal de classe
  name text null,               -- null pour MP
  last_message_at timestamptz,  -- dénormalisé (tri inbox)
  created_at timestamptz
)
conversation_participants(
  conversation_id uuid, user_id uuid,
  role text,                    -- 'member' | 'admin'
  last_read_message_id uuid,    -- pointeur de lecture
  joined_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
)
messages(
  id uuid,                      -- ordonné par séquence, PAS par timestamp (dérive d'horloge)
  conversation_id uuid, sender_id uuid,
  content_ciphertext text,      -- chiffré par clé par-message (crypto-shredding, voir §7.0)
  content_key_id uuid,          -- → clé destructible
  type text,                    -- 'text' | 'image' | 'file'
  status text,                  -- 'active' | 'crypto_shredded' | 'anonymized'
  audit_hash text,              -- hash horodaté non identifiant (immuable)
  sent_at timestamptz,
  edited_at timestamptz null    -- soft-edit conservant l'historique (voir §7.0)
)
```

### 2.2 Temps réel

- **WebSocket** (HTTP ne peut pas push). Reconnexion mobile avec backoff + resync des messages
  manqués. **v1 acceptable en polling** si le WS n'est pas prêt (classes ≤ 25).
- **Fan-out on write** (copie chez chaque destinataire) suffit pour MP + classes ≤ 25.
- **Présence : heartbeat + TTL Redis** — clé Redis TTL 60 s rafraîchie par heartbeat 30 s ;
  expiration = hors ligne (aucun job de nettoyage). « en train d'écrire » TTL 5 s.
- Ordonnancement par **séquence par canal** (Snowflake-like), pas par timestamp.

### 2.3 Modèle mental (best of WhatsApp/Discord/Slack)

- **MP entre amis** = WhatsApp (conversation directe).
- **Groupe d'amis** = conversation `group` à N participants.
- **Ma Classe** = conteneur type Discord (un `class_id`) avec 1–N canaux (`#général`, `#entraide`,
  éventuels canaux de sous-groupes de 3–6 pour le travail collaboratif).

---

## 3. « Ma Classe » — classes assignées

> **✅ Attribution AUTOMATIQUE & CONTINUE (implémenté)** : chaque élève reçoit une classe **dès qu'il
> en a besoin**, même **seul** (pas de minimum). `ClassesService.myClass` auto-attribue à la première
> ouverture : il place l'élève dans une classe de son **(année × niveau × langue)** avec de la place
> (`MAX_SIZE = 25` slots), **sinon en crée une**. On peut donc **rejoindre en cours d'année** tant
> qu'il reste de la place, comme une vraie école. Classe **par année scolaire** (`school_year`). Le
> batch `POST /classes/assign` (algorithme §3.2) reste disponible pour une **ré-organisation** modo.
> L'algorithme de cohortes ci-dessous décrit la logique idéale (cascade) ; l'attribution continue en
> est la version « au fil de l'eau ».

### 3.1 Règles (validées par la recherche)

- Les classes **ne se choisissent pas, elles sont assignées** chaque année (le « cohort-based
  learning » tire son efficacité de la stabilité d'un groupe imposé).
- **Priorité lexicographique : niveau (dur) > langue (quasi-dur) > âge (souple)**.
  - **Niveau** = contrainte dure, jamais violée (mélanger deux niveaux casse la pertinence du
    contenu). Sert de *filtre de contenu*, pas de promesse de performance (pas de sous-castes
    forts/faibles).
  - **Langue maternelle** = quasi-dure, remontée quasi à égalité avec le niveau (levier de
    cohésion/appartenance). Violée seulement en dernier recours → déclenche la traduction (§4).
  - **Âge** = souple. **L'âge n'exclut JAMAIS** (un adulte de 25 ans niveau lycée peut être avec
    des mineurs — pédagogiquement sain ; seul enjeu = sécurité, voir §6).
- **Taille : cible ~20, min 12, max 25.** Sous-groupes de travail 3–6.
- **Réévaluation annuelle + à mi-année** (anti-pattern documenté : ne jamais réévaluer le niveau).

### 3.2 Algorithme (buckets + remplissage glouton, sans solveur)

Pas besoin d'ILP/OR-Tools en v1. Cascade déterministe et explicable :

```
bucket = (niveau × langue)                          # critères durs
pour chaque bucket:
  pour chaque tranche d'âge:
    si ≥ 12 d'une même tranche → classes mono-âge
    sinon → reste
  reste d'un même (niveau×langue), âges mélangés, trié par âge → classes âge-contiguës
fusion multilingue (même niveau, langues ≠) → classe "MULTILINGUE" + traduction activée
dernier recours: multi-niveau adjacent (N±1) plutôt que laisser quelqu'un seul
# equilibrage: 62 → [21,21,20], jamais < min ni > max
```

- **Cascade de fallback** : mono-âge → même-langue tous âges → multilingue+traduction →
  multi-niveau adjacent. **Personne n'est jamais laissé isolé.**
- **Human-in-the-loop** : l'algo propose, un admin valide/ajuste (cas réel : répartition scolaire
  d'Uster/CH).
- Migration : `class_membership(user_id, class_id, school_year, assigned_at, assignment_reason)` —
  historisé pour analyser rétention/mobilité. `assignment_reason ∈ {mono-age, same-lang,
  multilingual, multi-level, manual}`.

---

## 4. Traduction temps réel par l'IA de Dowze

### 4.1 Principe

- Bouton **Traduire** par message. Ne traduire que ce qu'on ne comprend pas (langues connues +
  exclusion, modèle Telegram). Détection **par message** (pas par conversation). Pas d'auto-trad
  sous ~10 caractères.
- Toujours garder l'original accessible + étiquette « traduit automatiquement ».
- Protéger mentions/pseudos/code/URLs/emojis par masquage-placeholder avant traduction.

### 4.2 Cache communautaire (effet réseau)

- Clé `sha256(source + langue_cible + modèle:version [+ glossaire])`. La version du modèle dans la
  clé rend l'invalidation gratuite. Store **Redis, portée globale par paire de langues**.
- **Le premier paie, les autres réutilisent** : une personne traduit dans sa langue → tout le
  groupe en bénéficie, crédits dépensés une seule fois. Hit rate réel 70–90 %. (Précédent : TM
  partagée de MediaWiki Translate. Le modèle auto-généré évite le piège spam de YouTube Community
  Captions.)

### 4.3 Modèle LowCost

- **Défaut : Gemini 2.5 Flash-Lite ou Mistral Small** (~$0.10 in / $0.30–0.40 out par 1M tokens).
- Claude Haiku 4.5 ($1/$5) ~10× plus cher → à réserver, pas défaut.
- **⚠ Éviter** GPT-4o-mini/4.1-nano (legacy, coupure ~oct. 2026), DeepSeek V3 (déprécié 24/07/26 →
  V4-flash), NLLB (licence non commerciale). Gros volume/paires européennes qualité max : DeepL,
  ou Opus-MT self-hosted (Apache 2.0).

### 4.4 Estimation de coût

`coût = T_in/1e6·P_in + T_out/1e6·P_out`, avec `T_in ≈ (C/4)·f_src`, `T_out ≈ (C/4)·E·f_tgt`.
**Point clé : « caractères ÷ 4 » n'est vrai qu'en anglais ; le français consomme ~1,47× plus de
tokens.** Estimer avant (tiktoken local), réconcilier avec l'`usage` réel après (calibration
glissante). **tokens = fait / prix = estimation** → toujours « ≈ » + fourchette.

### 4.5 Auto-traduction (bandeau rouge)

- Activable **1 h**. Bandeau rouge en haut avec **timer proéminent** + compteur de tokens +
  **estimation de prix discrète** (entre parenthèses, « ≈ »).
- **Cadrer l'auto-coupure comme une protection, pas une perte** : « se désactive pour éviter des
  coûts non voulus ». La recherche « pain of paying » confirme qu'un compteur de coût visible
  *réduit réellement* la consommation (puissant mais anxiogène → hiérarchiser).

### 4.6 Config « Mon Copilote »

- Défaut : **2ᵉ IA LowCost séparée** pour la traduction. + case « utiliser aussi l'IA principale
  pour le LowCost » **avec avertissement explicite du surcoût** (ne pas masquer, proposer
  l'alternative moins chère).

---

## 5. Faire valider un sujet — les 4 voies (rappel, §validation)

Complète le doc `09-validation.md`. Une prestation orale peut être évaluée via :

1. **Lien de partage** — dans « Mes sujets », bouton *Partager* copie
   `…/validation/sujet/{id}`. À mettre en description d'une vidéo YouTube/TikTok/Twitch ou à
   envoyer. Le lien redirige vers le sujet mais **exige un compte au niveau requis**. ✅ *fait*
2. **Page communauté** — `/validation/communaute`, barre de recherche (tous les sujets à évaluer)
   + tri par niveau de l'auteur / matière / récence. Choisir une éval = continuer à apprendre en
   écoutant (42/Epitech). ✅ *fait*
3. **Envoi in-app** — à un ami ou au groupe « Ma Classe ». ⏳ *dépend de la messagerie (§2)*
4. **Prof agréé** — l'enseignant demande le statut via formulaire (parcours, où il enseigne),
   **vérification humaine manuelle** ; un prof agréé valide un sujet **en une fois** (une seule
   validation suffit). ✅ *fait (accréditation), badge = « identité et diplôme vérifiés » (voir §8)*

---

## 6. Sécurité des mineurs (obligations légales, pas optionnel)

Dowze mêle adultes et mineurs dans une même classe → garde-fous **obligatoires** :

- **UE — RGPD art. 8** : âge de consentement 13–16 selon pays (FR **15 ans** ; DE/NL 16 ; BE/IE/UK
  13). En dessous → **consentement parental**.
- **UE — DSA art. 28** : haut niveau de vie privée/sûreté pour mineurs, **publicité par profilage
  interdite** ; comptes mineurs **privés par défaut**, fonctions « addictives » (streaks, read
  receipts, autoplay) **off par défaut**, suggestions de contacts limitées au réseau/tranche d'âge.
- **UK — Online Safety Act + Children's Code** : « high privacy » par défaut, age assurance
  proportionnée au risque, profilage off par défaut.
- **US — COPPA (<13 ans)** : consentement parental vérifiable, consentement séparé avant partage
  tiers, interdiction de rétention indéfinie.
- **CH (opérateur) — nLPD** : droit à l'effacement (art. 32), secret des correspondances (art. 13
  Cst. / art. 179 CP).

**Être strict SANS sur-restreindre par l'âge** (la clé du « ne pas punir tout le monde ») :
- **Séparer sécurité et âge** : filtres de mots, anti-raid, détection grooming, blocage/mute,
  signalement protègent *tout le monde* sans connaître l'âge → prioriser ces mesures.
- **Age assurance proportionnée** : vérification dure réservée aux surfaces à haut risque (chat
  cross-âge) ; estimation non-intrusive ailleurs. Modèle Discord « teen-by-default » : la majorité
  continue sans jamais prouver son âge.
- **Tranches d'âge** (un ado de 15 ans ≠ un enfant de 8 ans) pour ne pas punir tout le monde.

---

## 7. Modération stricte mais non-punitive

### 7.0 Décision produit sur l'immuabilité et le flag

**Statut du produit : Alpha / Beta / Early access ouverte.** Dowze construit quelque chose de
**nouveau et révolutionnaire** ; beaucoup sera inventé et ajusté au fil du temps, surtout à mesure
que l'IA progresse. Les exigences ci-dessous ne sont pas illégales dans tous les pays, et
l'approche est assumée comme évolutive.

**Étoile polaire (pas maintenant)** : une **IA de modération ultra-performante modérant 100 % des
échanges sans humain, en boîte noire fermée**. La technologie n'est pas encore mûre → à construire
de A à Z plus tard (des semaines/mois), pas la priorité actuelle. En attendant, la modération reste
**human-in-the-loop**.

**Immuabilité — position retenue** : les messages restent **immuables** (ni édition ni suppression
individuelle) pour préserver les preuves en cas de harcèlement. Le **droit à l'effacement** est
assuré autrement, par la **Remise à 0** (§7.6.A) : elle efface *tout* (messages + amis), jamais un
message isolé, et passe par une **validation modérateur** pour empêcher qu'on efface volontairement
des preuves. Tout ceci est **écrit clairement dans les CGU/règles** : comment ça marche, pourquoi.

**Flag** : reste **interne** (élève la priorité de la revue humaine) ; pas d'exposition publique de
contenu privé (voir §7.1). À réévaluer avec l'IA de modération future.

### 7.1 Ce qui est conservé tel quel

- **Blocage bidirectionnel en MP** : masquage total mutuel (profil/pseudo/messages invisibles des
  deux côtés), sans notifier le bloqué ; le bloqué peut toujours parler aux autres. **En
  classe/groupe partagé**, le bidirectionnel total exclurait un membre → **asymétrique**
  (block-within-group : le bloqueur ne voit plus le bloqué) + escalade modo possible.
- **Signalement d'un utilisateur** (avec message). Le seuil (3/5/10) **remonte la priorité** dans
  la file de modération ; il ne **déclenche jamais** une sanction ni un label public
  automatiquement.
- **Espace modo dédié** : le modérateur voit les signalements (nom signalé, nom signaleur, message
  du signalement).
- **Supervision parentale** : le parent voit les messages de l'enfant + gros avertissement si
  l'enfant parle à un utilisateur signalé + peut bloquer/signaler depuis le compte de l'enfant.
- **IA de modération** (système séparé, API/token dédié) : bot type modo-Discord mais dopé à l'IA,
  détecte harcèlement/insultes/comportements déplacés, peut signaler/suspecter mais **ne bannit
  JAMAIS** ; suspicions → section modo dédiée avec la raison ; peut emailer + MP les parents avec
  la raison.

### 7.2 Ce qui est ajusté (proportionnalité)

- **Accès modo à « TOUT l'historique »** → **fenêtre contextuelle** (N messages avant/après le
  message signalé), déclenchée par le signalement, **moindre privilège + just-in-time +
  justification obligatoire loggée + audit trail** (qui/quand/pourquoi/quoi). Aucune plateforme
  (Discord, WhatsApp, Twitch, Slack) ne donne accès à tout en continu.
- **Supervision parentale** → proportionnée : **transparence à l'enfant** qu'il est supervisé ;
  **pas d'outing** (ne pas divulguer au parent le contexte sensible : orientation, santé) ;
  atténuation possible pour les ados plus âgés (le Children's Code protège aussi la vie privée de
  l'enfant vis-à-vis du parent).
- **Alertes IA au parent** → **jamais automatiques sur la seule sortie IA** : validation humaine
  préalable obligatoire (RGPD art. 22, arrêt CJUE SCHUFA : un humain « tampon » ne suffit pas).
  Réservées aux catégories **haut risque confirmées** (menace crédible, grooming confirmé, danger
  imminent d'auto-mutilation), pas à la « toxicité » ordinaire. Séparer les canaux : MP pédagogique
  à l'enfant (proportionné) ≠ email parent (danger réel confirmé).

### 7.3 IA de modération — design

- Rôle : **détecter + prioriser + rédiger la raison → jamais sanctionner seule.** Chaque signal IA
  ouvre un ticket revu par un humain formé.
- Outils : OpenAI Moderation (gratuite, 13 catégories dont `sexual/minors`) et/ou Perspective
  (confiance 0–1) comme **signaux, pas décisions**. **Biais documentés** (Perspective surpénalise
  l'anglais afro-américain et la simple mention d'une identité minoritaire → faux positifs contre
  ados minoritaires/LGBTQ+) → audit régulier des biais.
- **Grooming = indétectable message-par-message** (processus graduel) → outils dédiés signalent
  vers analystes humains, jamais ban auto ; escalade légale (NCMEC/CyberTipline).
- **Human-in-the-loop = obligation** (RGPD art. 22, DSA art. 17 : dire si l'automatisation a été
  utilisée + recours).

### 7.4 Anti-brigading (crucial avec des mineurs)

Pondérer les signalements par **réputation/précision historique du signaleur** (modèle Trusted
Flagger : priorité oui, auto-sanction non) ; **détection de coordination** (pics, IP/géo, comptes
récents) ; **rate-limiting** (plafond N signalements/compte/jour) ; **pénalités pour faux
signalements répétés**.

### 7.5 Structures de données (modération)

```
report(id, reporter_id, reported_user_id, message_ref, reason_text, category, severity,
       status, priority_score, reporter_trust_weight, coordination_flag)
ai_flag(id, message_ref, model, category, confidence, reason_text, tier low|high,
        status pending_human_review, resolved_by, resolution)   -- jamais d'action auto
block(a_id, b_id, scope dm|group, direction, silent bool, created_at)
internal_reputation_flag(user_id, aggregate_reports, priority_boost, human_reviewed bool)  -- PAS public
parental_supervision(child_id, parent_id, consent_ref, scope,
       alert_policy 'human_validated_only', redact_sensitive_context true)   -- anti-outing
moderator_access(moderator_id, report_id, scope 'context_window(N)', granted_at, expires_at,
       justification, revoked_at)   -- just-in-time, journalisé
audit_log(event_id, actor_role, action, target_ref hash, timestamp, justification_id)  -- immuable, non identifiant
```

### 7.6 Deux protections supplémentaires (Alpha) — décidées par le fondateur

#### A. Remise à 0 (messages + amis)

- **Ce que c'est** : effacer **TOUS** les messages **et** tous les amis d'un élève, remis à zéro,
  **sans exception**. Le **compte reste intact** (profil, progression, rangs conservés).
- **Qui peut la demander & le flux de validation** :
  - **Élève SOUS accord parental** : ne peut **pas** demander seul. Sa demande part **d'abord au
    parent** pour approbation (`pending_parent`), **puis** au modérateur (`pending_moderator`).
  - **Élève sans accord parental** (autonome) : demande directement au **modérateur**.
  - **Parent** (depuis l'Espace responsable) : demande directement au **modérateur**.
- **Validation modérateur obligatoire dans tous les cas** avant exécution. **Raison** : empêcher
  qu'on efface volontairement des messages qui pourraient être des **preuves** (harcèlement…).
  C'est aussi le mécanisme de **droit à l'effacement** de Dowze (on n'efface pas un message isolé,
  on remet tout à 0). Porte aussi sur la **suppression de compte** (même flux).
- **Écrit dans les CGU/règles** : fonctionnement, pourquoi la validation modérateur, ce qui est
  effacé vs conservé — clairement, pour tous.
- Données : `reset_requests(id, profile_id, requested_by 'self'|'parent', requester_ref, status
  'pending'|'approved'|'rejected', moderator_id, created_at, resolved_at)`. À l'approbation :
  suppression de `chat_messages` de l'élève + `friendships` + `conversation_participants` +
  conversations directes orphelines.

#### B. Mode supervisé (blocage total et supervisé)

- **Ce que c'est** : **chaque** message et **chaque** demande d'ami — en privé, en groupe, en
  classe, entrant **et** sortant — passe **d'abord par le parent**, qui doit **VALIDER** avant que
  l'enfant puisse le lire, et avant que le message/la demande de l'enfant ne parte.
- **Activation** : **désactivé par défaut**. Le parent l'active **très facilement en cochant une
  case** dans la gestion de l'accord parental (Espace responsable). **UX ultra-simple**,
  compréhensible par n'importe qui sans compétence technique.
- **Pourquoi** : mesure radicale mais **rassurante** pour certains parents et **protectrice** pour
  des enfants plus sensibles (ex. passé de harcèlement).
- **Comportement** :
  - *Sortant* (l'enfant écrit / demande en ami) → **retenu** (`hold_state='held_out'`), invisible
    des destinataires, marqué « en attente de validation » pour l'enfant, jusqu'à approbation.
  - *Entrant* (on écrit à l'enfant / on le demande en ami) → **caché à l'enfant** jusqu'à
    approbation du parent (les autres voient le message normalement ; gate par-enfant).
  - **File de validation** dans l'Espace responsable : contenu + expéditeur/destinataire →
    **Approuver / Refuser**.
- Données : `guardians.supervised boolean`, `supervision_items(id, child_profile_id,
  child_account_id, direction 'in'|'out', kind 'message'|'friend_request', message_id,
  friend_target_id, status 'pending'|'approved'|'rejected', created_at, resolved_at)` ;
  `chat_messages.hold_state 'clear'|'held_out'`.

---

## 8. Rôles staff (prof, modérateur…) — attribution MANUELLE uniquement

> **Décision produit (état actuel)** : l'application **ne propose aucun moyen de devenir prof,
> modérateur ou staff**. Les rôles **existent** (`accounts.role`, `accounts.is_teacher`) et
> **fonctionnent** quand ils sont accordés, mais ils sont attribués **manuellement, au cas par cas**
> (par un humain, en base). **Personne** ne peut demander un rôle staff via l'app.
>
> - ✅ *Supprimé* : le formulaire « Demander l'accréditation » (prof agréé), la fonction
>   `applyTeacher` (web), l'endpoint `POST /validation/:id/teacher-apply` et la méthode service.
> - Aucun endpoint ne mute un rôle ; l'inscription force `role='eleve'`. Les seules références à
>   `role='moderateur'` / `is_teacher` sont des **lectures** (contrôle d'accès).
> - Attribution manuelle (exemples) :
>   `update accounts set role='moderateur' where id='…';`
>   `update accounts set is_teacher=true where id='…';`
> - Le badge/capacité restent : un prof accordé manuellement valide un sujet en une fois ; un
>   modérateur accède à `/moderation`.
>
> La table `teacher_applications` reste en base (héritée) mais n'est plus alimentée. La chaîne
> d'accréditation ci-dessous est **conservée comme cible future**, à réactiver seulement quand le
> processus (IDV, casier, revue) sera prêt et décidé.

### Chaîne d'accréditation cible (différée — non exposée dans l'app)

Chaîne recommandée (modèle Outschool, du plus léger au plus fort) :

1. **Formulaire** : identité, matières, motivation (implémenté : parcours + où il enseigne).
2. **IDV** : pièce officielle prise **en direct** + biométrie (type Persona), pas un simple upload.
3. **Vérification du diplôme à la source** : CH → **registre CDIP** des diplômes HEP reconnus ;
   UK → service TRA « Check a Teacher's Record » (QTS) ; sinon université directement.
4. **Background check** : CH → **extrait spécial du casier** (dédié protection des mineurs). **Ne
   stocker que le résultat binaire** (apte/non apte) + date + prestataire, jamais le contenu (donnée
   pénale sensible, RGPD art. 10 / nLPD art. 5c).
5. **Revue humaine finale** (T&S) + onboarding sécurité.
6. **Renouvellement annuel.**

**Vocabulaire** : « agréé » suggère un agrément étatique ; sans reconnaissance d'une autorité,
préférer le badge **« identité et diplôme vérifiés par la plateforme le JJ/MM »** (éviter la
sur-promesse juridique). Dire précisément ce qui est vérifié et quand ; ne pas promettre la
sécurité absolue.

```
teacher_accreditation(teacher_id, idv_provider, idv_date, diploma_source CDIP|TRA|univ,
   diploma_verified_date, background_check_result pass|fail, bg_check_date, bg_provider,
   reviewer_id, next_renewal_date, badge_label)
```

---

## 9. Plan de construction (phasé)

Chantier volumineux → livré et testé **phase par phase**, chacune déployable indépendamment.

- **✅ Fait** : validation — lien de partage, page communauté (recherche/tri), accréditation prof
  (formulaire + validation en une fois). Migration 0031 appliquée.
- **✅ Phase A — Amis + Messagerie** (fait, live, migration 0032) : `friendships`,
  `conversations`, `conversation_participants`, `chat_messages` ; endpoints `/social/*` ; UI
  `/amis` `/messages` `/messages/[id]` (recherche par pseudo, accept/refus, MP, groupes, inbox,
  polling 5 s) ; **option 3 de validation** (envoi in-app d'un sujet en lien cliquable). Messages
  immuables. *Reste : temps réel WebSocket, garde-fous mineurs (Phase D), présence Redis.*
- **✅ Phase B — Ma Classe** (fait, live, migration 0034) : algorithme d'assignation `assign.ts`
  (cascade niveau>langue>âge, mono-âge → même-langue → multilingue → multi-niveau ; tailles 12-25 ;
  l'âge n'exclut jamais ; 7 tests unitaires verts) ; `POST /classes/assign` (modérateur, idempotent) ;
  persistance dans `classes`/`memberships` (étendues) ; **canal de classe = conversation Phase A**
  (type `class_channel`) → block/signalement/supervision inclus ; page `/communaute` « Ma classe »
  (classe + membres + Ouvrir le canal) ; bouton d'assignation dans `/moderation`. Vérifié E2E sur 46
  apprenants → 4 classes (les 4 branches de la cascade).
- **✅ Phase C — Traduction temps réel** (fait, live, migration 0035) : `POST /translate/:profileId`
  → `TranslationService` (cache **communautaire Redis** clé `tr:v1:{langue}:{sha256(source)}`, TTL
  30 j : le premier paie, les autres réutilisent gratuitement) + `CopiloteService.translate` (modèle
  **LowCost** via l'orchestrateur, BYOK/crédits, usage réel + coût estimé). UI : bouton **Traduire**
  par message (label « traduit automatiquement ») + **auto-traduction 1 h** avec **bandeau rouge**
  (timer + tokens réels + prix estimé + auto-coupure « protection »). **Mon Copilote** : carte
  « Traduction (LowCost) » = choisir un modèle dédié ou réutiliser l'IA principale (avertissement de
  surcoût). Vérifié E2E (allemand→français réel via DeepSeek, puis cache `cached:true` 0 token).
- **✅ Phase D « Protections »** (fait, live, migration 0033) : **blocage** bidirectionnel MP
  (masquage recherche/MP/envoi), **signalement** d'un utilisateur (avec message), **espace
  modérateur** `/moderation` (accès contextuel = fenêtre de la conversation, décision humaine ;
  rôle `accounts.role='moderateur'`), **Remise à 0** (élève sous accord parental → parent → modo ;
  élève autonome/parent → modo ; exécution = wipe messages+amis, compte intact), **mode supervisé**
  (case parent, chaque message/ami entrant+sortant validé, file dans l'Espace responsable). Vérifié E2E.
- **✅ Phase D+** (fait, live, migration 0036) : **IA de modération** — `classify.ts` (règle-based
  FR/EN/DE : insulte/menace/harcèlement/inapproprié, 6 tests) branché sur l'envoi de message ; à
  détection, **alerte IMMÉDIATE et simultanée au parent (`parental_alerts`) ET à la modération
  (`ai_moderation_flags`)** — l'IA suspecte/signale, **ne bannit jamais**. Surfacé dans `/moderation`
  (« Signalements de l'IA ») et `/parent` (« Alertes de sécurité »). **Blocage asymétrique en
  classe/groupe** (je ne vois plus les messages des gens que j'ai bloqués ; l'inverse reste).
  **Anti-brigading** (plafond 20 signalements/24 h + dédoublonnage cible ouverte). Vérifié E2E
  (insulte → flag modo + alerte parent immédiate).
  - **✅ LLM dédié** (fait, live) : la modération utilise désormais un **LLM dédié**
    (`moderation-llm.ts`, sortie structurée Zod {flagged, category, severity, reason}) piloté par
    l'env `MODERATION_PROVIDER/MODEL/API_KEY` (token propre géré par Dowze). Le classifieur
    règle-based reste en **repli automatique** si la clé est absente ou en cas d'échec LLM (jamais de
    trou de modération). Vérifié E2E : un **harcèlement subtil sans mot-clé** (« tu fais honte…
    personne ne veut de toi ») est détecté par le LLM (`harcelement/grave`, raison contextuelle) là
    où les règles échouaient, et un message anodin n'est **pas** signalé (pas de faux positif). Prod
    configuré avec le modèle DeepSeek (clé de l'utilisateur, révocable).
- **✅ Temps réel** (fait, live) : transport **SSE** (`@Sse GET /realtime/:profileId/stream?token=`,
  natif NestJS — passe le reverse proxy sans upgrade WebSocket) + **Redis pub/sub** (canal
  `user:{id}`) pour le fan-out multi-instance ; **présence** heartbeat + TTL 60 s (`presence:{id}`) →
  « en ligne » ; **typing** (`POST …/typing` → événement SSE « X écrit… », TTL client 4 s). UI
  `/messages/[id]` : livraison **instantanée** des messages (le polling n'est plus qu'un filet de
  sécurité à 30 s), pastille de présence, indicateur de saisie. Vérifié E2E (message poussé
  instantanément à l'écran, présence, typing). *Note : SSE couvre le besoin (push serveur→client) ;
  migration vers WebSocket possible si un jour on veut du bidirectionnel à très basse latence.*

### Zones de risque juridique — à valider par un juriste avant prod
1. Immuabilité (crypto-shredding non formellement validé comme effacement par un régulateur).
2. Ne jamais exposer publiquement de contenu privé (abandon du flag public).
3. Accès modo restreint au contexte (minimisation).
4. Alertes IA au parent : validation humaine obligatoire (anti-outing, faux positifs).
5. Casier prof : ne stocker que le résultat binaire.
6. Seuils d'âge par pays + statut nLPD du crypto-shredding : confirmation juriste CH.

---

## Sources

Pédagogie/cohortes : Steenbergen-Hu 2016, Hattie, McClellan & Kinsey 1999, Duru-Bellat/SNES, SDT
(Deci & Ryan), Jordan 2015, Coursera 2022, Akcaoglu & Lee 2016, Ruzuku, École 42. — Ingénierie :
ByteByteGo, GetStream, Discord/WhatsApp eng blogs, oneuptime (schéma + présence Redis). — Droit :
RGPD art. 8/10/17/22, DSA art. 17/28, COPPA, UK OSA + ICO Children's Code, nLPD art. 32, CJUE
SCHUFA, CNIL. — T&S : Discord/Roblox/Instagram/Snapchat safety, OpenAI/Perspective moderation,
Thorn/Microsoft Artemis, Outschool, CDIP, TRA, crypto-shredding (seald.io, axiom.co). — Traduction :
pages officielles Google/Anthropic/DeepSeek/Mistral/OpenAI/DeepL, MediaWiki Translate, « pain of
paying » (Soman).
