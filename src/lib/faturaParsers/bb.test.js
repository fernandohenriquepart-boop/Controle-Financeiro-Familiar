import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, detectBB } from "./bb.js";

// Estrutura anonimizada (nomes/valores fictícios), mesmo formato real de uma
// fatura Banco do Brasil de verdade: dois titulares (cartão adicional) na
// mesma fatura, linhas de pagamento negativas misturadas na mesma seção (sem
// marcador de início/fim próprio), e parcelas marcadas com "PARC N/M" no
// meio da descrição.
const FIXTURE = `Banco do Brasil
Fulano de Tal
Vencimento
08/08/2026
Limite único
R$11.978,00
Lançamentos nesta fatura
Fulano de Tal (Cartão 0001)
Data Descrição País Valor
 SALDO FATURA ANTERIOR BR R$ 4.406,87
 Pagamentos/Créditos
08/07 PGTO. QR CODE PIX BR R$ -4.406,87
 Restaurantes
19/07 MARE ALTA EXEMPLO BR R$ 86,00
 Serviços
18/07 REDE EXEMPLO COMERC EXEMPLO BR R$ 150,00
 Compras parceladas
23/11 LOJA EXEMPLO PARC 08/10 EXEMPLO CIDADE BR R$ 27,99
Subtotal R$ 263,99
Fulana da Silva (Cartão 0002)
Data Descrição País Valor
 Compras parceladas
29/07 EC *4PRODUTOS PARC 12/12 CIDADE BR R$ 66,78
Subtotal R$ 66,78
Total da Fatura R$ 330,77`;

test("detectBB: reconhece a assinatura do banco no texto", () => {
  assert.equal(detectBB(FIXTURE), true);
  assert.equal(detectBB("texto de outro banco qualquer"), false);
});

test("parse: extrai vencimento e ignora saldo anterior + pagamentos negativos", () => {
  const result = parse(FIXTURE);
  assert.equal(result.vencimentoDate.toISOString().slice(0, 10), "2026-08-08");
  assert.ok(!result.transactions.some((t) => t.amount < 0));
  assert.ok(!result.transactions.some((t) => t.description.includes("SALDO FATURA")));
  assert.ok(!result.transactions.some((t) => t.description.includes("PGTO")));
});

test("parse: inclui lançamentos dos dois titulares (cartão adicional)", () => {
  const result = parse(FIXTURE);
  assert.equal(result.transactions.length, 4);
  assert.deepEqual(
    result.transactions.map((t) => t.description),
    ["MARE ALTA EXEMPLO", "REDE EXEMPLO COMERC EXEMPLO", "LOJA EXEMPLO EXEMPLO CIDADE", "EC *4PRODUTOS CIDADE"]
  );
});

test("parse: detecta 'PARC N/M' no meio da descrição", () => {
  const result = parse(FIXTURE);
  const parcelado = result.transactions.find((t) => t.description.startsWith("LOJA EXEMPLO"));
  assert.deepEqual(parcelado.installment, { merchant: "LOJA EXEMPLO EXEMPLO CIDADE", current: 8, total: 10 });
});

test("parse: para na seção Total da Fatura, não conta nada depois", () => {
  const result = parse(FIXTURE);
  assert.equal(result.transactions.length, 4);
});
