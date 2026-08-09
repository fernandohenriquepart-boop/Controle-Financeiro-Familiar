-- Permite lançar estorno em cartão: um lançamento de despesa com valor
-- negativo, que reduz a fatura em vez de aumentar. Antes só era permitido
-- amount > 0; passa a aceitar qualquer valor diferente de zero.

alter table transactions drop constraint transactions_amount_check;
alter table transactions add constraint transactions_amount_check check (amount <> 0);
