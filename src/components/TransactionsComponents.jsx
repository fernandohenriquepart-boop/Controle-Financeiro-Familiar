import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, CreditCard, ChevronRight, Tag, Receipt, CalendarPlus } from "lucide-react";
import { Card, Modal, EmptyState, Badge, inputClass, secondaryButtonClass, primaryButtonClass } from "./ui";
import { CardDetailModal } from "./CardsComponents";
import { TransactionModal } from "./TransactionModal";
import { BillModal } from "./BillsComponents";
import {
  formatCurrency,
  formatMonthLabel,
  transactionsInMonth,
  sumByType,
  colorPreset,
  emptyTransactionForm as emptyForm,
  buildEditPayload,
} from "../domain";

function groupTransactionsByCategory(txs, categories) {
  const map = new Map();
  for (const t of txs) {
    const key = t.categoryId || "none";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return [...map.entries()]
    .map(([key, groupTxs]) => ({
      key,
      category: key === "none" ? null : categories.find((c) => c.id === key),
      txs: groupTxs,
      total: groupTxs.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0),
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function CategoryGroupsCard({ title, groups, onSelect }) {
  if (groups.length === 0) return null;
  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="divide-y divide-slate-100">
        {groups.map(({ key, category, txs, total }) => {
          const preset = colorPreset(category?.colorId);
          return (
            <li key={key}>
              <button
                onClick={() => onSelect(key)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${preset.chip}`}>
                    <Tag size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{category?.name ?? "Sem categoria"}</p>
                    <p className="text-xs text-slate-400">
                      {txs.length} lançamento{txs.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`font-medium ${total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(total)}</span>
                  <ChevronRight size={15} className="text-slate-300" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function CategoryDetailModal({
  category,
  transactions,
  categories,
  accounts,
  monthKey,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onCreateBill,
  bills,
  onReplicate,
}) {
  const [editing, setEditing] = useState(null);
  const [billDraft, setBillDraft] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateMonths, setReplicateMonths] = useState("3");
  const [isReplicating, setIsReplicating] = useState(false);

  const txs = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = txs.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
  const preset = colorPreset(category?.colorId);
  const isExpenseGroup = category ? category.type === "expense" : total < 0;
  const canCreateBill = Boolean(onCreateBill && isExpenseGroup && total !== 0);
  const existingBill = bills?.find(
    (b) => b.type === "payable" && (b.categoryId ?? "") === (category?.id ?? "") && b.dueDate?.slice(0, 7) === monthKey?.slice(0, 7)
  );

  async function handleEditSubmit(form, _recurring, applyScope) {
    const { __id, ...payload } = form;
    await onUpdate(__id, payload, applyScope);
  }

  function openBillDraft() {
    setSuccessMessage("");
    setBillDraft({
      type: "payable",
      description: `${category?.name ?? "Sem categoria"} — ${formatMonthLabel(monthKey)}`,
      amount: String(Math.abs(total)),
      dueDate: new Date().toISOString().slice(0, 10),
      categoryId: category?.id ?? "",
      accountId: "",
    });
  }

  async function handleCreateBill(payload) {
    await onCreateBill(payload);
    setSuccessMessage("Conta a pagar lançada com sucesso.");
  }

  async function handleReplicate() {
    const months = Math.max(1, Math.round(Number(replicateMonths) || 0));
    setIsReplicating(true);
    try {
      await onReplicate(txs, months);
      setSuccessMessage(`Replicado para os próximos ${months} ${months === 1 ? "mês" : "meses"}.`);
      setReplicateOpen(false);
    } finally {
      setIsReplicating(false);
    }
  }

  return (
    <Modal title={category?.name ?? "Sem categoria"} isOpen={isOpen} onClose={onClose} wide>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Total: <span className={`font-semibold ${total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(total)}</span>
          </p>
          <div className="flex items-center gap-2">
            {onReplicate && txs.length > 0 && (
              <button onClick={() => setReplicateOpen((v) => !v)} className={secondaryButtonClass}>
                <CalendarPlus size={13} /> Replicar para os próximos meses
              </button>
            )}
            {canCreateBill &&
              (existingBill ? (
                <Badge className="border border-amber-200 bg-amber-50 text-amber-700">Já lançada este mês</Badge>
              ) : (
                <button onClick={openBillDraft} className={secondaryButtonClass}>
                  <Receipt size={13} /> Lançar como conta a pagar
                </button>
              ))}
          </div>
        </div>

        {replicateOpen && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 p-2.5">
            <span className="text-xs text-slate-500">Replicar {txs.length} lançamento{txs.length !== 1 ? "s" : ""} por quantos meses?</span>
            <input
              type="number"
              min="1"
              max="60"
              step="1"
              value={replicateMonths}
              onChange={(e) => setReplicateMonths(e.target.value)}
              className={`${inputClass} !w-16`}
            />
            <button onClick={handleReplicate} disabled={isReplicating} className={secondaryButtonClass + " disabled:opacity-60"}>
              {isReplicating ? "Replicando..." : "Confirmar"}
            </button>
          </div>
        )}

        {successMessage && <p className="text-xs font-medium text-emerald-600">{successMessage}</p>}

        {txs.length === 0 ? (
          <EmptyState title="Nenhum lançamento" />
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {txs.map((t) => {
              const account = accounts.find((a) => a.id === t.accountId);
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${preset.chip}`}>
                      {t.type === "income" ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{t.description || "Lançamento"}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {account ? ` · ${account.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(t.amount)}
                    </span>
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TransactionModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleEditSubmit}
        categories={categories}
        accounts={accounts}
        initial={editing}
      />

      {canCreateBill && (
        <BillModal
          isOpen={!!billDraft}
          onClose={() => setBillDraft(null)}
          onSubmit={handleCreateBill}
          categories={categories}
          accounts={accounts}
          initial={billDraft}
        />
      )}
    </Modal>
  );
}

export function TransactionsTab({
  transactions,
  categories,
  accounts,
  monthKey,
  onCreate,
  onCreateRecurring,
  onUpdate,
  onDelete,
  onDeleteSeries,
  bills,
  onCloseFatura,
  onCreateBill,
  onReplicate,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedCardAccount, setSelectedCardAccount] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null); // { kind: "fixed" | "variable", key }
  const [fixedFilter, setFixedFilter] = useState("all"); // "all" | "fixed" | "variable"

  const monthTxAll = transactionsInMonth(transactions, monthKey);
  const monthTx = monthTxAll.filter((t) => {
    if (fixedFilter === "fixed") return t.isFixed;
    if (fixedFilter === "variable") return !t.isFixed;
    return true;
  });
  const cardAccountIds = new Set(accounts.filter((a) => a.type === "cartao_credito").map((a) => a.id));
  const otherTx = monthTx.filter((t) => !cardAccountIds.has(t.accountId));
  const cardGroups = accounts
    .filter((a) => cardAccountIds.has(a.id))
    .map((a) => ({ account: a, total: sumByType(monthTx.filter((t) => t.accountId === a.id), "expense") }))
    .filter((g) => g.total > 0);

  const fixedTx = otherTx.filter((t) => t.isFixed);
  const variableTx = otherTx.filter((t) => !t.isFixed);
  const fixedCategoryGroups = groupTransactionsByCategory(fixedTx, categories);
  const variableCategoryGroups = groupTransactionsByCategory(variableTx, categories);
  const selectedCategoryGroup = selectedGroup
    ? (selectedGroup.kind === "fixed" ? fixedCategoryGroups : variableCategoryGroups).find((g) => g.key === selectedGroup.key) ?? null
    : null;

  function openCreate(type) {
    setEditing({ __new: true, ...emptyForm(type) });
    setModalOpen(true);
  }

  async function handleSubmit(form, recurring, applyScope) {
    const { __id, __new, ...payload } = form;
    if (__id) {
      await onUpdate(__id, payload, applyScope);
    } else if (recurring) {
      await onCreateRecurring(payload, recurring.months);
    } else {
      await onCreate(payload);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {[
            { id: "all", label: "Todas" },
            { id: "fixed", label: "Fixas" },
            { id: "variable", label: "Variáveis" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFixedFilter(opt.id)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                fixedFilter === opt.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => openCreate("expense")} className={secondaryButtonClass}>
            <Plus size={13} /> Despesa
          </button>
          <button onClick={() => openCreate("income")} className={primaryButtonClass + " !px-3 !py-1.5 text-xs"}>
            <Plus size={13} /> Receita
          </button>
        </div>
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

      {monthTxAll.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum lançamento neste mês" description="Adicione uma receita ou despesa para começar." />
        </Card>
      ) : monthTx.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum lançamento com esse filtro" description="Troque para 'Todas' pra ver os lançamentos do mês." />
        </Card>
      ) : otherTx.length === 0 ? (
        <Card>
          <EmptyState title="Só lançamentos de cartão neste mês" description="Veja os detalhes acima, em Cartões." />
        </Card>
      ) : (
        <>
          <CategoryGroupsCard
            title="Despesa Fixa"
            groups={fixedCategoryGroups}
            onSelect={(key) => setSelectedGroup({ kind: "fixed", key })}
          />
          <CategoryGroupsCard
            title="Despesa Variável"
            groups={variableCategoryGroups}
            onSelect={(key) => setSelectedGroup({ kind: "variable", key })}
          />
        </>
      )}

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
        onDeleteSeries={onDeleteSeries}
        bills={bills}
        onCloseFatura={onCloseFatura}
      />

      <CategoryDetailModal
        category={selectedCategoryGroup?.category}
        transactions={selectedCategoryGroup?.txs ?? []}
        categories={categories}
        accounts={accounts}
        monthKey={monthKey}
        isOpen={!!selectedCategoryGroup}
        onClose={() => setSelectedGroup(null)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onCreateBill={onCreateBill}
        bills={bills}
        onReplicate={onReplicate}
      />
    </div>
  );
}
