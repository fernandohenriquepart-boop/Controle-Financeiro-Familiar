// Agrupa lançamentos que parecem duplicados: mesmo tipo, conta, data e valor.
// Não usa a descrição na chave — importações repetidas de fatura costumam
// gerar linhas com descrição idêntica de qualquer forma, e exigir isso só
// deixaria passar duplicatas com descrição levemente diferente. É uma
// ferramenta de revisão manual, não de exclusão automática, então um
// grupo "falso positivo" (duas compras distintas com mesmo valor no mesmo
// dia) não é grave — quem decide o que apagar é o usuário.

export function findDuplicateGroups(transactions) {
  const groups = new Map();
  for (const t of transactions) {
    const key = [t.type, t.accountId ?? "none", t.date, t.amount].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => (a[0].date < b[0].date ? 1 : -1));
}
