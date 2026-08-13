-- Voix du compagnon : STT (humain -> texte) et TTS (texte -> voix), cloud ou poste local.
create table if not exists public.companion_voice_settings (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  stt_provider text not null default 'browser'
    check (stt_provider in ('browser','openai','elevenlabs','local')),
  stt_model text not null default 'gpt-4o-mini-transcribe',
  tts_provider text not null default 'browser'
    check (tts_provider in ('browser','openai','elevenlabs','local')),
  tts_model text not null default 'gpt-4o-mini-tts',
  voice_id text not null default 'marin',
  local_stt_model text not null default 'Systran/faster-whisper-small',
  local_tts_model text not null default 'speaches-ai/Kokoro-82M-v1.0-ONNX',
  local_voice_id text not null default 'ff_siwis',
  openai_key_enc text,
  elevenlabs_key_enc text,
  updated_at timestamptz not null default now()
);
alter table public.companion_voice_settings enable row level security;
create policy companion_voice_settings_owner on public.companion_voice_settings for all to authenticated
  using (exists (
    select 1 from public.accounts a
    where a.id = account_id and a.auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.accounts a
    where a.id = account_id and a.auth_user_id = auth.uid()
  ));
