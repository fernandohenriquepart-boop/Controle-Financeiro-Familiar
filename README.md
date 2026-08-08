# Controle Financeiro Familiar

App de controle financeiro para a família: receitas/despesas, orçamento por categoria, contas a
pagar/receber (incluindo cartão de crédito) e metas de poupança. Acesso multi-dispositivo via Supabase.

Stack: React + Vite + Tailwind CSS v4 + Supabase (Postgres/Auth/RLS) + Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com a URL e anon key do seu projeto Supabase
npm run dev
```

## Banco de dados

O schema fica em `supabase/migrations/0001_init.sql`. Aplique no SQL editor do seu projeto Supabase (ou
via `supabase db push`, se tiver o CLI vinculado ao projeto).

A Edge Function `supabase/functions/invite-member` permite que o admin da família convide novos membros
por e-mail sem criar uma família nova para eles. Deploy: `supabase functions deploy invite-member`.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run lint` — lint (oxlint)
- `npm run preview` — pré-visualiza o build de produção
