-- Controle Financeiro Familiar — schema inicial (multi-tenant por household)
-- Aplique via Supabase SQL editor, ou `supabase db push` se estiver usando o CLI.

create extension if not exists pgcrypto;

-- =========================================================================
-- 1. Tabelas
-- =========================================================================

create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id),
  full_name    text not null,
  role         text not null default 'member' check (role in ('admin', 'member')),
  avatar_emoji text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index profiles_household_id_idx on profiles(household_id);

create table accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id),
  name            text not null,
  type            text not null default 'corrente'
                    check (type in ('corrente', 'poupanca', 'carteira', 'cartao_credito')),
  initial_balance numeric(12,2) not null default 0,
  credit_limit    numeric(12,2),
  closing_day     smallint,
  due_day         smallint,
  created_at      timestamptz not null default now()
);
create index accounts_household_id_idx on accounts(household_id);

create table categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  name         text not null,
  type         text not null check (type in ('income', 'expense')),
  color_id     text not null default 'slate',
  icon         text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index categories_household_id_idx on categories(household_id);

create table transactions (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id),
  account_id       uuid references accounts(id) on delete set null,
  category_id      uuid references categories(id) on delete set null,
  type             text not null check (type in ('income', 'expense')),
  amount           numeric(12,2) not null check (amount > 0),
  description      text not null default '',
  date             date not null default current_date,
  is_recurring     boolean not null default false,
  recurrence_rule  text,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);
create index transactions_household_id_idx on transactions(household_id);
create index transactions_date_idx on transactions(date);
create index transactions_category_id_idx on transactions(category_id);

create table budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id),
  category_id   uuid not null references categories(id) on delete cascade,
  month         date not null,
  limit_amount  numeric(12,2) not null check (limit_amount >= 0),
  created_at    timestamptz not null default now(),
  unique (household_id, category_id, month)
);
create index budgets_household_id_idx on budgets(household_id);
create index budgets_month_idx on budgets(month);

create table bills (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id),
  type             text not null check (type in ('payable', 'receivable')),
  description      text not null,
  amount           numeric(12,2) not null check (amount > 0),
  due_date         date not null,
  status           text not null default 'pending' check (status in ('pending', 'paid')),
  category_id      uuid references categories(id) on delete set null,
  account_id       uuid references accounts(id) on delete set null,
  is_recurring     boolean not null default false,
  recurrence_rule  text,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index bills_household_id_idx on bills(household_id);
create index bills_due_date_idx on bills(due_date);
create index bills_status_idx on bills(status);

create table goals (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id),
  name           text not null,
  target_amount  numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0,
  target_date    date,
  color_id       text not null default 'emerald',
  created_at     timestamptz not null default now()
);
create index goals_household_id_idx on goals(household_id);

-- =========================================================================
-- 2. Funções auxiliares (security definer para evitar recursão de RLS)
-- =========================================================================

create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from profiles where id = auth.uid()
$$;

create or replace function current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- =========================================================================
-- 3. Trigger: primeiro usuário vira admin de uma nova família (household);
--    usuários convidados entram na família indicada nos metadados.
--    Uma família nova também recebe categorias padrão.
-- =========================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  invited_household_id uuid := (new.raw_user_meta_data->>'invited_household_id')::uuid;
  invited_role text := coalesce(new.raw_user_meta_data->>'invited_role', 'member');
  resolved_name text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
begin
  if invited_household_id is not null then
    insert into profiles (id, household_id, full_name, role)
    values (new.id, invited_household_id, resolved_name, invited_role);
  else
    insert into households (name, owner_id)
    values ('Família ' || resolved_name, new.id)
    returning id into new_household_id;

    insert into profiles (id, household_id, full_name, role)
    values (new.id, new_household_id, resolved_name, 'admin');

    insert into categories (household_id, name, type, color_id, is_default) values
      (new_household_id, 'Salário',        'income',  'emerald', true),
      (new_household_id, 'Outras receitas','income',  'teal',    true),
      (new_household_id, 'Alimentação',    'expense', 'orange',  true),
      (new_household_id, 'Moradia',        'expense', 'blue',    true),
      (new_household_id, 'Transporte',     'expense', 'indigo',  true),
      (new_household_id, 'Saúde',          'expense', 'rose',    true),
      (new_household_id, 'Educação',       'expense', 'violet',  true),
      (new_household_id, 'Lazer',          'expense', 'pink',    true),
      (new_household_id, 'Compras',        'expense', 'amber',   true),
      (new_household_id, 'Assinaturas',    'expense', 'cyan',    true),
      (new_household_id, 'Outros',         'expense', 'slate',   true);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================================
-- 4. RLS
-- =========================================================================

alter table households enable row level security;
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table bills enable row level security;
alter table goals enable row level security;

-- households: só membros leem a própria família; nada de insert/update via API pública
-- (criação de household acontece só via handle_new_user, security definer).
create policy "read own household" on households for select
  using (id = current_household_id());

-- profiles: todo mundo da família lê; cada um edita a própria linha;
-- admin edita role/is_active de qualquer perfil da família.
create policy "read household profiles" on profiles for select
  using (household_id = current_household_id());
create policy "update own profile" on profiles for update
  using (id = auth.uid());
create policy "admin manages profiles" on profiles for update
  using (household_id = current_household_id() and current_user_role() = 'admin');

-- accounts / categories / transactions / budgets / bills / goals:
-- leitura e escrita para qualquer membro da família.
create policy "household read accounts" on accounts for select
  using (household_id = current_household_id());
create policy "household insert accounts" on accounts for insert
  with check (household_id = current_household_id());
create policy "household update accounts" on accounts for update
  using (household_id = current_household_id());
create policy "household delete accounts" on accounts for delete
  using (household_id = current_household_id());

create policy "household read categories" on categories for select
  using (household_id = current_household_id());
create policy "household insert categories" on categories for insert
  with check (household_id = current_household_id());
create policy "household update categories" on categories for update
  using (household_id = current_household_id());
create policy "household delete categories" on categories for delete
  using (household_id = current_household_id());

create policy "household read transactions" on transactions for select
  using (household_id = current_household_id());
create policy "household insert transactions" on transactions for insert
  with check (household_id = current_household_id());
create policy "household update transactions" on transactions for update
  using (household_id = current_household_id());
create policy "household delete transactions" on transactions for delete
  using (household_id = current_household_id());

create policy "household read budgets" on budgets for select
  using (household_id = current_household_id());
create policy "household insert budgets" on budgets for insert
  with check (household_id = current_household_id());
create policy "household update budgets" on budgets for update
  using (household_id = current_household_id());
create policy "household delete budgets" on budgets for delete
  using (household_id = current_household_id());

create policy "household read bills" on bills for select
  using (household_id = current_household_id());
create policy "household insert bills" on bills for insert
  with check (household_id = current_household_id());
create policy "household update bills" on bills for update
  using (household_id = current_household_id());
create policy "household delete bills" on bills for delete
  using (household_id = current_household_id());

create policy "household read goals" on goals for select
  using (household_id = current_household_id());
create policy "household insert goals" on goals for insert
  with check (household_id = current_household_id());
create policy "household update goals" on goals for update
  using (household_id = current_household_id());
create policy "household delete goals" on goals for delete
  using (household_id = current_household_id());
