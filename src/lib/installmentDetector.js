// Detecta o sufixo "NN/MM" (parcela atual/total) no fim de uma descrição de
// lançamento de fatura, ex: "AGROPECUARIA N 01/03" → parcela 1 de 3.
// Usado pelos parsers de fatura pra decidir se um lançamento vira uma compra
// parcelada (que provisiona os meses restantes) ou um lançamento avulso.

const INSTALLMENT_SUFFIX = /^(.*?)\s+(\d{1,2})\/(\d{1,2})$/;

export function detectInstallment(description) {
  const trimmed = description.trim();
  const match = trimmed.match(INSTALLMENT_SUFFIX);
  if (!match) return null;

  const merchant = match[1].trim();
  const current = Number(match[2]);
  const total = Number(match[3]);
  if (!merchant || current < 1 || total < 1 || current > total || total > 48) return null;

  return { merchant, current, total };
}
