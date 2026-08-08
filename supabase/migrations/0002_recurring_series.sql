-- Compras parceladas e despesas/receitas recorrentes — cada série gera N
-- transações reais (uma por mês), vinculadas via transactions.series_id.
-- Aplique via SQL editor do Supabase (mesmo processo do 0001_init.sql).

create table recurring_series (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references households(id),
  kind                   text not null check (kind in ('installment', 'recurring')),
  type                   text not null check (type in ('income', 'expense')),
  description            text not null,
  category_id            uuid references categories(id) on delete set null,
  account_id             uuid references accounts(id) on delete set null,
  total_amount           numeric(12,2),
  installment_amount     numeric(12,2) not null,
  installment_count      int,
  installments_generated int not null default 0,
  start_date             date not null,
  created_at             timestamptz not null default now()
);
create index recurring_series_household_id_idx on recurring_series(household_id);

alter table transactions add column series_id uuid references recurring_series(id) on delete cascade;
create index transactions_series_id_idx on transactions(series_id);

alter table recurring_series enable row level security;

create policy "household read recurring_series" on recurring_series for select
  using (household_id = current_household_id());
create policy "household insert recurring_series" on recurring_series for insert
  with check (household_id = current_household_id());
create policy "household update recurring_series" on recurring_series for update
  using (household_id = current_household_id());
create policy "household delete recurring_series" on recurring_series for delete
  using (household_id = current_household_id());
