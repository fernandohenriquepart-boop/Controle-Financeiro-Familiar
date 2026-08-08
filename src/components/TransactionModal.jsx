import { useMemo, useState } from "react";
import { ArrowUpCircle, ArrowDownCircle, CreditCard } from "lucide-react";
import { Modal, Field, inputClass, primaryButtonClass } from "./ui";
import { DocumentScanButton } from "./DocumentScanButton";
import { toDateInputValue, emptyTransactionForm as emptyForm } from "../domain";
import { billingDueDate } from "../lib/installments";

// Formulário de criar/editar lançamento — compartilhado entre a aba
// Lançamentos e o detalhe de um cartão (Lançamentos Cartões), pra manter uma
// única forma de editar uma transação em todo o app.

export function TransactionModal({ isOpen, onClose, onSubmit, categories, accounts, initial }) {
  const [form, setForm] = useState(initial ?? emptyForm());
  const [repeats, setRepeats] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState("");
  const [isFixed, setIsFixed] = useState(initial?.isFixed ?? false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(initial?.__id);

  useMemo(() => {
    if (isOpen) {
      setForm(initial ?? emptyForm());
      setRepeats(false);
      setRepeatMonths("");
      setIsFixed(initial?.isFixed ?? false);
    }
  }, [isOpen, initial]);

  function handleRepeatsChange(checked) {
    setRepeats(checked);
    if (checked) setIsFixed(true); // recorrência normalmente é despesa fixa — só um empurrão inicial, dá pra desmarcar
  }

  const filteredCategories = categories.filter((c) => c.type === form.type);
  const selectedAccount = accounts.find((a) => a.id === form.accountId);
  const isCardAccount = selectedAccount?.type === "cartao_credito";
  const cardBillingDate =
    isCardAccount && form.date && selectedAccount.closingDay && selectedAccount.dueDay
      ? billingDueDate(new Date(form.date + "T00:00:00"), selectedAccount.closingDay, selectedAccount.dueDay)
      : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setIsSubmitting(true);
    try {
      const recurring = !isEditing && repeats ? { months: repeatMonths ? Number(repeatMonths) : null } : null;
      const date = cardBillingDate ? toDateInputValue(cardBillingDate) : form.date;
      await onSubmit({ ...form, amount: Number(form.amount), date, isFixed }, recurring);
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={initial ? "Editar lançamento" : "Novo lançamento"} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "expense", categoryId: "" }))}
            className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
              form.type === "expense" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500"
            }`}
          >
            <ArrowDownCircle size={15} /> Despesa
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "income", categoryId: "" }))}
            className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
              form.type === "income" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
            }`}
          >
            <ArrowUpCircle size={15} /> Receita
          </button>
        </div>

        {form.type === "expense" && (
          <DocumentScanButton
            label="Escanear recibo"
            onExtracted={(result) => {
              setForm((f) => ({
                ...f,
                amount: result.amount != null ? String(result.amount) : f.amount,
                date: result.date ? toDateInputValue(result.date) : f.date,
                description: result.description ?? f.description,
              }));
            }}
          />
        )}

        <Field label="Valor (R$)">
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className={`${inputClass} w-full`}
            placeholder="0,00"
            autoFocus
          />
        </Field>

        <Field label="Descrição">
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={`${inputClass} w-full`}
            placeholder="Ex: Supermercado"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Data">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={`${inputClass} w-full`}
            />
            {cardBillingDate && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <CreditCard size={11} /> Cai na fatura de {cardBillingDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </span>
            )}
          </Field>
          <Field label="Categoria">
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className={`${inputClass} w-full`}
            >
              <option value="">Sem categoria</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Conta">
          <select
            value={form.accountId}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            className={`${inputClass} w-full`}
          >
            <option value="">Sem conta</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isFixed}
            onChange={(e) => setIsFixed(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Despesa fixa (aluguel, assinatura...)
        </label>

        {!isEditing && (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={repeats}
                onChange={(e) => handleRepeatsChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Repete nos próximos meses?
            </label>
            {repeats && (
              <Field label="Por quantos meses? (deixe em branco para sem fim)">
                <input
                  type="number"
                  min="2"
                  max="240"
                  step="1"
                  value={repeatMonths}
                  onChange={(e) => setRepeatMonths(e.target.value)}
                  className={`${inputClass} w-full`}
                  placeholder="Sem fim"
                />
              </Field>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}
