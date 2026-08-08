import { test } from "node:test";
import assert from "node:assert/strict";
import { mod10, mod11, fatorToDate, parseLinhaDigitavel } from "./boleto.js";

// Fixtures calculadas à mão (peso 2 no primeiro dígito, alternando com 1,
// esquerda→direita — convenção do "módulo 10 bancário", diferente do Luhn
// clássico que conta a partir da direita).
test("mod10: campo de 9 dígitos", () => {
  assert.equal(mod10("123456789"), 7);
});
test("mod10: campo de 10 dígitos", () => {
  assert.equal(mod10("1043510047"), 0);
});

test("fatorToDate: fator 1000 é a data-referência conhecida 03/07/2000", () => {
  const date = fatorToDate("1000");
  assert.equal(date.toISOString().slice(0, 10), "2000-07-03");
});
test("fatorToDate: fator 0000 significa sem vencimento", () => {
  assert.equal(fatorToDate("0000"), null);
});

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

test("parseLinhaDigitavel: decodifica corretamente uma linha digitável válida (round-trip)", () => {
  const linha = buildLinhaDigitavel({
    bankCode: "341",
    moeda: "9",
    fator: "1000",
    valorDigits: "0001234560", // R$ 12.345,60
    campoLivre: "1234567890123456789012345",
  });
  assert.equal(linha.length, 47);

  const result = parseLinhaDigitavel(linha);
  assert.equal(result.valid, true);
  assert.equal(result.bankCode, "341");
  assert.equal(result.bankName, "Itaú");
  assert.equal(result.amount, 12345.6);
  assert.equal(result.dueDate.toISOString().slice(0, 10), "2000-07-03");
  assert.equal(result.campoLivre, "1234567890123456789012345");
});

test("parseLinhaDigitavel: aceita a linha com pontos/espaços como impresso no boleto", () => {
  const linha = buildLinhaDigitavel({
    bankCode: "001",
    moeda: "9",
    fator: "1000",
    valorDigits: "0000010000",
    campoLivre: "0000000000000000000000000",
  });
  const spaced = `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10, 15)}.${linha.slice(15, 21)} ${linha.slice(21, 26)}.${linha.slice(26, 32)} ${linha.slice(32, 33)} ${linha.slice(33)}`;
  const result = parseLinhaDigitavel(spaced);
  assert.equal(result.valid, true);
  assert.equal(result.amount, 100);
});

test("parseLinhaDigitavel: rejeita quando um dígito verificador foi alterado", () => {
  const linha = buildLinhaDigitavel({
    bankCode: "237",
    moeda: "9",
    fator: "1000",
    valorDigits: "0000500000",
    campoLivre: "9999999999999999999999999",
  });
  const corrupted = linha.slice(0, 46) + (linha[46] === "0" ? "1" : "0");
  const result = parseLinhaDigitavel(corrupted);
  assert.equal(result.valid, false);
  assert.match(result.reason, /confere/);
});

test("parseLinhaDigitavel: recusa boleto de concessionária (48 dígitos, inicia em 8)", () => {
  const result = parseLinhaDigitavel("8" + "1".repeat(47));
  assert.equal(result.valid, false);
  assert.match(result.reason, /concessionária/);
});

test("parseLinhaDigitavel: recusa comprimento inválido", () => {
  const result = parseLinhaDigitavel("12345");
  assert.equal(result.valid, false);
});
