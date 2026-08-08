import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Target, PiggyBank } from "lucide-react";
import { Card, Modal, Field, EmptyState, inputClass, primaryButtonClass, secondaryButtonClass, ProgressBar } from "./ui";
import { formatCurrency, goalProgress, colorPreset, COLOR_PRESETS } from "../domain";

function emptyForm() {
  return { name: "", targetAmount: "", currentAmount: "0", targetDate: "", colorId: "emerald" };
}

function GoalModal({ isOpen, onClose, onSubmit, initial }) {
  const [form, setForm] = useState(initial ?? emptyForm());
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (isOpen) setForm(initial ?? emptyForm());
  }, [isOpen, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Informe um nome para a meta.");
      return;
    }
    if (!form.targetAmount || Number(form.targetAmount) <= 0) {
      setError("Informe um valor alvo maior que zero.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...form,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount || 0),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={initial?.__id ? "Editar meta" : "Nova meta"} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nome da meta">
          <input
            type="text"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={`${inputClass} w-full`}
            placeholder="Ex: Viagem em família"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Valor alvo (R$)">
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={form.targetAmount}
              onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
          <Field label="Já guardado (R$)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.currentAmount}
              onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
        </div>

        <Field label="Data alvo (opcional)">
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
            className={`${inputClass} w-full`}
          />
        </Field>

        <Field label="Cor">
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, colorId: c.id }))}
                title={c.label}
                className={`h-6 w-6 rounded-full ${c.dot} ${form.colorId === c.id ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
              />
            ))}
          </div>
        </Field>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}

function AddContributionModal({ isOpen, onClose, onSubmit, goal }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (isOpen) setAmount("");
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!amount || Number(amount) === 0) {
      setError("Informe um valor.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(goal.currentAmount + Number(amount));
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={`Adicionar aporte — ${goal?.name ?? ""}`} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Valor a adicionar (R$, use negativo para retirar)">
          <input
            type="number"
            step="0.01"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputClass} w-full`}
            placeholder="0,00"
          />
        </Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}

export function GoalsTab({ goals, onCreate, onUpdate, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [contributingGoal, setContributingGoal] = useState(null);

  function openCreate() {
    setEditing(emptyForm());
    setModalOpen(true);
  }

  function openEdit(goal) {
    setEditing({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      targetDate: goal.targetDate ?? "",
      colorId: goal.colorId,
      __id: goal.id,
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
      <div className="flex justify-end">
        <button onClick={openCreate} className={primaryButtonClass + " !px-3 !py-1.5 text-xs"}>
          <Plus size={13} /> Nova meta
        </button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <EmptyState title="Nenhuma meta ainda" description="Crie uma meta de poupança para a família." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const preset = colorPreset(goal.colorId);
            const pct = goalProgress(goal);
            return (
              <Card key={goal.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${preset.chip}`}>
                      <Target size={16} />
                    </span>
                    <span className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{goal.name}</p>
                      {goal.targetDate && (
                        <p className="text-xs text-slate-400">
                          até {new Date(goal.targetDate + "T00:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => openEdit(goal)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => onDelete(goal.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <ProgressBar pct={pct} barClassName={preset.bar} />
                <p className="text-xs text-slate-500">
                  {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.targetAmount)} ({pct}%)
                </p>

                <button onClick={() => setContributingGoal(goal)} className={secondaryButtonClass + " justify-center"}>
                  <PiggyBank size={13} /> Adicionar aporte
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <GoalModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} initial={editing} />
      <AddContributionModal
        isOpen={!!contributingGoal}
        onClose={() => setContributingGoal(null)}
        goal={contributingGoal}
        onSubmit={(currentAmount) => onUpdate(contributingGoal.id, { currentAmount })}
      />
    </div>
  );
}
