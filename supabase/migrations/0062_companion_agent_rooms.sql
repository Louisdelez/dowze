-- Salles DANS un espace : les compagnons sont rattachés à une salle (conteneur).
-- Maison : chambre perso (1/compagnon) + salles partagées. Open-space : workspaces de 100 places + salles entreprise.
alter table companion_agents add column if not exists room text not null default 'chambre';

-- Maison : chaque compagnon dans sa propre chambre.
update companion_agents set room = 'chambre' where space = 'home';

-- Open-spaces : répartir les compagnons existants en workspaces de 100 (travail:0, travail:1, …).
with numbered as (
  select id, ((row_number() over (partition by space order by created_at) - 1) / 100)::int as widx
  from companion_agents
  where space <> 'home'
)
update companion_agents a set room = 'travail:' || n.widx
from numbered n where a.id = n.id;

create index if not exists companion_agents_space_room_idx on companion_agents (profile_id, space, room);
