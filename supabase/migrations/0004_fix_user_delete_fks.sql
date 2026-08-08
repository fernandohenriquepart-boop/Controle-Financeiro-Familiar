-- Corrige duas foreign keys que bloqueavam apagar um usuário pelo painel do
-- Supabase (Authentication → Users → Delete), mesmo problema já visto no
-- Gestão Fiscal: nenhuma delas tinha ON DELETE definido, então o Postgres
-- recusa a exclusão em vez de propagar.
--
-- 1. households.owner_id → auth.users(id): sem regra, bloqueia apagar o
--    usuário dono de uma família. A família deve continuar existindo para
--    os outros membros, só o dono fica "sem dono" (SET NULL).
-- 2. transactions.created_by → profiles(id): sem regra. Ao apagar um
--    usuário, profiles.id cai em cascata (por causa do "on delete cascade"
--    já existente ali) — mas isso esbarra aqui se esse perfil já criou
--    algum lançamento. O lançamento em si deve continuar existindo, só
--    perde a referência de quem criou (SET NULL).

alter table households drop constraint households_owner_id_fkey;
alter table households add constraint households_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

alter table transactions drop constraint transactions_created_by_fkey;
alter table transactions add constraint transactions_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;
