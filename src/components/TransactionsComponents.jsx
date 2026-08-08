import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, CreditCard, ChevronRight } from "lucide-react";
import { Card, EmptyState, secondaryButtonClass, primaryButtonClass } from "./ui";
import { CardDetailModal } from "./CardsComponents";
import { TransactionModal } from "./TransactionModal";
import { formatCurrency, transactionsInMonth, sumByType, colorPreset, emptyTransactionForm as emptyForm, buildEditPayload } from "../domain";

export function TransactionsTab({ transactions, categories, accounts, monthKey, onCreate, onCreateRecurring, onUpdate, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedCardAccount, setSelectedCardAccount] = useState(null);

  const monthTx = transactionsInMonth(transactions, monthKey);
  const cardAccountIds = new Set(accounts.filter((a) => a.type === "cartao_credito").map((a) => a.id));
  const otherTx = monthTx.filter((t) => !cardAccountIds.has(t.accountId));
  const cardGroups = accounts
    .filter((a) => cardAccountIds.has(a.id))
    .map((a) => ({ account: a, total: sumByType(monthTx.filter((t) => t.accountId === a.id), "expense") }))
    .filter((g) => g.total > 0);

  function openCreate(type) {
    setEditing({ __new: true, ...emptyForm(type) });
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditing(buildEditPayload(t));
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

      {cardGroups.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Cartões</h3>
          <ul className="divide-y divide-slate-100">
            {cardGroups.map(({ account, total }) => (
              <li key={account.id}>
                <button
                  onClick={() => setSelectedCardAccount(account)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                      <CreditCard size={15} />
                    </span>
                    <p className="truncate font-medium text-slate-800">{account.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="font-medium text-rose-600">{formatCurrency(total)}</span>
                    <ChevronRight size={15} className="text-slate-300" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        {monthTx.length === 0 ? (
          <EmptyState title="Nenhum lançamento neste mês" description="Adicione uma receita ou despesa para começar." />
        ) : otherTx.length === 0 ? (
          <EmptyState title="Só lançamentos de cartão neste mês" description="Veja os detalhes acima, em Cartões." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {otherTx.map((t) => {
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

      <CardDetailModal
        account={selectedCardAccount}
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        isOpen={!!selectedCardAccount}
        onClose={() => setSelectedCardAccount(null)}
        initialMonthKey={monthKey}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}
