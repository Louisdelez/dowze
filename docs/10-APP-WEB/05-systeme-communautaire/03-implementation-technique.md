# Implémentation technique du système communautaire

> *Comment construire concrètement, sur **Next.js + Supabase (PostgreSQL)**. Modèles de données, temps
> réel, feed/ranking, matching, notifications, modération. Principe directeur : **Postgres fait le gros du
> travail** (schéma relationnel + RLS + triggers) ; on n'ajoute du temps réel que là où c'est nécessaire.*

---

## 1. Espaces, groupes & appartenance (+ RLS)

```sql
create table groups (                       -- classe, guilde, groupe d'étude
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text check (kind in ('cohort','guild','study_group')),
  created_at timestamptz default now()
);

create table memberships (
  group_id uuid references groups(id) on delete cascade,
  user_id  uuid references auth.users(id) on delete cascade,
  role text not null default 'member'
       check (role in ('owner','admin','moderator','mentor','member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);
create index memberships_user_idx on memberships(user_id);
```

**Isolation par groupe via RLS** — piège classique : une policy qui interroge `memberships` (elle-même
protégée) provoque récursion/lenteur. Solution standard : une fonction **`SECURITY DEFINER`** qui contourne
RLS, + index.

```sql
create or replace function accessible_group_ids()
returns setof uuid language sql security definer stable as $$
  select group_id from memberships where user_id = auth.uid();
$$;

create policy "members read group content" on threads
for select using ( space_id in (select accessible_group_ids()) );
```

> ✅ **Bonnes pratiques** : indexer toute colonne utilisée dans une policy ; ajouter le filtre explicite
> côté requête *en plus* de la RLS (meilleur usage des index) ; centraliser l'appartenance/les rôles dans
> des fonctions `SECURITY DEFINER`.

---

## 2. Forum, fils & Q&A (commentaires imbriqués)

```sql
create extension if not exists ltree;

create table threads (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references groups(id),
  author_id uuid not null references auth.users(id),
  kind text default 'post',          -- 'post' | 'question'
  title text, body text not null,
  accepted_answer_id uuid,           -- Q&A : réponse validée
  score int default 0,               -- dénormalisé (triggers)
  comment_count int default 0,
  hot_rank double precision default 0,
  created_at timestamptz default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,  -- adjacency list
  path ltree,                        -- materialized path (lecture du sous-arbre)
  author_id uuid not null references auth.users(id),
  body text not null, score int default 0,
  created_at timestamptz default now()
);
create index comments_path_gist on comments using gist (path);

create table tags (id uuid primary key, slug text unique, name text);
create table thread_tags (thread_id uuid, tag_id uuid, primary key (thread_id, tag_id));
```

