import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CreditCard, TrendingUp, Upload } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import { Card, Modal, Field, EmptyState, Badge, inputClass, primaryButtonClass, secondaryButtonClass, ProgressBar } from "./ui";
import { ImportFaturaModal } from "./ImportFaturaModal";
import { MonthSwitcher } from "./DashboardComponents";
import { TransactionModal } from "./TransactionModal";
import { billingDueDate } from "../lib/installments";
import {
  formatCurrency,
  formatMonthLabel,
  transactionsInMonth,
  sumByType,
  currentMonthKey,
  shiftMonthKey,
  buildEditPayload,
  toDateInputValue,
  categoryTotals,
} from "../domain";

const CARD_CHART_COLORS = ["#7c3aed", "#0891b2", "#db2777", "#059669", "#d97706", "#dc2626", "#2563eb", "#65a30d"];
const CATEGORY_CHART_COLORS = ["#059669", "#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#d97706", "#64748b"];

function emptyForm(accounts) {
  return {
    accountId: accounts[0]?.id ?? "",
    description: "",
    totalAmount: "",
    count: "1",
    categoryId: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
  };
}

function NewPurchaseModal({ isOpen, onClose, onSubmit, cardAccounts, categories }) {
  const [form, setForm] = useState(emptyForm(cardAccounts));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (isOpen) setForm(emptyForm(cardAccounts));
  }, [isOpen, cardAccounts]);

  const expenseCategories = categories.filter((c) => c.type === "expense");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.accountId) {
      setError("Cadastre um cartão em Configurações primeiro.");
      return;
    }
    if (!form.totalAmount || Number(form.totalAmount) <= 0) {
      setError("Informe um valor total maior que zero.");
      return;
    }
    const count = Math.max(1, Math.round(Number(form.count) || 1));
    setIsSubmitting(true);
    try {
      await onSubmit({ ...form, totalAmount: Number(form.totalAmount), count });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Nova compra no cartão" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Cartão">
          <select
            value={form.accountId}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            className={`${inputClass} w-full`}
          >
            {cardAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Descrição">
          <input
            type="text"
            required
            autoFocus
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={`${inputClass} w-full`}
            placeholder="Ex: Notebook"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Valor total (R$)">
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={form.totalAmount}
              onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
          <Field label="Parcelas">
            <input
              type="number"
              required
              min="1"
              max="48"
              step="1"
              value={form.count}
              onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Categoria">
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className={`${inputClass} w-full`}
            >
              <option value="">Sem categoria</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data da compra">
            <input
              type="date"
              required
              value={form.purchaseDate}
              onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}

function emptyCashForm(accounts) {
  return {
    accountId: accounts[0]?.id ?? "",
    description: "",
    amount: "",
    categoryId: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
  };
}

function NewCashPurchaseModal({ isOpen, onClose, onSubmit, cardAccounts, categories }) {
  const [form, setForm] = useState(emptyCashForm(cardAccounts));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (isOpen) setForm(emptyCashForm(cardAccounts));
  }, [isOpen, cardAccounts]);

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const account = cardAccounts.find((a) => a.id === form.accountId);
  const billingDate =
    account?.closingDay && account?.dueDay
      ? billingDueDate(new Date(form.purchaseDate + "T00:00:00"), account.closingDay, account.dueDay)
      : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.accountId) {
      setError("Cadastre um cartão em Configurações primeiro.");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!billingDate) {
      setError("Esse cartão está sem dia de fechamento/vencimento cadastrado.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        type: "expense",
        accountId: form.accountId,
        categoryId: form.categoryId,
        description: form.description,
        amount: Number(form.amount),
        date: toDateInputValue(billingDate),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Compra à vista no cartão" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Cartão">
          <select
            value={form.accountId}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            className={`${inputClass} w-full`}
          >
            {cardAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Descrição">
          <input
            type="text"
            required
            autoFocus
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={`${inputClass} w-full`}
            placeholder="Ex: Farmácia"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Valor (R$)">
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
          <Field label="Data da compra">
            <input
              type="date"
              required
              value={form.purchaseDate}
              onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
        </div>

        <Field label="Categoria">
          <select
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            className={`${inputClass} w-full`}
          >
            <option value="">Sem categoria</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {billingDate && (
          <p className="text-xs text-slate-400">
            Cai na fatura de {billingDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        )}

        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}

function CardSummary({ account, transactions, onSelect }) {
  const monthTx = transactionsInMonth(transactions, currentMonthKey()).filter((t) => t.accountId === account.id);
  const faturaAtual = sumByType(monthTx, "expense");
  const usagePct = account.creditLimit > 0 ? Math.min(100, Math.round((faturaAtual / account.creditLimit) * 100)) : 0;

  return (
    <button type="button" onClick={() => onSelect(account)} className="text-left">
      <Card className="flex flex-col gap-2 transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <CreditCard size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{account.name}</p>
            <p className="text-xs text-slate-400">Fatura do mês: {formatCurrency(faturaAtual)}</p>
          </div>
        </div>
        {account.creditLimit > 0 && (
          <>
            <ProgressBar pct={usagePct} barClassName={usagePct >= 90 ? "bg-rose-500" : "bg-violet-500"} />
            <p className="text-xs text-slate-400">
              {formatCurrency(faturaAtual)} de {formatCurrency(account.creditLimit)} de limite ({usagePct}%)
            </p>
          </>
        )}
      </Card>
    </button>
  );
}

export function CardDetailModal({
  account,
  transactions,
  categories,
  accounts,
  isOpen,
  onClose,
  initialMonthKey,
  onUpdate,
  onDelete,
  onDeleteSeries,
  bills,
  onCloseFatura,
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey ?? currentMonthKey());
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isClosingFatura, setIsClosingFatura] = useState(false);

  useMemo(() => {
    if (isOpen && account) {
      const baseMonthKey = initialMonthKey ?? currentMonthKey();
      const alreadyClosed = bills?.some(
        (b) => b.accountId === account.id && b.dueDate?.slice(0, 7) === baseMonthKey.slice(0, 7)
      );
      // Se a fatura desse mês já foi fechada, os lançamentos novos já caem
      // no mês seguinte — abre direto lá, em vez de mostrar um mês fechado
      // sem nada novo pra ver.
      setMonthKey(alreadyClosed ? shiftMonthKey(baseMonthKey, 1) : baseMonthKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve rodar ao abrir/trocar de mês, não a cada mudança em bills/account
  }, [isOpen, initialMonthKey]);

  if (!account) return null;

  const monthTx = transactionsInMonth(transactions, monthKey)
    .filter((t) => t.accountId === account.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const faturaTotal = sumByType(monthTx, "expense");
  const canEdit = Boolean(onUpdate && onDelete && accounts);
  const canCloseFatura = Boolean(onCloseFatura && bills);
  const closedBill = bills?.find((b) => b.accountId === account.id && b.dueDate?.slice(0, 7) === monthKey.slice(0, 7));

  async function handleEditSubmit(form, _recurring, applyScope) {
    const { __id, ...payload } = form;
    await onUpdate(__id, payload, applyScope);
  }

  function handleDeleteClick(t) {
    if (t.seriesId && onDeleteSeries) {
      setDeleteTarget(t);
    } else {
      onDelete(t.id);
    }
  }

  async function handleDeleteOnlyThis() {
    await onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handleDeleteAllInstallments() {
    await onDeleteSeries(deleteTarget.seriesId);
    setDeleteTarget(null);
  }

  async function handleCloseFatura() {
    const [year, month] = monthKey.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const day = Math.min(account.dueDay ?? 1, lastDay);
    const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setIsClosingFatura(true);
    try {
      await onCloseFatura({
        type: "payable",
        description: `Fatura ${account.name} — ${formatMonthLabel(monthKey)}`,
        amount: faturaTotal,
        dueDate,
        accountId: account.id,
      });
    } finally {
      setIsClosingFatura(false);
    }
  }

  return (
    <Modal title={account.name} isOpen={isOpen} onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Fatura: <span className="font-semibold text-slate-900">{formatCurrency(faturaTotal)}</span>
          </p>
          <MonthSwitcher monthKey={monthKey} onChange={(delta) => setMonthKey((m) => shiftMonthKey(m, delta))} />
        </div>

        {canCloseFatura && (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 p-2.5">
            {closedBill ? (
              <Badge className={closedBill.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                Fatura fechada — {closedBill.status === "paid" ? "paga" : "em aberto"} · vence{" "}
                {new Date(closedBill.dueDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </Badge>
            ) : (
              <>
                <span className="text-xs text-slate-500">Fatura ainda não fechada como conta a pagar.</span>
                <button
                  onClick={handleCloseFatura}
                  disabled={isClosingFatura || faturaTotal <= 0}
                  className={secondaryButtonClass + " disabled:opacity-60"}
                >
                  {isClosingFatura ? "Fechando..." : "Fechar fatura"}
                </button>
              </>
            )}
          </div>
        )}

        {monthTx.length === 0 ? (
          <EmptyState title="Nenhum lançamento neste mês" />
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {monthTx.map((t) => {
              const category = categories.find((c) => c.id === t.categoryId);
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{t.description || "Lançamento"}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      {category ? ` · ${category.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-medium text-rose-600">{formatCurrency(t.amount)}</span>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => setEditing(buildEditPayload(t))}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(t)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canEdit && (
        <TransactionModal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onSubmit={handleEditSubmit}
          categories={categories}
          accounts={accounts}
          initial={editing}
        />
      )}

      <Modal title="Excluir lançamento parcelado" isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            "{deleteTarget?.description || "Este lançamento"}" faz parte de uma compra parcelada. O que você quer excluir?
          </p>
          <button onClick={handleDeleteOnlyThis} className={secondaryButtonClass + " justify-center"}>
            Excluir só esta parcela
          </button>
          <button
            onClick={handleDeleteAllInstallments}
            className="flex items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-rose-700 focus:ring-2 focus:ring-rose-500"
          >
            <Trash2 size={14} /> Excluir todas as parcelas desta compra
          </button>
        </div>
      </Modal>
    </Modal>
  );
}

function PurchaseProgress({ series, account, transactions, onDelete }) {
  const today = new Date().toISOString().slice(0, 10);
  const paid = transactions.filter((t) => t.seriesId === series.id && t.date <= today).length;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-800">{series.description}</p>
        <p className="text-xs text-slate-400">
          {account?.name ?? "Cartão removido"} · {paid}/{series.installmentCount} parcelas de{" "}
          {formatCurrency(series.installmentAmount)}
        </p>
        <div className="mt-1">
          <ProgressBar pct={Math.round((paid / series.installmentCount) * 100)} />
        </div>
      </div>
      <button onClick={() => onDelete(series.id)} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function CardsMonthlyChart({ accounts, transactions }) {
  const cardAccounts = accounts.filter((a) => a.type === "cartao_credito");
  const months = Array.from({ length: 12 }, (_, i) => shiftMonthKey(currentMonthKey(), i));
  const data = months.map((monthKey) => {
    const monthTx = transactionsInMonth(transactions, monthKey);
    const row = { month: formatMonthLabel(monthKey).slice(0, 3) };
    for (const account of cardAccounts) {
      row[account.name] = sumByType(
        monthTx.filter((t) => t.accountId === account.id),
        "expense"
      );
    }
    return row;
  });

  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <TrendingUp size={15} /> Gastos por cartão — próximos 12 meses
      </h3>
      {cardAccounts.length === 0 ? (
        <EmptyState title="Nenhum cartão cadastrado" />
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {cardAccounts.map((account, i) => (
                <Bar
                  key={account.id}
                  dataKey={account.name}
                  stackId="cards"
                  fill={CARD_CHART_COLORS[i % CARD_CHART_COLORS.length]}
                  radius={i === cardAccounts.length - 1 ? [4, 4, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function CardsCategoryPieChart({ accounts, transactions, categories }) {
  const cardAccountIds = new Set(accounts.filter((a) => a.type === "cartao_credito").map((a) => a.id));
  const monthTx = transactionsInMonth(transactions, currentMonthKey()).filter((t) => cardAccountIds.has(t.accountId));
  const expenseByCategory = categoryTotals(monthTx, categories, "expense");
  const chartData = expenseByCategory.map((c) => ({
    name: c.category?.name ?? "Sem categoria",
    value: c.amount,
  }));

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Gastos por categoria (cartões)</h3>
      {chartData.length === 0 ? (
        <EmptyState title="Sem gastos de cartão neste mês" />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-48 w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {chartData.map((entry, i) => (
                    <Cell key={entry.name} fill={CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length]} />
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
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length] }}
                  />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="shrink-0 font-medium text-slate-800">{formatCurrency(c.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function CardsTab({
  accounts,
  transactions,
  categories,
  series,
  bills,
  onCreatePurchase,
  onDeleteSeries,
  onImportFatura,
  onUpdateTransaction,
  onDeleteTransaction,
  onCreateCashExpense,
  onCloseFatura,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const cardAccounts = accounts.filter((a) => a.type === "cartao_credito");
  const purchaseSeries = series.filter((s) => s.kind === "installment");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-800">Visão gerencial dos cartões</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardsMonthlyChart accounts={accounts} transactions={transactions} />
          <CardsCategoryPieChart accounts={accounts} transactions={transactions} categories={categories} />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => setImportOpen(true)}
          disabled={cardAccounts.length === 0}
          className={secondaryButtonClass + " disabled:opacity-60"}
        >
          <Upload size={13} /> Importar fatura
        </button>
        <button
          onClick={() => setCashModalOpen(true)}
          disabled={cardAccounts.length === 0}
          className={secondaryButtonClass + " disabled:opacity-60"}
        >
          <Plus size={13} /> Compra à vista
        </button>
        <button
          onClick={() => setModalOpen(true)}
          disabled={cardAccounts.length === 0}
          className={primaryButtonClass + " !px-3 !py-1.5 text-xs disabled:opacity-60"}
        >
          <Plus size={13} /> Nova compra
        </button>
      </div>

      {cardAccounts.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum cartão cadastrado"
            description="Cadastre um cartão de crédito em Configurações → Contas e cartões."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cardAccounts.map((account) => (
            <CardSummary key={account.id} account={account} transactions={transactions} onSelect={setSelectedAccount} />
          ))}
        </div>
      )}

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Compras parceladas ativas</h3>
        {purchaseSeries.length === 0 ? (
          <EmptyState title="Nenhuma compra parcelada" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {purchaseSeries.map((s) => (
              <PurchaseProgress
                key={s.id}
                series={s}
                account={accounts.find((a) => a.id === s.accountId)}
                transactions={transactions}
                onDelete={onDeleteSeries}
              />
            ))}
          </ul>
        )}
      </Card>

      <NewPurchaseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onCreatePurchase}
        cardAccounts={cardAccounts}
        categories={categories}
      />

      <NewCashPurchaseModal
        isOpen={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        onSubmit={onCreateCashExpense}
        cardAccounts={cardAccounts}
        categories={categories}
      />

      <ImportFaturaModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        cardAccounts={cardAccounts}
        categories={categories}
        transactions={transactions}
        onImport={onImportFatura}
      />

      <CardDetailModal
        account={selectedAccount}
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        isOpen={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        onUpdate={onUpdateTransaction}
        onDelete={onDeleteTransaction}
        onDeleteSeries={onDeleteSeries}
        bills={bills}
        onCloseFatura={onCloseFatura}
      />
    </div>
  );
}
