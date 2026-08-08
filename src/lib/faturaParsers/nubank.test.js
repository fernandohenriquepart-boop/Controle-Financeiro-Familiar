import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, detectNubank } from "./nubank.js";

// Estrutura anonimizada (nomes/valores fictícios), mas o mesmo formato real
// observado numa fatura Nubank de verdade: cabeçalho com vencimento, seção
// "TRANSAÇÕES", uma linha de compra parcelada, e a seção "Pagamentos" (que
// não deve ser importada).
const FIXTURE = `
Olá, Fulano. Esta é a sua fatura de agosto, no valor de R$ 591,02
Data de vencimento: 03 AGO 2026
Período vigente: 26 JUN a 27 JUL
Nu Pagamentos S.A.
TRANSAÇÕES DE 26 JUN A 27 JUL
Fulano de Tal R$ 591,02
27 JUN •••• 0875 Mercado Exemplo R$ 165,80
27 JUN •••• 2349 Servico.Com/Bill R$ 19,90
28 JUN •••• 0875 Loja Exemplo 02/05 R$ 100,00
30 JUN •••• 0875 Padaria Central R$ 112,38
Pagamentos -R$ 172,40
27 JUN Pagamento em 27 JUN −R$ 172,40
Em cumprimento à regulação do Banco Central...
`;

test("detectNubank: reconhece a assinatura do banco no texto", () => {
  assert.equal(detectNubank(FIXTURE), true);
  assert.equal(detectNubank("qualquer outro texto"), false);
});

test("parse: extrai vencimento e todas as transações, ignorando a seção de pagamentos", () => {
  const result = parse(FIXTURE);
  assert.equal(result.vencimentoDate.toISOString().slice(0, 10), "2026-08-03");
  assert.equal(result.transactions.length, 4);
  assert.deepEqual(
    result.transactions.map((t) => t.description),
    ["Mercado Exemplo", "Servico.Com/Bill", "Loja Exemplo", "Padaria Central"]
  );
  assert.deepEqual(
    result.transactions.map((t) => t.amount),
    [165.8, 19.9, 100, 112.38]
  );
});

test("parse: datas sem ano resolvidas a partir do vencimento (mesmo ano quando o mês é anterior ao de vencimento)", () => {
  const result = parse(FIXTURE);
  assert.equal(result.transactions[0].date.toISOString().slice(0, 10), "2026-06-27");
});

test("parse: detecta a compra parcelada e separa do lançamento avulso", () => {
  const result = parse(FIXTURE);
  const parcelado = result.transactions.find((t) => t.description === "Loja Exemplo");
  assert.deepEqual(parcelado.installment, { merchant: "Loja Exemplo", current: 2, total: 5 });
  assert.equal(result.transactions[0].installment, null);
});

test("parse: resolve virada de ano (transação em dezembro, fatura vence em janeiro do ano seguinte)", () => {
  const fixture = `
Data de vencimento: 05 JAN 2027
TRANSAÇÕES DE 06 DEZ A 04 JAN
Fulano de Tal R$ 50,00
20 DEZ •••• 0000 Compra Fim De Ano R$ 50,00
Pagamentos R$ 0,00
`;
  const result = parse(fixture);
  assert.equal(result.transactions[0].date.toISOString().slice(0, 10), "2026-12-20");
});
