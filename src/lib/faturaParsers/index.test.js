import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBank, parseFatura } from "./index.js";

test("detectBank: identifica Nubank e Itaú, e retorna null pra banco desconhecido", () => {
  assert.equal(detectBank("Nu Pagamentos S.A. fatura")?.id, "nubank");
  assert.equal(detectBank("Banco Itaú S.A. fatura")?.id, "itau");
  assert.equal(detectBank("Banco Desconhecido S.A."), null);
});

test("parseFatura: retorna erro claro quando o banco não é reconhecido", () => {
  const result = parseFatura("texto de um banco qualquer não suportado");
  assert.equal(result.bank, null);
  assert.equal(result.transactions.length, 0);
  assert.ok(result.error);
});

test("parseFatura: despacha pro parser certo (Nubank)", () => {
  const text = `Data de vencimento: 03 AGO 2026
Nu Pagamentos S.A.
TRANSAÇÕES DE 26 JUN A 27 JUL
Fulano R$ 10,00
27 JUN •••• 0000 Loja Teste R$ 10,00
Pagamentos R$ 0,00`;
  const result = parseFatura(text);
  assert.equal(result.bank, "nubank");
  assert.equal(result.transactions.length, 1);
});
