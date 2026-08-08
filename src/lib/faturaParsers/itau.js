import { detectInstallment } from "../installmentDetector.js";

const SECTION_START = /Lançamentos:\s*compras e saques/;
const SECTION_END = /Lançamentos no cartão/;
const VENCIMENTO_PATTERN = /Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/;

// Cada entrada começa com "DD/MM", seguida da descrição e do primeiro valor
// em formato R$ que aparecer depois — o que vier depois disso (dica de
// categoria + cidade, ou detalhamento de juros) é ignorado por este regex
// simplesmente por não começar com outra data.
const TRANSACTION_PATTERN = /(\d{2})\/(\d{2})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/gs;

const CATEGORY_HINT_PATTERN =
  /^(saúde|outros|serviços|supermercado|alimentação|transporte|lazer|educação|vestuário|compras|assinaturas|farmácia)\b/i;

function parseValor(token) {
  return Number(token.replace(/\./g, "").replace(",", "."));
}

export function detectItau(rawText) {
  return /Ita[uú]/i.test(rawText) || /itau\.com\.br/i.test(rawText);
}

export function parse(rawText) {
  const vencimentoMatch = rawText.match(VENCIMENTO_PATTERN);
  const vencimentoDate = vencimentoMatch
    ? new Date(Number(vencimentoMatch[3]), Number(vencimentoMatch[2]) - 1, Number(vencimentoMatch[1]))
    : null;

  const startMatch = rawText.match(SECTION_START);
  if (!startMatch) {
    return { vencimentoDate, transactions: [], error: "Não encontrei a lista de lançamentos na fatura." };
  }
  const sectionStart = startMatch.index + startMatch[0].length;
  const endMatch = rawText.slice(sectionStart).search(SECTION_END);
  const section = endMatch === -1 ? rawText.slice(sectionStart) : rawText.slice(sectionStart, sectionStart + endMatch);

  const matches = [...section.matchAll(TRANSACTION_PATTERN)];
  const vencimentoMonth = vencimentoDate ? vencimentoDate.getMonth() : new Date().getMonth();
  const vencimentoYear = vencimentoDate ? vencimentoDate.getFullYear() : new Date().getFullYear();

  const transactions = matches.map((match, i) => {
    const [full, day, month, description, valorToken] = match;
    const matchEnd = match.index + full.length;
    const nextStart = matches[i + 1]?.index ?? section.length;
    const trailingText = section.slice(matchEnd, nextStart).trim();
    const categoryMatch = trailingText.match(CATEGORY_HINT_PATTERN);

    const installment = detectInstallment(description);
    const monthIndex = Number(month) - 1;
    const year = monthIndex > vencimentoMonth ? vencimentoYear - 1 : vencimentoYear;
    return {
      date: new Date(year, monthIndex, Number(day)),
      description: installment ? installment.merchant : description.trim(),
      amount: parseValor(valorToken),
      installment,
      category: categoryMatch ? categoryMatch[1].toLowerCase() : null,
    };
  });

  return { vencimentoDate, transactions };
}
