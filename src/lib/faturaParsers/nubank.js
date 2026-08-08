import { detectInstallment } from "../installmentDetector.js";

const MONTHS = { JAN: 0, FEV: 1, MAR: 2, ABR: 3, MAI: 4, JUN: 5, JUL: 6, AGO: 7, SET: 8, OUT: 9, NOV: 10, DEZ: 11 };

const VENCIMENTO_PATTERN = /Data de vencimento:\s*(\d{2})\s+([A-ZÇ]{3})\s+(\d{4})/;
// O grupo "•••• NNNN" (últimos 4 dígitos do cartão) é obrigatório de propósito:
// só aparece nas linhas de transação de verdade, o que evita casar acidentalmente
// com o próprio cabeçalho da seção ("TRANSAÇÕES DE 26 JUN A 27 JUL") ou com a
// linha de subtotal do titular, que têm "DD MMM" mas não têm essa marcação.
const TRANSACTION_PATTERN = /(\d{2})\s+([A-ZÇ]{3})\s+••••\s*\d{4}\s+(.+?)\s+R\$\s*([\d.]+,\d{2})/gs;
const SECTION_START = /TRANSAÇÕES/;
const SECTION_END = /Pagamentos/;

function parseValor(token) {
  return Number(token.replace(/\./g, "").replace(",", "."));
}

export function detectNubank(rawText) {
  return /nu\.com\.br|Nu Pagamentos S\.A\./i.test(rawText);
}

export function parse(rawText) {
  const vencimentoMatch = rawText.match(VENCIMENTO_PATTERN);
  if (!vencimentoMatch) {
    return { vencimentoDate: null, transactions: [], error: "Não encontrei a data de vencimento na fatura." };
  }
  const vencimentoMonth = MONTHS[vencimentoMatch[2]];
  const vencimentoDate = new Date(Number(vencimentoMatch[3]), vencimentoMonth, Number(vencimentoMatch[1]));

  const startMatch = rawText.match(SECTION_START);
  if (!startMatch) {
    return { vencimentoDate, transactions: [], error: "Não encontrei a lista de transações na fatura." };
  }
  const sectionStart = startMatch.index + startMatch[0].length;
  SECTION_END.lastIndex = 0;
  const endMatch = rawText.slice(sectionStart).search(SECTION_END);
  const section = endMatch === -1 ? rawText.slice(sectionStart) : rawText.slice(sectionStart, sectionStart + endMatch);

  const transactions = [];
  for (const match of section.matchAll(TRANSACTION_PATTERN)) {
    const [, day, monthAbbrev, description, valorToken] = match;
    const monthIndex = MONTHS[monthAbbrev];
    if (monthIndex == null) continue;
    const year = monthIndex > vencimentoMonth ? vencimentoDate.getFullYear() - 1 : vencimentoDate.getFullYear();
    const date = new Date(year, monthIndex, Number(day));
    const installment = detectInstallment(description);
    transactions.push({
      date,
      description: installment ? installment.merchant : description.trim(),
      amount: parseValor(valorToken),
      installment,
      category: null,
    });
  }

  return { vencimentoDate, transactions };
}
