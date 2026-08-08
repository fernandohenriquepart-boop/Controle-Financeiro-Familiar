import { detectNubank, parse as parseNubank } from "./nubank.js";
import { detectItau, parse as parseItau } from "./itau.js";
import { detectBB, parse as parseBB } from "./bb.js";

const BANKS = [
  { id: "nubank", label: "Nubank", detect: detectNubank, parse: parseNubank },
  { id: "itau", label: "Itaú", detect: detectItau, parse: parseItau },
  { id: "bb", label: "Banco do Brasil", detect: detectBB, parse: parseBB },
];

export function detectBank(rawText) {
  return BANKS.find((bank) => bank.detect(rawText)) ?? null;
}

/** Detecta o banco e faz o parse. Retorna { bank, vencimentoDate, transactions, error }. */
export function parseFatura(rawText) {
  const bank = detectBank(rawText);
  if (!bank) {
    return { bank: null, vencimentoDate: null, transactions: [], error: "Banco não reconhecido nesta fatura." };
  }
  return { bank: bank.id, bankLabel: bank.label, ...bank.parse(rawText) };
}
