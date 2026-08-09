-- Phase C du système ÉCHANGER : traduction temps réel (doc 26 §4).
-- Option « Mon Copilote » : un modèle LowCost séparé pour la traduction (sinon on réutilise l'IA
-- principale, avec avertissement de surcoût). Le cache communautaire est dans Redis (pas en SQL).
alter table public.copilote_settings
  add column if not exists lowcost_model_id text references public.ai_model(id);