**Choix des commentaires hiérarchiques** : combiner **adjacency list** (`parent_id`, simple, robuste,
cascade) **+ materialized path** (`ltree`, lecture d'un fil entier en une requête `where path <@ 'racine'
order by path`). C'est le modèle recommandé pour les discussions. **Éviter le nested set** (insertion =
réécriture de la moitié de la table).

---

## 3. Votes, réputation & ranking

### Votes (un seul par user/cible)
```sql
create table votes (
  user_id uuid references auth.users(id),
  target_type text check (target_type in ('thread','comment')),
  target_id uuid not null,
  value smallint check (value in (-1, 1)),
  primary key (user_id, target_type, target_id)   -- garantit 1 vote/user/cible
);
alter table profiles add column reputation int default 0;
```
La clé primaire `(user_id, target_type, target_id)` **est** la garantie « un vote par personne ». Score et
réputation mis à jour par **trigger transactionnel** (jamais côté client → sinon triche). Barème type Stack
Overflow (réponse +10, question +5, downvote −2), **plafond journalier** de réputation issue des votes
(anti-gaming), **auto-vote bloqué** (`author_id <> user_id`).

### Ranking (constantes réelles)
- **« Hot » des threads** — Hacker News (gravité) : `score = (P-1) / (T+2)^1.8` (P = votes, T = âge en
  heures). Ou Reddit hot (gère les downvotes, `log` qui écrase l'emballement).
- **« Meilleures réponses »** — **score de Wilson** (borne basse de l'intervalle de confiance, z=1.96),
  *pas* la moyenne brute : un +5/+5 ne bat pas un +50/+52.
- **Performance** : pré-calculer `hot_rank` en colonne indexée via **pg_cron** (toutes les N min sur les
  threads actifs) — *jamais* recalculer la formule dans l'`ORDER BY` (full scan).

---

## 4. Feed / fil d'activité

**Commencer en fan-out on read** (le plus simple : une seule écriture, pas de timelines à maintenir). Pour
une école, le nombre d'espaces suivis par élève est petit → la lecture reste bon marché :

```sql
select t.* from threads t
join memberships m on m.group_id = t.space_id
where m.user_id = auth.uid()
order by t.hot_rank desc
limit 30;
```
Ne passer à un fan-out on write (table `feed_items` matérialisée) **que si** la lecture devient
mesurablement lente. Le problème de la « célébrité » du fan-out on write n'existe pas à l'échelle d'une
classe → inutile de sur-concevoir.

---

## 5. Temps réel (Supabase Realtime) — chat, présence, salles d'étude

Trois primitives Supabase :

| Primitive | Usage Dowze | Note |
|-----------|------------|------|
| **Broadcast** | **Chat**, notifications live, salles d'étude, pomodoro partagé | Déclenchable **depuis la DB** (`realtime.broadcast_changes()`) ; plus scalable que Postgres Changes pour le chat |
| **Presence** | « Qui est en ligne », qui étudie dans la salle | En mémoire (CRDT), éphémère — ne pas l'utiliser pour des données persistantes |
| **Postgres Changes** | Petits cas faible volume (un compteur qui bouge) | Évite-le pour le chat à fort volume |

**Règle temps réel vs polling** : temps réel pour chat / présence / salles d'étude live ; **polling/refetch
(30-60 s ou au focus)** pour le badge de notifications et le feed. Ne pas tout passer en temps réel « parce
que c'est joli » (coût + complexité). Activer les **policies RLS sur `realtime.messages`** (sinon canaux
ouverts à tous).

---

## 6. Matching (binômes & groupes d'étude)

Algorithme **filtrage dur + scoring pondéré** (simple, implémentable) :

1. **Filtrage dur** : même objectif/matière, créneaux qui se chevauchent, niveau dans une fourchette.
2. **Scoring** (poids normalisés, ∑=1) :

```
match(a,b) =  w_dispo·overlap(a,b)        // souvent le poids le plus fort
            + w_objectif·sim_objectif(a,b)
            + w_niveau·(1 − |niv_a − niv_b|/plage)
            + w_fuseau·sim_fuseau(a,b)
            + w_interets·jaccard(int_a, int_b)
```

- **Disponibilités en bitmask** (7×24 = 168 bits) → l'intersection = un **ET binaire**, comparaison O(1).
- **Greedy** (trier les paires par score, affecter gloutonnement) suffit au MVP ; passer à **Kuhn-Munkres
  (hongrois)** seulement si l'optimalité globale compte. Recalcul en **batch**, pas en temps réel.
- **Cold start** (nouveaux sans historique) : valeurs par défaut + mode « ouvert à tous ».

---

## 7. Notifications

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id),
  type text not null,                -- 'reply','mention','vote','invite'...
  actor_id uuid, entity_type text, entity_id uuid,
  data jsonb,                        -- métadonnées structurées, JAMAIS du HTML
  is_read boolean default false, read_at timestamptz,
  created_at timestamptz default now()
);
create index notif_unread on notifications(recipient_id) where is_read = false;

create table notification_preferences (
  user_id uuid, type text, channel text check (channel in ('in_app','email','push')),
  enabled boolean default true, primary key (user_id, type, channel)
);
```

Patterns : **JSONB structuré** (rendu à l'affichage selon la langue, pas de HTML stocké) ; **coalescing**
(« 5 personnes ont aimé votre post » au lieu de 5 notifs) ; **digest email** (résumé horaire/quotidien, pas
un email par événement) ; **index partiel** sur le non-lu (le compteur est la requête la plus fréquente) ;
respecter strictement les préférences avant tout envoi. Multi-canal = **fanout** (in-app immédiat + job
email via Edge Function / `email_queue`).

---

## 8. Modération (technique)

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid, target_type text, target_id uuid,
  reason text, status text default 'pending'
       check (status in ('pending','reviewing','resolved','dismissed')),
  resolved_by uuid, created_at timestamptz default now()
);
create table moderation_flags (          -- résultats du filtrage auto
  id uuid primary key default gen_random_uuid(),
  target_type text, target_id uuid, source text,   -- 'keyword' | 'openai_moderation'
  flagged boolean, categories jsonb, scores jsonb,
  action text,                            -- 'auto_allow' | 'auto_block' | 'needs_review'
  created_at timestamptz default now()
);
```

**Pipeline en 3 voies** (à la soumission) :
1. pré-filtre **mots-clés** (gratuit, instantané) ;
2. **OpenAI Moderation API** (`flagged` / `categories` / `category_scores`) ;
3. décision par **seuils** : score bas → `auto_allow` ; haut → `auto_block` ; **zone grise → `needs_review`
   (file humaine)**.

Principe (OpenAI) : *traiter les scores comme des signaux pour ta politique, pas comme un blocage
automatique*. **RLS modérateur** : seuls les modos/mentors voient la file complète (`is_moderator(group)`
en `SECURITY DEFINER`) ; le signaleur ne voit que son propre report. **Toujours** logger scores +
catégories (audit + ajustement des seuils). **Rate-limiter** les reports (anti-harcèlement par signalement
abusif).

> Détail sûreté (mineurs, jardin clos, notification parentale) :
> [04-securite-cold-start.md](04-securite-cold-start.md).

---

## Synthèse de la pile

| Brique | Choix |
|--------|-------|
| Base | PostgreSQL (Supabase) ; triggers pour compteurs/réputation/hot_rank ; RLS `SECURITY DEFINER` |
| Commentaires | adjacency list + `ltree` |
| Ranking | HN/Reddit hot (threads) + Wilson (réponses) ; `hot_rank` via pg_cron |
| Feed | fan-out on read d'abord |
| Temps réel | Broadcast (chat, salles) + Presence (en ligne) ; polling pour notifs/feed |
| Matching | filtrage dur + scoring pondéré (bitmask dispo) ; greedy |
| Notifications | table + préférences (type×canal) ; JSONB ; coalescing + digest ; index partiel |
| Modération | reports à statuts + flags ; pipeline 3 voies (mots-clés + OpenAI Moderation + humain) |

**Suite** : [sûreté & démarrage à froid](04-securite-cold-start.md).
