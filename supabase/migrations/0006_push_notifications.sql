-- Lembrete de vencimento por push notification (funciona mesmo com o app
-- fechado). Duas peças novas:
-- 1. push_subscriptions: guarda a inscrição de push de cada aparelho/usuário
--    (gerada pelo navegador via PushManager, com as chaves VAPID).
-- 2. bills.reminder_sent_at: marca que já avisamos essa conta, pra a rotina
--    agendada (Edge Function send-bill-reminders) não mandar de novo todo dia.

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now()
);
create index push_subscriptions_household_id_idx on push_subscriptions(household_id);

alter table push_subscriptions enable row level security;

-- Cada usuário só vê/gerencia as próprias inscrições (a Edge Function que
-- manda os avisos usa a service_role key, que ignora RLS).
create policy "user manages own push subscriptions" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table bills add column reminder_sent_at timestamptz;
