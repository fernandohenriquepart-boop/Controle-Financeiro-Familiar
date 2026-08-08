import { useState } from "react";
import { Pencil, AlertTriangle } from "lucide-react";
import { Card, Modal, Field, EmptyState, inputClass, primaryButtonClass, ProgressBar } from "./ui";
import { formatCurrency, transactionsInMonth, budgetUsage, colorPreset } from "../domain";

function BudgetModal({ isOpen, onClose, onSubmit, category, initialLimit }) {
  const [limit, setLimit] = useState(initialLimit ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!limit || Number(limit) < 0) {
      setError("Informe um valor válido.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(Number(limit));
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={`Orçamento — ${category?.name ?? ""}`} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Limite mensal (R$)">
          <input
            type="number"
            required
            min="0"
            step="0.01"
            autoFocus
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
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

export function BudgetsTab({ categories, budgets, transactions, monthKey, onSetBudget }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const monthTx = transactionsInMonth(transactions, monthKey);
  const usage = budgetUsage(budgets, monthTx, categories);

  const rows = expenseCategories.map((category) => {
    const existing = usage.find((u) => u.categoryId === category.id);
    const spent = monthTx
      .filter((t) => t.type === "expense" && t.categoryId === category.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return existing ?? { categoryId: category.id, category, limitAmount: 0, spent, pct: 0, overBudget: false, id: null };
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma categoria de despesa" description="Crie categorias em Configurações." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const preset = colorPreset(row.category?.colorId);
              return (
                <li key={row.categoryId} className="flex flex-col gap-1.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <span className={`h-2 w-2 rounded-full ${preset.dot}`} />
                      {row.category?.name}
                      {row.overBudget && (
                        <span title="Acima do orçamento" className="text-rose-500">
                          <AlertTriangle size={13} />
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => setEditingCategory(row.category)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-700"
                    >
                      <Pencil size={12} />
                      {row.limitAmount > 0 ? "Editar" : "Definir limite"}
                    </button>
                  </div>
                  {row.limitAmount > 0 ? (
                    <>
                      <ProgressBar pct={row.pct} barClassName={row.overBudget ? "bg-rose-500" : preset.bar} />
                      <p className="text-xs text-slate-500">
                        {formatCurrency(row.spent)} de {formatCurrency(row.limitAmount)} ({row.pct}%)
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Sem orçamento definido · gasto no mês: {formatCurrency(row.spent)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <BudgetModal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        category={editingCategory}
        initialLimit={rows.find((r) => r.categoryId === editingCategory?.id)?.limitAmount || ""}
        onSubmit={(limitAmount) => onSetBudget(editingCategory.id, limitAmount)}
      />
    </div>
  );
}
