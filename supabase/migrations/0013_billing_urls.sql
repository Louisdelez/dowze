-- Lien direct « acheter des crédits API » par fournisseur, affiché à côté du champ
-- clé API dans « Mon Copilote ». URLs vérifiées (mi-2026).
alter table public.ai_model
  add column if not exists billing_url text not null default '';
alter table public.ai_embedding_model
  add column if not exists billing_url text not null default '';

update public.ai_model set billing_url = case provider
  when 'openai'    then 'https://platform.openai.com/settings/organization/billing/overview'
  when 'google'    then 'https://aistudio.google.com/apikey'
  when 'anthropic' then 'https://console.anthropic.com/settings/billing'
  when 'mistral'   then 'https://console.mistral.ai/billing'
  when 'deepseek'  then 'https://platform.deepseek.com/top_up'
  else billing_url end;

update public.ai_embedding_model set billing_url = case provider
  when 'openai'  then 'https://platform.openai.com/settings/organization/billing/overview'
  when 'google'  then 'https://aistudio.google.com/apikey'
  when 'mistral' then 'https://console.mistral.ai/billing'
  when 'voyage'  then 'https://dashboard.voyageai.com/'
  when 'cohere'  then 'https://dashboard.cohere.com/billing'
  when 'jina'    then 'https://jina.ai/api-dashboard/'
  else billing_url end;
