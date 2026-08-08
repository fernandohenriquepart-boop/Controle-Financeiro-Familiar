import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { Card, Modal, Field, EmptyState, Badge, inputClass, primaryButtonClass } from "./ui";
import { formatCurrency, isOverdue } from "../domain";

function emptyForm(type = "payable") {
  return {
    type,
    description: "",
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
    categoryId: "",
    accountId: "",
  };
}

function BillModal({ isOpen, onClose, onSubmit, categories, accounts, initial }) {
  const [form, setForm] = useState(initial ?? emptyForm());
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (isOpen) setForm(initial ?? emptyForm());
  }, [isOpen, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.description.trim()) {
      setError("Informe uma descrição.");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ ...form, amount: Number(form.amount) });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={initial?.__id ? "Editar conta" : "Nova conta"} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "payable" }))}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              form.type === "payable" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500"
            }`}
          >
            A pagar
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "receivable" }))}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              form.type === "receivable" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
            }`}
          >
            A receber
          </button>
        </div>

        <Field label="Descrição">
          <input
            type="text"
            required
            autoFocus
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={`${inputClass} w-full`}
            placeholder="Ex: Fatura do cartão"
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
              placeholder="0,00"
            />
          </Field>
          <Field label="Vencimento">
            <input
              type="date"
              required
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Conta/cartão">
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

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}

export function BillsTab({ bills, categories, accounts, onCreate, onUpdate, onDelete, onMarkPaid }) {
  const [filter, setFilter] = useState("payable");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const filtered = bills.filter((b) => b.type === filter);
  const pending = filtered.filter((b) => b.status === "pending");
  const paid = filtered.filter((b) => b.status === "paid");

  function openCreate() {
    setEditing(emptyForm(filter));
    setModalOpen(true);
  }

  function openEdit(bill) {
    setEditing({
      type: bill.type,
      description: bill.description,
      amount: String(bill.amount),
      dueDate: bill.dueDate,
      categoryId: bill.categoryId ?? "",
      accountId: bill.accountId ?? "",
      __id: bill.id,
    });
    setModalOpen(true);
  }

  async function handleSubmit(form) {
    const { __id, ...payload } = form;
    if (__id) {
      await onUpdate(__id, payload);
    } else {
      await onCreate(payload);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            onClick={() => setFilter("payable")}
            className={`rounded-md px-3 py-1.5 font-medium ${filter === "payable" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
          >
            A pagar
          </button>
          <button
            onClick={() => setFilter("receivable")}
            className={`rounded-md px-3 py-1.5 font-medium ${filter === "receivable" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
          >
            A receber
          </button>
        </div>
        <button onClick={openCreate} className={primaryButtonClass + " !px-3 !py-1.5 text-xs"}>
          <Plus size={13} /> Nova conta
        </button>
      </div>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Pendentes</h3>
        {pending.length === 0 ? (
          <EmptyState title="Nada pendente" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((bill) => {
              const category = categories.find((c) => c.id === bill.categoryId);
              return (
                <li key={bill.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      onClick={() => onMarkPaid(bill.id)}
                      title="Marcar como paga"
                      className="shrink-0 text-slate-300 hover:text-emerald-600"
                    >
                      <Circle size={18} />
                    </button>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{bill.description}</p>
                      <p className="truncate text-xs text-slate-400">
                        Vence {new Date(bill.dueDate + "T00:00:00").toLocaleDateString("pt-BR")}
                        {category ? ` · ${category.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isOverdue(bill) && (
                      <Badge className="border border-rose-200 bg-rose-50 text-rose-700">
                        <AlertTriangle size={11} /> Atrasada
                      </Badge>
                    )}
                    <span className="font-medium text-slate-800">{formatCurrency(bill.amount)}</span>
                    <button onClick={() => openEdit(bill)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(bill.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {paid.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Pagas/recebidas</h3>
          <ul className="divide-y divide-slate-100">
            {paid.slice(0, 10).map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-3 py-2 text-sm text-slate-400">
                <span className="flex min-w-0 items-center gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  <span className="truncate line-through">{bill.description}</span>
                </span>
                <span className="shrink-0">{formatCurrency(bill.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <BillModal
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
