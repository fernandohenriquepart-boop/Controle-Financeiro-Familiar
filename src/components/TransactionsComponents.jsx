import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { Card, Modal, Field, EmptyState, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";
import { DocumentScanButton } from "./DocumentScanButton";
import { formatCurrency, transactionsInMonth, colorPreset, toDateInputValue } from "../domain";

function emptyForm(type = "expense") {
  return {
    type,
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    categoryId: "",
    accountId: "",
  };
}

function TransactionModal({ isOpen, onClose, onSubmit, categories, accounts, initial }) {
  const [form, setForm] = useState(initial ?? emptyForm());
  const [repeats, setRepeats] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = Boolean(initial?.__id);

  useMemo(() => {
    if (isOpen) {
      setForm(initial ?? emptyForm());
      setRepeats(false);
      setRepeatMonths("");
    }
  }, [isOpen, initial]);

  const filteredCategories = categories.filter((c) => c.type === form.type);

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
      await onSubmit({ ...form, amount: Number(form.amount) }, recurring);
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

        {!isEditing && (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={repeats}
                onChange={(e) => setRepeats(e.target.checked)}
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

export function TransactionsTab({ transactions, categories, accounts, monthKey, onCreate, onCreateRecurring, onUpdate, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const monthTx = transactionsInMonth(transactions, monthKey);

  function openCreate(type) {
    setEditing({ __new: true, ...emptyForm(type) });
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditing({
      type: t.type,
      amount: String(t.amount),
      description: t.description,
      date: t.date,
      categoryId: t.categoryId ?? "",
      accountId: t.accountId ?? "",
      __id: t.id,
    });
    setModalOpen(true);
  }

  async function handleSubmit(form, recurring) {
    const { __id, __new, ...payload } = form;
    if (__id) {
      await onUpdate(__id, payload);
    } else if (recurring) {
      await onCreateRecurring(payload, recurring.months);
    } else {
      await onCreate(payload);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => openCreate("expense")} className={secondaryButtonClass}>
          <Plus size={13} /> Despesa
        </button>
        <button onClick={() => openCreate("income")} className={primaryButtonClass + " !px-3 !py-1.5 text-xs"}>
          <Plus size={13} /> Receita
        </button>
      </div>

      <Card>
        {monthTx.length === 0 ? (
          <EmptyState title="Nenhum lançamento neste mês" description="Adicione uma receita ou despesa para começar." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {monthTx.map((t) => {
              const category = categories.find((c) => c.id === t.categoryId);
              const account = accounts.find((a) => a.id === t.accountId);
              const preset = colorPreset(category?.colorId);
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${preset.chip}`}>
                      {t.type === "income" ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{t.description || category?.name || "Lançamento"}</p>
                      <p className="truncate text-xs text-slate-400">
                        {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {category ? ` · ${category.name}` : ""}
                        {account ? ` · ${account.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(t.amount)}
                    </span>
                    <button onClick={() => openEdit(t)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
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
      </Card>

      <TransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        categories={categories}
        accounts={accounts}
        initial={editing}
      />
    </div>
  );
}
