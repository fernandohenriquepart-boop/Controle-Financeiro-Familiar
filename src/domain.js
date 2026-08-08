// ---------------------------------------------------------------------------
// Domínio: formatação, agregações e cálculos usados pelas abas do app.
// As categorias/contas em si vêm do banco (a família pode editar em
// Configurações) — aqui ficam só os presets visuais e as funções puras.
// ---------------------------------------------------------------------------

export const COLOR_PRESETS = [
  { id: "emerald", label: "Esmeralda", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  { id: "teal", label: "Verde-água", chip: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500", bar: "bg-teal-500" },
  { id: "blue", label: "Azul", chip: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", bar: "bg-blue-500" },
  { id: "indigo", label: "Índigo", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500", bar: "bg-indigo-500" },
  { id: "violet", label: "Violeta", chip: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500", bar: "bg-violet-500" },
  { id: "pink", label: "Rosa", chip: "bg-pink-50 text-pink-700 border-pink-200", dot: "bg-pink-500", bar: "bg-pink-500" },
  { id: "rose", label: "Vermelho", chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", bar: "bg-rose-500" },
  { id: "orange", label: "Laranja", chip: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", bar: "bg-orange-500" },
  { id: "amber", label: "Âmbar", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", bar: "bg-amber-500" },
  { id: "cyan", label: "Ciano", chip: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500", bar: "bg-cyan-500" },
  { id: "slate", label: "Cinza", chip: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-500", bar: "bg-slate-500" },
];

export function colorPreset(id) {
  return COLOR_PRESETS.find((c) => c.id === id) ?? COLOR_PRESETS[COLOR_PRESETS.length - 1];
}

export const ACCOUNT_TYPE_LABELS = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  carteira: "Carteira",
  cartao_credito: "Cartão de crédito",
};

export const RECURRENCE_LABELS = {
  monthly: "Mensal",
  weekly: "Semanal",
  yearly: "Anual",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export function formatMonthLabel(monthKey) {
  // monthKey: "YYYY-MM-01"
  const [y, m] = monthKey.split("-").map(Number);
  const label = monthLabelFormatter.format(new Date(y, m - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthKeyFromDate(dateStr) {
  return `${dateStr.slice(0, 7)}-01`;
}

export function toDateInputValue(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function emptyTransactionForm(type = "expense") {
  return {
    type,
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    categoryId: "",
    accountId: "",
  };
}

export function buildEditPayload(transaction) {
  return {
    type: transaction.type,
    amount: String(transaction.amount),
    description: transaction.description,
    date: transaction.date,
    categoryId: transaction.categoryId ?? "",
    accountId: transaction.accountId ?? "",
    isFixed: transaction.isFixed ?? false,
    __id: transaction.id,
  };
}

export function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function transactionsInMonth(transactions, monthKey) {
  return transactions.filter((t) => monthKeyFromDate(t.date) === monthKey);
}

export function sumByType(transactions, type) {
  return transactions.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0);
}

export function accountBalance(account, transactions) {
  const delta = transactions
    .filter((t) => t.accountId === account.id)
    .reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
  return account.initialBalance + delta;
}

export function totalBalance(accounts, transactions, bills = []) {
  const accountsTotal = accounts
    .filter((a) => a.type !== "cartao_credito")
    .reduce((sum, a) => sum + accountBalance(a, transactions), 0);
  const pendingPayables = bills
    .filter((b) => b.type === "payable" && b.status === "pending")
    .reduce((sum, b) => sum + b.amount, 0);
  return accountsTotal - pendingPayables;
}

export function categoryTotals(transactions, categories, type) {
  const totals = new Map();
  for (const t of transactions) {
    if (t.type !== type) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      category: categories.find((c) => c.id === categoryId),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function budgetUsage(budgets, transactions, categories) {
  return budgets.map((budget) => {
    const spent = transactions
      .filter((t) => t.type === "expense" && t.categoryId === budget.categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      ...budget,
      category: categories.find((c) => c.id === budget.categoryId),
      spent,
      pct: budget.limitAmount > 0 ? Math.min(100, Math.round((spent / budget.limitAmount) * 100)) : 0,
      overBudget: spent > budget.limitAmount,
    };
  });
}

export function upcomingBills(bills, { days = 30, type } = {}) {
  const now = new Date();
  const limit = new Date(now.getTime() + days * 86400000);
  return bills
    .filter((b) => b.status === "pending")
    .filter((b) => !type || b.type === type)
    .filter((b) => new Date(b.dueDate) <= limit)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

export function isOverdue(bill) {
  return bill.status === "pending" && new Date(bill.dueDate) < new Date(new Date().toDateString());
}

export function goalProgress(goal) {
  return goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
}
