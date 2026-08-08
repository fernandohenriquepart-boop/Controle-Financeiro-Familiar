import { test } from "node:test";
import assert from "node:assert/strict";
import { detectInstallment, detectParcInstallment } from "./installmentDetector.js";

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

test("detectParcInstallment: reconhece 'PARC N/M' no meio da descrição, com texto depois", () => {
  assert.deepEqual(detectParcInstallment("HAVAN SAO BEN PARC 08/10 SAO BENTO DO"), {
    merchant: "HAVAN SAO BEN SAO BENTO DO",
    current: 8,
    total: 10,
  });
});
test("detectParcInstallment: reconhece 'PARC N/M' com texto só antes", () => {
  assert.deepEqual(detectParcInstallment("LOJAS DORIMAR PARC 10/10"), { merchant: "LOJAS DORIMAR", current: 10, total: 10 });
});
test("detectParcInstallment: ignora quando não tem a palavra PARC", () => {
  assert.equal(detectParcInstallment("MARE ALTA JAGUARUNA"), null);
});
test("detectParcInstallment: ignora quando o atual é maior que o total", () => {
  assert.equal(detectParcInstallment("LOJA X PARC 09/03 CIDADE"), null);
});
