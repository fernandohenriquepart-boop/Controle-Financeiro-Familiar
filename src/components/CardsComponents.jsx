import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CreditCard, TrendingUp, Upload } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import { Card, Modal, Field, EmptyState, inputClass, primaryButtonClass, secondaryButtonClass, ProgressBar } from "./ui";
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
} from "../domain";

const CARD_CHART_COLORS = ["#7c3aed", "#0891b2", "#db2777", "#059669", "#d97706", "#dc2626", "#2563eb", "#65a30d"];

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
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey ?? currentMonthKey());
  const [editing, setEditing] = useState(null);

  useMemo(() => {
    if (isOpen) setMonthKey(initialMonthKey ?? currentMonthKey());
  }, [isOpen, initialMonthKey]);

  if (!account) return null;

  const monthTx = transactionsInMonth(transactions, monthKey)
    .filter((t) => t.accountId === account.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const faturaTotal = sumByType(monthTx, "expense");
  const canEdit = Boolean(onUpdate && onDelete && accounts);

  async function handleEditSubmit(form) {
    const { __id, ...payload } = form;
    await onUpdate(__id, payload);
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
                          onClick={() => onDelete(t.id)}
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
        <TrendingUp size={15} /> Gastos por cartão (12 meses)
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

export function CardsTab({
  accounts,
  transactions,
  categories,
  series,
  onCreatePurchase,
  onDeleteSeries,
  onImportFatura,
  onUpdateTransaction,
  onDeleteTransaction,
  onCreateCashExpense,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const cardAccounts = accounts.filter((a) => a.type === "cartao_credito");
  const purchaseSeries = series.filter((s) => s.kind === "installment");

  return (
    <div className="flex flex-col gap-4">
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

      <CardsMonthlyChart accounts={accounts} transactions={transactions} />

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
      />
    </div>
  );
}
