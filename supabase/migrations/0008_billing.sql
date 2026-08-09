-- Base de cobrança (Fase 2 do roteiro de comercialização): cada família tem
-- um status de plano e, quando assina, os ids da Asaas ficam gravados aqui.
-- Isso NÃO bloqueia acesso via RLS ainda (ficaria arriscado demais nesta
-- fase) — o bloqueio é só no app (paywall), Fase 3 pode endurecer isso.

alter table households add column plan_status text not null default 'trialing'
  check (plan_status in ('trialing', 'active', 'past_due', 'canceled'));
alter table households add column trial_ends_at timestamptz;
alter table households add column asaas_customer_id text;
alter table households add column asaas_subscription_id text;

-- Famílias que já existem (você e quem já usa o app) não devem cair num
-- trial retroativo — ficam "active" direto.
update households set plan_status = 'active';

-- Famílias criadas a partir de agora começam em trial de 14 dias.
alter table households alter column trial_ends_at set default (now() + interval '14 days');
