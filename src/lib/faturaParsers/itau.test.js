import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, detectItau } from "./itau.js";

// Estrutura anonimizada (nomes/valores fictícios), mesmo formato real
// observado numa fatura Itaú de verdade: "Pagamentos efetuados" (antes,
// não deve ser importado), "Lançamentos: compras e saques" (o que
// queremos), com uma compra parcelada em andamento e dicas de categoria,
// seguido de "Lançamentos no cartão" e "Compras parceladas - próximas
// faturas" (depois, também não deve ser importado).
const FIXTURE = `Banco Itaú S.A. Titular FULANO DE TAL Vencimento: 10/08/2026 Pagamentos efetuados  DATA   VALOR EM R$ 07/07   PAGAMENTO PIX   -1.535,59  Total dos pagamentos   -1.535,59  Lançamentos: compras e saques  FULANO DE TAL  DATA   ESTABELECIMENTO   VALOR EM R$ 18/06   parc GENERICA 02/02   108,34 Principal (R$ 103,03) + Juros (R$ 5,31) 07/07   LOJA EXEMPLO 01/03   117,34 saúde CIDADE 21/07   POSTO EXEMPLOCIDADE   6,50 outros CIDADE 30/07   MERCADO EXEMPLOARMAZE   14,99 supermercado ARMAZEM  Lançamentos no cartão   1.688,48 Total dos lançamentos atuais   1.688,48  Compras parceladas - próximas faturas  DATA   ESTABELECIMENTO   VALOR EM R$ 07/07   LOJA EXEMPLO 02/03   117,33  Próxima fatura   117,33 Demais faturas   117,33 Total para próximas faturas   234,66`;

test("detectItau: reconhece a assinatura do banco no texto", () => {
  assert.equal(detectItau(FIXTURE), true);
  assert.equal(detectItau("qualquer outro texto sem banco"), false);
});

test("parse: extrai vencimento e só os lançamentos da seção certa", () => {
  const result = parse(FIXTURE);
  assert.equal(result.vencimentoDate.toISOString().slice(0, 10), "2026-08-10");
  assert.equal(result.transactions.length, 4);
  assert.deepEqual(
    result.transactions.map((t) => t.description),
    ["parc GENERICA", "LOJA EXEMPLO", "POSTO EXEMPLOCIDADE", "MERCADO EXEMPLOARMAZE"]
  );
});

test("parse: não importa pagamentos nem a seção de próximas faturas", () => {
  const result = parse(FIXTURE);
  assert.ok(!result.transactions.some((t) => t.description.includes("PAGAMENTO")));
  assert.equal(result.transactions.filter((t) => t.amount === 117.33).length, 0);
});

test("parse: detecta a compra parcelada em andamento (1/3) e a já concluída (2/2)", () => {
  const result = parse(FIXTURE);
  const emAndamento = result.transactions.find((t) => t.description === "LOJA EXEMPLO");
  assert.deepEqual(emAndamento.installment, { merchant: "LOJA EXEMPLO", current: 1, total: 3 });
  const concluida = result.transactions.find((t) => t.description === "parc GENERICA");
  assert.deepEqual(concluida.installment, { merchant: "parc GENERICA", current: 2, total: 2 });
});

test("parse: extrai a dica de categoria quando presente, ignora quando é detalhamento de juros", () => {
  const result = parse(FIXTURE);
  assert.equal(result.transactions.find((t) => t.description === "LOJA EXEMPLO").category, "saúde");
  assert.equal(result.transactions.find((t) => t.description === "MERCADO EXEMPLOARMAZE").category, "supermercado");
  assert.equal(result.transactions.find((t) => t.description === "parc GENERICA").category, null);
});

test("parse: valores e datas corretos", () => {
  const result = parse(FIXTURE);
  const posto = result.transactions.find((t) => t.description === "POSTO EXEMPLOCIDADE");
  assert.equal(posto.amount, 6.5);
  assert.equal(posto.date.toISOString().slice(0, 10), "2026-07-21");
});
