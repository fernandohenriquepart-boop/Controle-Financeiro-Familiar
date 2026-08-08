import { useMemo, useState } from "react";
import { Plus, Trash2, CreditCard, TrendingUp, Upload } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Card, Modal, Field, EmptyState, inputClass, primaryButtonClass, secondaryButtonClass, ProgressBar } from "./ui";
import { ImportFaturaModal } from "./ImportFaturaModal";
import {
  formatCurrency,
  formatMonthLabel,
  transactionsInMonth,
  sumByType,
  totalBalance,
  currentMonthKey,
  shiftMonthKey,
} from "../domain";

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

function CardSummary({ account, transactions }) {
  const monthTx = transactionsInMonth(transactions, currentMonthKey()).filter((t) => t.accountId === account.id);
  const faturaAtual = sumByType(monthTx, "expense");
  const usagePct = account.creditLimit > 0 ? Math.min(100, Math.round((faturaAtual / account.creditLimit) * 100)) : 0;

  return (
    <Card className="flex flex-col gap-2">
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

function ProjectedCashFlow({ accounts, transactions }) {
  const startBalance = totalBalance(accounts, transactions);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonthKey(currentMonthKey(), i));
  let running = startBalance;
  const data = months.map((monthKey) => {
    const monthTx = transactionsInMonth(transactions, monthKey);
    const net = sumByType(monthTx, "income") - sumByType(monthTx, "expense");
    running += net;
    return { month: formatMonthLabel(monthKey).slice(0, 3), saldo: Math.round(running * 100) / 100 };
  });

  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <TrendingUp size={15} /> Fluxo de caixa projetado (12 meses)
      </h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="saldo" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function CardsTab({ accounts, transactions, categories, series, onCreatePurchase, onDeleteSeries, onImportFatura }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const cardAccounts = accounts.filter((a) => a.type === "cartao_credito");
  const purchaseSeries = series.filter((s) => s.kind === "installment");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setImportOpen(true)}
          disabled={cardAccounts.length === 0}
          className={secondaryButtonClass + " disabled:opacity-60"}
        >
          <Upload size={13} /> Importar fatura
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
            <CardSummary key={account.id} account={account} transactions={transactions} />
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

      <ProjectedCashFlow accounts={accounts} transactions={transactions} />

      <NewPurchaseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={onCreatePurchase}
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
    </div>
  );
}
