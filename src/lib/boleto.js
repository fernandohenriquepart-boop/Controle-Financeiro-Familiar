// Decodificação da linha digitável de boleto bancário (padrão FEBRABAN).
// Matemática pura, determinística — sem OCR nem IA. Ver especificação:
// campo1 (10 díg: banco+moeda+5 díg campo livre+DV), campo2/campo3 (11 díg:
// 10 díg campo livre+DV cada), campo4 (1 díg: DV geral), campo5 (14 díg:
// fator de vencimento + valor).
//
// Boletos de concessionária/tributo (código de barras iniciando em "8", 48
// dígitos na linha digitável) usam uma estrutura totalmente diferente e não
// são suportados aqui — preferimos recusar com uma mensagem clara a arriscar
// um valor errado.

const BASE_DATE = Date.UTC(1997, 9, 7); // 07/10/1997 — fator 1000 = 03/07/2000 (conferido)
const MS_PER_DAY = 86400000;

const BANK_NAMES = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "077": "Banco Inter",
  "104": "Caixa Econômica",
  "121": "Banco Agibank",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "336": "C6 Bank",
  "341": "Itaú",
  "422": "Banco Safra",
  "748": "Sicredi",
  "756": "Sicoob",
};

function toDigits(str) {
  return str.split("").map(Number);
}

/** Módulo 10 "bancário": esquerda→direita, peso inicial 2 alternando com 1. */
export function mod10(digitsStr) {
  const digits = toDigits(digitsStr);
  let weight = 2;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let prod = digits[i] * weight;
    if (prod > 9) prod = Math.floor(prod / 10) + (prod % 10);
    sum += prod;
    weight = weight === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/** Módulo 11 do DV geral do código de barras: direita→esquerda, pesos 2..9 em ciclo. */
export function mod11(digitsStr) {
  const digits = toDigits(digitsStr);
  let weight = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const resto = sum % 11;
  if (resto === 0 || resto === 1) return 1;
  return 11 - resto;
}

export function fatorToDate(fatorStr) {
  const fator = Number(fatorStr);
  if (!fator) return null;
  return new Date(BASE_DATE + fator * MS_PER_DAY);
}

/**
 * Decodifica uma linha digitável de boleto bancário (47 dígitos).
 * Retorna { valid: true, dueDate, amount, bankCode, bankName, campoLivre }
 * ou { valid: false, reason }.
 */
export function parseLinhaDigitavel(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");

  if (digits.length === 48 && digits.startsWith("8")) {
    return { valid: false, reason: "Boleto de concessionária/tributo não suportado — preencha manualmente." };
  }
  if (digits.length !== 47) {
    return { valid: false, reason: "Não parece uma linha digitável de boleto válida (esperado 47 dígitos)." };
  }

  const campo1 = digits.slice(0, 10);
  const campo2 = digits.slice(10, 21);
  const campo3 = digits.slice(21, 32);
  const dvGeral = digits[32];
  const campo5 = digits.slice(33, 47);

  const dv1 = mod10(campo1.slice(0, 9));
  const dv2 = mod10(campo2.slice(0, 10));
  const dv3 = mod10(campo3.slice(0, 10));
  if (String(dv1) !== campo1[9] || String(dv2) !== campo2[10] || String(dv3) !== campo3[10]) {
    return { valid: false, reason: "Dígitos verificadores não conferem — confira o número ou tente escanear de novo." };
  }

  const bankCode = campo1.slice(0, 3);
  const moeda = campo1[3];
  const campoLivre = campo1.slice(4, 9) + campo2.slice(0, 10) + campo3.slice(0, 10);
  const fator = campo5.slice(0, 4);
  const valorDigits = campo5.slice(4, 14);

  const barcode43 = bankCode + moeda + fator + valorDigits + campoLivre;
  const expectedDvGeral = mod11(barcode43);
  if (String(expectedDvGeral) !== dvGeral) {
    return { valid: false, reason: "Dígito verificador geral não confere — confira o número ou tente escanear de novo." };
  }

  return {
    valid: true,
    bankCode,
    bankName: BANK_NAMES[bankCode] ?? `Banco ${bankCode}`,
    dueDate: fatorToDate(fator),
    amount: Number(valorDigits) / 100,
    campoLivre,
  };
}
