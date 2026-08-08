-- Marca se um lançamento é despesa/receita fixa (aluguel, assinatura) ou
-- variável (compra pontual) — independente de recorrência, é uma marcação
-- do próprio lançamento.

alter table transactions add column is_fixed boolean not null default false;
