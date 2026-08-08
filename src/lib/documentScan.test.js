import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFromText } from "./documentScan.js";
import { mod10, mod11 } from "./boleto.js";

function buildLinhaDigitavel({ bankCode, moeda, fator, valorDigits, campoLivre }) {
  const campo1Data = bankCode + moeda + campoLivre.slice(0, 5);
  const campo1 = campo1Data + String(mod10(campo1Data));
  const campo2Data = campoLivre.slice(5, 15);
  const campo2 = campo2Data + String(mod10(campo2Data));
  const campo3Data = campoLivre.slice(15, 25);
  const campo3 = campo3Data + String(mod10(campo3Data));
  const barcode43 = bankCode + moeda + fator + valorDigits + campoLivre;
  const dvGeral = String(mod11(barcode43));
  const campo5 = fator + valorDigits;
  return campo1 + campo2 + campo3 + dvGeral + campo5;
}

test("extractFromText: acha e decodifica a linha digitável dentro de um texto maior", () => {
  const linha = buildLinhaDigitavel({
    bankCode: "341",
    moeda: "9",
    fator: "1000",
    valorDigits: "0000500000",
    campoLivre: "1234567890123456789012345",
  });
  const spaced = `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10, 15)}.${linha.slice(15, 21)} ${linha.slice(21, 26)}.${linha.slice(26, 32)} ${linha.slice(32, 33)} ${linha.slice(33)}`;
  const text = `BANCO ITAÚ\nVencimento 03/07/2000\n\n${spaced}\n\nPagável em qualquer banco`;

  const result = extractFromText(text);
  assert.equal(result.boleto.valid, true);
  assert.equal(result.boleto.amount, 5000);
  assert.equal(result.boleto.bankName, "Itaú");
});

test("extractFromText: sem linha digitável, cai pra valor/data em R$ e DD/MM/AAAA (recibo)", () => {
  const text = "SUPERMERCADO BOM PREÇO\nData: 15/03/2026\nTOTAL R$ 123,45\nObrigado pela preferência";
  const result = extractFromText(text);
  assert.equal(result.boleto, null);
  assert.deepEqual(result.amountCandidates, [123.45]);
  assert.equal(result.dateCandidates[0].getFullYear(), 2026);
  assert.equal(result.dateCandidates[0].getMonth(), 2);
  assert.equal(result.dateCandidates[0].getDate(), 15);
});

test("extractFromText: texto sem nenhum padrão reconhecível não quebra", () => {
  const result = extractFromText("texto qualquer sem valor nem data");
  assert.equal(result.boleto, null);
  assert.deepEqual(result.amountCandidates, []);
  assert.deepEqual(result.dateCandidates, []);
});
