-- Código de família: forma alternativa (e mais confiável) de trazer um novo
-- membro pra dentro da mesma família, sem depender de convite por e-mail
-- (Edge Function publicada + envio de e-mail funcionando). O admin
-- compartilha esse código por fora (WhatsApp etc.); quem for criar conta
-- cola o código na tela de cadastro e entra direto como membro, em vez de
-- ganhar uma família nova e vazia.

alter table households add column join_code text;

update households
set join_code = upper(substr(md5(random()::text || id::text), 1, 8))
where join_code is null;

alter table households alter column join_code set not null;
alter table households add constraint households_join_code_key unique (join_code);
alter table households alter column join_code
  set default upper(substr(md5(random()::text || gen_random_uuid()::text), 1, 8));

-- Resolve um código pro id da família — precisa rodar sem sessão (a pessoa
-- ainda não tem conta nesse momento), por isso security definer + grant
-- pro papel anon. Só devolve o id, nada sensível.
create or replace function household_id_for_join_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from households where join_code = upper(p_code)
$$;

grant execute on function household_id_for_join_code(text) to anon, authenticated;
