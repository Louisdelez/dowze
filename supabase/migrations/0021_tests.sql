-- Tests de révision (hebdo / trimestriel) : formatifs, sans note de maîtrise.
create table if not exists public.tests (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'weekly',
  items      jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tests_profile on public.tests(profile_id);

create table if not exists public.test_attempts (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references public.tests(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  total        integer not null default 0,
  correct      integer not null default 0,
  submitted_at timestamptz not null default now()
);

alter table public.tests enable row level security;
alter table public.test_attempts enable row level security;

create policy tests_owner on public.tests
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
create policy test_attempts_owner on public.test_attempts
  for all using (owns_profile(profile_id)) with check (owns_profile(profile_id));
