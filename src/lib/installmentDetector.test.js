import { test } from "node:test";
import assert from "node:assert/strict";
import { detectInstallment } from "./installmentDetector.js";

test("detectInstallment: reconhece sufixo de parcela válido", () => {
  assert.deepEqual(detectInstallment("AGROPECUARIA N 01/03"), { merchant: "AGROPECUARIA N", current: 1, total: 3 });
  assert.deepEqual(detectInstallment("parc ECONOMIC 02/02"), { merchant: "parc ECONOMIC", current: 2, total: 2 });
});

test("detectInstallment: ignora quando não tem sufixo numérico", () => {
  assert.equal(detectInstallment("REDE SAO MARCOS COMERCG"), null);
});

test("detectInstallment: ignora quando o número atual é maior que o total", () => {
  assert.equal(detectInstallment("LOJA QUALQUER 05/03"), null);
});

test("detectInstallment: ignora quando o total é absurdo (não é parcela, é outro número)", () => {
  assert.equal(detectInstallment("PEDIDO 12/2026"), null);
});

test("detectInstallment: ignora string vazia", () => {
  assert.equal(detectInstallment(""), null);
});
