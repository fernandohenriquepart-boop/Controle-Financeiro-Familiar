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

// Bancos como o BB marcam parcela com a palavra "PARC" em qualquer posição da
// descrição (geralmente no meio, com a cidade depois), não só no final —
// ex: "HAVAN SAO BEN PARC 08/10 SAO BENTO DO".
const PARC_MARKER = /\bPARC\s+(\d{1,2})\/(\d{1,2})\b/i;

export function detectParcInstallment(description) {
  const trimmed = description.trim();
  const match = trimmed.match(PARC_MARKER);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);
  if (current < 1 || total < 1 || current > total || total > 48) return null;

  const merchant = (trimmed.slice(0, match.index) + " " + trimmed.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .trim();
  if (!merchant) return null;

  return { merchant, current, total };
}
