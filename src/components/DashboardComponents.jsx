import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, EmptyState, Badge } from "./ui";
import {
  formatCurrency,
  formatMonthLabel,
  transactionsInMonth,
  sumByType,
  totalBalance,
  categoryTotals,
  colorPreset,
  upcomingBills,
  isOverdue,
} from "../domain";

const CHART_COLORS = ["#059669", "#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#d97706", "#64748b"];

function SummaryCard({ icon: Icon, label, value, tone, subtitle }) {
  return (
    <Card className="flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-lg font-semibold text-slate-900">{value}</p>
        {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
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

export function DashboardTab({ accounts, transactions, categories, bills, monthKey }) {
  const monthTx = transactionsInMonth(transactions, monthKey);
  const income = sumByType(monthTx, "income");
  const expense = sumByType(monthTx, "expense");
  const fixedExpense = monthTx.filter((t) => t.type === "expense" && t.isFixed).reduce((sum, t) => sum + t.amount, 0);
  const variableExpense = expense - fixedExpense;
  const balance = totalBalance(accounts, transactions);
  const expenseByCategory = categoryTotals(monthTx, categories, "expense");
  const pendingBills = upcomingBills(bills, { days: 15 });

  const chartData = expenseByCategory.map((c) => ({
    name: c.category?.name ?? "Sem categoria",
    value: c.amount,
    colorId: c.category?.colorId,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={Wallet} label="Saldo total" value={formatCurrency(balance)} tone="bg-emerald-50 text-emerald-600" />
        <SummaryCard icon={TrendingUp} label="Receitas do mês" value={formatCurrency(income)} tone="bg-blue-50 text-blue-600" />
        <SummaryCard
          icon={TrendingDown}
          label="Despesas do mês"
          value={formatCurrency(expense)}
          tone="bg-rose-50 text-rose-600"
          subtitle={`Fixas: ${formatCurrency(fixedExpense)} · Variáveis: ${formatCurrency(variableExpense)}`}
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
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${preset.dot}`} />
                    <span className="truncate text-slate-700">{t.description || category?.name || "Lançamento"}</span>
                  </span>
                  <span className={`shrink-0 font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
