import { detectParcInstallment } from "../installmentDetector.js";

const VENCIMENTO_PATTERN = /Vencimento\s*(\d{2})\/(\d{2})\/(\d{4})/;
const SECTION_START = /Lançamentos nesta fatura/;
const SECTION_END = /Total da Fatura/;

// Cada linha: "DD/MM DESCRIÇÃO [PAÍS(2 letras)] R$ VALOR". O código do país
// (ex: "BR") ajuda a ancorar onde a descrição termina, mas é opcional — pelo
// menos uma linha real (taxa de IOF) vem sem essa coluna preenchida. Cobre
// tanto lançamentos do titular quanto de cartões adicionais, que ficam em
// blocos separados na mesma seção ("Fulano (Cartão NNNN)" + subtotal) mas
// têm o mesmo formato de linha.
const TRANSACTION_PATTERN = /(\d{2})\/(\d{2})\s+(.+?)\s+(?:[A-Z]{2}\s+)?R\$\s*(-?[\d.]{1,7},\d{2})/gs;

function parseValor(token) {
  return Number(token.replace(/\./g, "").replace(",", "."));
}

export function detectBB(rawText) {
  return /Banco do Brasil/i.test(rawText) || /bb\.com\.br/i.test(rawText);
}

export function parse(rawText) {
  const vencimentoMatch = rawText.match(VENCIMENTO_PATTERN);
  if (!vencimentoMatch) {
    return { vencimentoDate: null, transactions: [], error: "Não encontrei a data de vencimento na fatura." };
  }
  const vencimentoDate = new Date(Number(vencimentoMatch[3]), Number(vencimentoMatch[2]) - 1, Number(vencimentoMatch[1]));
  const vencimentoMonth = vencimentoDate.getMonth();
  const vencimentoYear = vencimentoDate.getFullYear();

  const startMatch = rawText.match(SECTION_START);
  if (!startMatch) {
    return { vencimentoDate, transactions: [], error: "Não encontrei a lista de lançamentos na fatura." };
  }
  const sectionStart = startMatch.index + startMatch[0].length;
  const endMatch = rawText.slice(sectionStart).search(SECTION_END);
  const section = endMatch === -1 ? rawText.slice(sectionStart) : rawText.slice(sectionStart, sectionStart + endMatch);

  const transactions = [];
  for (const match of section.matchAll(TRANSACTION_PATTERN)) {
    const [, day, month, description, valorToken] = match;
    if (valorToken.startsWith("-")) continue; // pagamentos/créditos, não são lançamentos a importar

    const monthIndex = Number(month) - 1;
    const year = monthIndex > vencimentoMonth ? vencimentoYear - 1 : vencimentoYear;
    const date = new Date(year, monthIndex, Number(day));
    const installment = detectParcInstallment(description);
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
