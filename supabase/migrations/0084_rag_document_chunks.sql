-- RAG documentaire : un document reste une unité administrable, ses fragments sont les unités de recherche.
-- Les helpers RLS historiques lisaient `accounts` avec les droits de l'appelant ; PostgREST recevait
-- donc `permission denied for table accounts`. Ils doivent être SECURITY DEFINER et avoir un search_path fermé.
create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.accounts where auth_user_id = (select auth.uid());
$$;

create or replace function public.owns_profile(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = pid and p.account_id = public.current_account_id()
  );
$$;

revoke all on function public.current_account_id() from public;
revoke all on function public.owns_profile(uuid) from public;
grant execute on function public.current_account_id() to authenticated, service_role;
grant execute on function public.owns_profile(uuid) to authenticated, service_role;

create table if not exists public.companion_space_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.companion_space_knowledge(id) on delete cascade,
  profile_id uuid not null,
  space text not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  embedding_vec vector(1024),
  created_at timestamptz not null default now(),
  unique (knowledge_id, chunk_index)
);

create index if not exists companion_space_knowledge_chunks_scope_idx
  on public.companion_space_knowledge_chunks(profile_id, space, knowledge_id, chunk_index);
create index if not exists companion_space_knowledge_chunks_fts_idx
  on public.companion_space_knowledge_chunks using gin (to_tsvector('simple', content));
create index if not exists companion_space_knowledge_chunks_trgm_idx
  on public.companion_space_knowledge_chunks using gin (content gin_trgm_ops);
create index if not exists companion_space_knowledge_chunks_embed_idx
  on public.companion_space_knowledge_chunks using hnsw (embedding_vec vector_cosine_ops);

alter table public.companion_space_knowledge_chunks enable row level security;
create policy "companion_space_knowledge_chunks: propriétaire"
  on public.companion_space_knowledge_chunks for all to authenticated
  using (profile_id in (
    select p.id from public.profiles p
    join public.accounts a on a.id = p.account_id
    where a.auth_user_id = auth.uid()
  ))
  with check (profile_id in (
    select p.id from public.profiles p
    join public.accounts a on a.id = p.account_id
    where a.auth_user_id = auth.uid()
  ));

-- Rend immédiatement les connaissances existantes interrogeables par le nouveau moteur.
insert into public.companion_space_knowledge_chunks
  (knowledge_id, profile_id, space, chunk_index, content, start_offset, end_offset)
select id, profile_id, space, 0, content, 0, length(content)
from public.companion_space_knowledge
where length(content) > 0
on conflict (knowledge_id, chunk_index) do nothing;
