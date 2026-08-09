-- Permite vincular uma meta a uma conta real (ex: poupança) — quando
-- vinculada, o progresso passa a ser o saldo de verdade da conta em vez de
-- um valor digitado à mão via "Adicionar aporte".

alter table goals add column account_id uuid references accounts(id) on delete set null;
