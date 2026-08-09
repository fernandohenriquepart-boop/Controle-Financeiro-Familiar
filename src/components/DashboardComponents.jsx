import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Scale, AlertTriangle, Pencil, Trash2, CreditCard } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Card, Modal, EmptyState, Badge } from "./ui";
import { TransactionModal } from "./TransactionModal";
import {
  formatCurrency,
  formatMonthLabel,
  transactionsInMonth,
  sumByType,
  categoryTotals,
  colorPreset,
  upcomingBills,
  isOverdue,
  buildEditPayload,
  shiftMonthKey,
} from "../domain";

const CHART_COLORS = ["#059669", "#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#d97706", "#64748b"];

function SummaryCard({ icon: Icon, label, value, tone, subtitle, onClick }) {
  const content = (
    <>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-lg font-semibold text-slate-900">{value}</p>
        {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        <Card className="flex items-center gap-3 transition-shadow hover:shadow-md">{content}</Card>
      </button>
    );
  }

  return <Card className="flex items-center gap-3">{content}</Card>;
}

function MonthExpensesModal({ isOpen, onClose, transactions, cardTotals, categories, accounts, monthLabel, total, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));

  async function handleEditSubmit(form, _recurring, applyScope) {
    const { __id, ...payload } = form;
    await onUpdate(__id, payload, applyScope);
  }

  return (
    <Modal title={`Despesas de ${monthLabel}`} isOpen={isOpen} onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Total: <span className="font-semibold text-rose-600">{formatCurrency(total)}</span>
        </p>

        {cardTotals && cardTotals.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {cardTotals.map(({ account, total: cardTotal }) => (
              <li key={account.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                    <CreditCard size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{account.name}</p>
                    <p className="truncate text-xs text-slate-400">Veja os lançamentos em Lançamentos Cartões</p>
                  </div>
                </div>
                <span className="shrink-0 font-medium text-rose-600">{formatCurrency(cardTotal)}</span>
              </li>
            ))}
          </ul>
        )}

        {sorted.length === 0 && (!cardTotals || cardTotals.length === 0) ? (
          <EmptyState title="Nenhuma despesa neste mês" />
        ) : sorted.length === 0 ? null : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {sorted.map((t) => {
              const category = categories.find((c) => c.id === t.categoryId);
              const account = accounts.find((a) => a.id === t.accountId);
              const preset = colorPreset(category?.colorId);
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${preset.dot}`} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{t.description || category?.name || "Lançamento"}</p>
                      <p className="truncate text-xs text-slate-400">
                        {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {category ? ` · ${category.name}` : ""}
                        {account ? ` · ${account.name}` : ""}
                        {t.isFixed ? " · fixa" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-medium text-rose-600">{formatCurrency(t.amount)}</span>
                    <button
                      onClick={() => setEditing(buildEditPayload(t))}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(t.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TransactionModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleEditSubmit}
        categories={categories}
        accounts={accounts}
        initial={editing}
      />
    </Modal>
  );
}

function AnnualOverviewChart({ transactions, monthKey }) {
  const months = Array.from({ length: 12 }, (_, i) => shiftMonthKey(monthKey, i - 11));
  const data = months.map((mk) => {
    const monthTx = transactionsInMonth(transactions, mk);
    const income = sumByType(monthTx, "income");
    const expense = monthTx.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return { month: formatMonthLabel(mk).slice(0, 3), Receitas: income, Despesas: expense };
  });

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Receita x despesa — últimos 12 meses</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Receitas" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesas" fill="#e11d48" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function MonthSwitcher({ monthKey, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(-1)}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[9rem] text-center text-sm font-medium text-slate-700">{formatMonthLabel(monthKey)}</span>
      <button
        onClick={() => onChange(1)}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Próximo mês"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function DashboardTab({ accounts, transactions, categories, bills, monthKey, onUpdate, onDelete }) {
  const [expensesModalOpen, setExpensesModalOpen] = useState(false);
  const monthTx = transactionsInMonth(transactions, monthKey);
  const cardAccounts = accounts.filter((a) => a.type === "cartao_credito");
  const cardAccountIds = new Set(cardAccounts.map((a) => a.id));
  const nonCardMonthTx = monthTx.filter((t) => !cardAccountIds.has(t.accountId));
  const cardTotals = cardAccounts
    .map((account) => ({
      account,
      total: sumByType(
        monthTx.filter((t) => t.accountId === account.id),
        "expense"
      ),
    }))
    .filter((c) => c.total > 0);
  const cardExpenseTotal = cardTotals.reduce((sum, c) => sum + c.total, 0);
  const income = sumByType(monthTx, "income");
  const nonCardExpense = sumByType(nonCardMonthTx, "expense");
  const expense = nonCardExpense + cardExpenseTotal;
  const fixedExpense = nonCardMonthTx.filter((t) => t.type === "expense" && t.isFixed).reduce((sum, t) => sum + t.amount, 0);
  const variableExpense = nonCardExpense - fixedExpense;
  const result = income - expense;
  const expenseByCategory = categoryTotals(nonCardMonthTx, categories, "expense");
  const pendingBills = upcomingBills(bills, { days: 15 });

  const chartData = expenseByCategory.map((c) => ({
    name: c.category?.name ?? "Sem categoria",
    value: c.amount,
    colorId: c.category?.colorId,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={TrendingUp} label="Receitas do mês" value={formatCurrency(income)} tone="bg-blue-50 text-blue-600" />
        <SummaryCard
          icon={TrendingDown}
          label="Despesas do mês"
          value={formatCurrency(expense)}
          tone="bg-rose-50 text-rose-600"
          subtitle={`Fixas: ${formatCurrency(fixedExpense)} · Variáveis: ${formatCurrency(variableExpense)} · Cartões: ${formatCurrency(cardExpenseTotal)}`}
          onClick={() => setExpensesModalOpen(true)}
        />
        <SummaryCard
          icon={Scale}
          label="Resultado do mês"
          value={formatCurrency(result)}
          tone={result >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}
          subtitle="Receitas − despesas do mês"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Despesas por categoria</h3>
          {chartData.length === 0 ? (
            <EmptyState title="Sem despesas neste mês" description="Lance uma despesa para ver o gráfico." />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="h-48 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {chartData.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-1.5 text-sm">
                {chartData.slice(0, 8).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-slate-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 font-medium text-slate-800">{formatCurrency(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Próximos vencimentos</h3>
          {pendingBills.length === 0 ? (
            <EmptyState title="Nada vencendo nos próximos 15 dias" />
          ) : (
            <ul className="space-y-2">
              {pendingBills.slice(0, 6).map((bill) => (
                <li key={bill.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{bill.description}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {isOverdue(bill) && (
                      <Badge className="border border-rose-200 bg-rose-50 text-rose-700">
                        <AlertTriangle size={11} /> Atrasada
                      </Badge>
                    )}
                    <span className="font-medium text-slate-800">{formatCurrency(bill.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Últimos lançamentos</h3>
        {monthTx.length === 0 ? (
          <EmptyState title="Nenhum lançamento neste mês" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {monthTx.slice(0, 8).map((t) => {
              const category = categories.find((c) => c.id === t.categoryId);
              const preset = colorPreset(category?.colorId);
              const impact = t.type === "income" ? t.amount : -t.amount;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${preset.dot}`} />
                    <span className="truncate text-slate-700">{t.description || category?.name || "Lançamento"}</span>
                  </span>
                  <span className={`shrink-0 font-medium ${impact >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {impact >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(impact))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <AnnualOverviewChart transactions={transactions} monthKey={monthKey} />

      <MonthExpensesModal
        isOpen={expensesModalOpen}
        onClose={() => setExpensesModalOpen(false)}
        transactions={nonCardMonthTx.filter((t) => t.type === "expense")}
        cardTotals={cardTotals}
        categories={categories}
        accounts={accounts}
        monthLabel={formatMonthLabel(monthKey)}
        total={expense}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}
