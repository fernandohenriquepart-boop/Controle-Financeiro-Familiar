import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, UserPlus, Check, Copy } from "lucide-react";
import { Card, Modal, Field, EmptyState, Avatar, Badge, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";
import { ACCOUNT_TYPE_LABELS, COLOR_PRESETS, colorPreset, formatCurrency } from "../domain";
import { findDuplicateGroups } from "../lib/duplicates";
import { isPushSupported, getExistingSubscription, subscribeToPush, unsubscribeFromPush } from "../services/push";

// --- Nome da família -------------------------------------------------------

function HouseholdNameCard({ household, isAdmin, onUpdateName }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(household?.name ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setIsSubmitting(true);
    try {
      await onUpdateName(name);
      setEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(household?.joinCode ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">Nome da família</p>
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} mt-1 w-full`}
              autoFocus
            />
          ) : (
            <p className="truncate text-sm font-semibold text-slate-800">{household?.name}</p>
          )}
        </div>
        {isAdmin &&
          (editing ? (
            <button onClick={handleSave} disabled={isSubmitting} className={primaryButtonClass + " !px-3 !py-1.5 text-xs"}>
              <Check size={13} /> Salvar
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className={secondaryButtonClass}>
              <Pencil size={12} /> Editar
            </button>
          ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Código da família</p>
          <p className="truncate font-mono text-sm font-semibold text-slate-800">{household?.joinCode}</p>
          <p className="text-[11px] text-slate-400">Compartilhe pra alguém entrar na família na tela de criar conta.</p>
        </div>
        <button onClick={handleCopyCode} className={secondaryButtonClass}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </Card>
  );
}

// --- Lembretes de vencimento (push) ---------------------------------------

function PushRemindersCard({ household, profile }) {
  const [supported] = useState(() => isPushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supported) {
      setChecking(false);
      return;
    }
    getExistingSubscription()
      .then((sub) => setSubscribed(Boolean(sub)))
      .finally(() => setChecking(false));
  }, [supported]);

  async function handleToggle() {
    setError("");
    setIsSubmitting(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush(household.id, profile.id);
        setSubscribed(true);
      }
    } catch (err) {
      setError(err.message || "Não foi possível concluir.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">Lembretes de vencimento</p>
        <p className="text-xs text-slate-400">
          {!supported
            ? "Este navegador/aparelho não suporta notificações push."
            : subscribed
              ? "Ativado neste aparelho — avisa quando uma conta estiver perto de vencer."
              : "Receba um aviso quando uma conta estiver perto de vencer, mesmo com o app fechado."}
        </p>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
      {supported && !checking && (
        <button
          onClick={handleToggle}
          disabled={isSubmitting}
          className={subscribed ? secondaryButtonClass : primaryButtonClass + " !px-3 !py-1.5 text-xs"}
        >
          {isSubmitting ? "Aguarde..." : subscribed ? "Desativar" : "Ativar"}
        </button>
      )}
    </Card>
  );
}

// --- Membros -----------------------------------------------------------

function InviteModal({ isOpen, onClose, onInvite }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setIsSubmitting(true);
    try {
      await onInvite(email, fullName);
      setInfo("Convite enviado por e-mail.");
      setEmail("");
      setFullName("");
    } catch (err) {
      setError(err.message || "Não foi possível enviar o convite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Convidar membro da família" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nome (opcional)">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={`${inputClass} w-full`} />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} w-full`}
            placeholder="pessoa@email.com"
          />
        </Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {info && <p className="text-xs text-emerald-600">{info}</p>}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Enviando..." : "Enviar convite"}
        </button>
      </form>
    </Modal>
  );
}

function MembersCard({ members, isAdmin, onInvite }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Membros da família</h3>
        {isAdmin && (
          <button onClick={() => setInviteOpen(true)} className={secondaryButtonClass}>
            <UserPlus size={13} /> Convidar
          </button>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5 py-2">
            <Avatar name={m.fullName} emoji={m.avatarEmoji} size={28} />
            <span className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{m.fullName}</p>
            </span>
            <Badge className={m.role === "admin" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>
              {m.role === "admin" ? "Admin" : "Membro"}
            </Badge>
          </li>
        ))}
      </ul>
      <InviteModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={onInvite} />
    </Card>
  );
}

// --- Categorias --------------------------------------------------------

function emptyCategoryForm() {
  return { name: "", type: "expense", colorId: "slate" };
}

function CategoryModal({ isOpen, onClose, onSubmit, initial }) {
  const [form, setForm] = useState(initial ?? emptyCategoryForm());
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (isOpen) setForm(initial ?? emptyCategoryForm());
  }, [isOpen, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Informe um nome.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={initial?.__id ? "Editar categoria" : "Nova categoria"} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nome">
          <input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={`${inputClass} w-full`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "expense" }))}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              form.type === "expense" ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500"
            }`}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, type: "income" }))}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              form.type === "income" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
            }`}
          >
            Receita
          </button>
        </div>
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

function CategoriesCard({ categories, onCreate, onUpdate, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  function openEdit(c) {
    setEditing({ name: c.name, type: c.type, colorId: c.colorId, __id: c.id });
    setModalOpen(true);
  }

  async function handleSubmit(form) {
    const { __id, ...payload } = form;
    if (__id) await onUpdate(__id, payload);
    else await onCreate(payload);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Categorias</h3>
        <button
          onClick={() => {
            setEditing(emptyCategoryForm());
            setModalOpen(true);
          }}
          className={secondaryButtonClass}
        >
          <Plus size={13} /> Nova
        </button>
      </div>
      {categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria" />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const preset = colorPreset(c.colorId);
            return (
              <li key={c.id} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${preset.chip}`}>
                {c.name}
                <button onClick={() => openEdit(c)} className="hover:opacity-70">
                  <Pencil size={11} />
                </button>
                <button onClick={() => onDelete(c.id)} className="hover:opacity-70">
                  <Trash2 size={11} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <CategoryModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} initial={editing} />
    </Card>
  );
}

// --- Contas --------------------------------------------------------

function emptyAccountForm() {
  return { name: "", type: "corrente", initialBalance: "0", creditLimit: "", closingDay: "", dueDay: "" };
}

function AccountModal({ isOpen, onClose, onSubmit, initial }) {
  const [form, setForm] = useState(initial ?? emptyAccountForm());
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMemo(() => {
    if (isOpen) setForm(initial ?? emptyAccountForm());
  }, [isOpen, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Informe um nome.");
      return;
    }
    if (form.type === "cartao_credito" && (!form.closingDay || !form.dueDay)) {
      setError("Informe o dia de fechamento e o dia de vencimento do cartão.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...form,
        initialBalance: Number(form.initialBalance || 0),
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
        closingDay: form.closingDay ? Number(form.closingDay) : undefined,
        dueDay: form.dueDay ? Number(form.dueDay) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCard = form.type === "cartao_credito";

  return (
    <Modal title={initial?.__id ? "Editar conta" : "Nova conta"} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nome">
          <input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={`${inputClass} w-full`}
            placeholder="Ex: Conta conjunta, Cartão Nubank"
          />
        </Field>
        <Field label="Tipo">
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className={`${inputClass} w-full`}
          >
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {isCard ? (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Limite (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                className={`${inputClass} w-full`}
              />
            </Field>
            <Field label="Fecha dia">
              <input
                type="number"
                required
                min="1"
                max="31"
                value={form.closingDay}
                onChange={(e) => setForm((f) => ({ ...f, closingDay: e.target.value }))}
                className={`${inputClass} w-full`}
              />
            </Field>
            <Field label="Vence dia">
              <input
                type="number"
                required
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))}
                className={`${inputClass} w-full`}
              />
            </Field>
          </div>
        ) : (
          <Field label="Saldo inicial (R$)">
            <input
              type="number"
              step="0.01"
              value={form.initialBalance}
              onChange={(e) => setForm((f) => ({ ...f, initialBalance: e.target.value }))}
              className={`${inputClass} w-full`}
            />
          </Field>
        )}

        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </Modal>
  );
}

function AccountsCard({ accounts, onCreate, onUpdate, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  function openEdit(a) {
    setEditing({
      name: a.name,
      type: a.type,
      initialBalance: String(a.initialBalance),
      creditLimit: a.creditLimit != null ? String(a.creditLimit) : "",
      closingDay: a.closingDay != null ? String(a.closingDay) : "",
      dueDay: a.dueDay != null ? String(a.dueDay) : "",
      __id: a.id,
    });
    setModalOpen(true);
  }

  async function handleSubmit(form) {
    const { __id, ...payload } = form;
    if (__id) await onUpdate(__id, payload);
    else await onCreate(payload);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Contas e cartões</h3>
        <button
          onClick={() => {
            setEditing(emptyAccountForm());
            setModalOpen(true);
          }}
          className={secondaryButtonClass}
        >
          <Plus size={13} /> Nova
        </button>
      </div>
      {accounts.length === 0 ? (
        <EmptyState title="Nenhuma conta cadastrada" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{a.name}</p>
                <p className="text-xs text-slate-400">{ACCOUNT_TYPE_LABELS[a.type]}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => openEdit(a)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(a.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AccountModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} initial={editing} />
    </Card>
  );
}

// --- Duplicatas ----------------------------------------------------------

function DuplicatesCard({ transactions, categories, accounts, onDelete }) {
  const groups = useMemo(() => findDuplicateGroups(transactions), [transactions]);

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Possíveis duplicatas</h3>
      <p className="mb-3 text-xs text-slate-400">
        Lançamentos com mesmo tipo, conta, data e valor — confira e apague as cópias que não deviam estar aqui.
      </p>
      {groups.length === 0 ? (
        <EmptyState title="Nenhuma duplicata encontrada" />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group, i) => {
            const first = group[0];
            const category = categories.find((c) => c.id === first.categoryId);
            const account = accounts.find((a) => a.id === first.accountId);
            return (
              <li key={i} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                <p className="mb-1.5 text-xs font-medium text-amber-700">
                  {group.length} lançamentos iguais · {new Date(first.date + "T00:00:00").toLocaleDateString("pt-BR")} ·{" "}
                  {formatCurrency(first.amount)}
                  {account ? ` · ${account.name}` : ""}
                  {category ? ` · ${category.name}` : ""}
                </p>
                <ul className="divide-y divide-amber-100">
                  {group.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{t.description || "Sem descrição"}</span>
                      <button
                        onClick={() => onDelete(t.id)}
                        className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function SettingsTab({
  household,
  profile,
  members,
  categories,
  accounts,
  transactions,
  onDeleteTransaction,
  onUpdateHouseholdName,
  onInvite,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
}) {
  const isAdmin = profile?.role === "admin";
  return (
    <div className="flex flex-col gap-4">
      <HouseholdNameCard household={household} isAdmin={isAdmin} onUpdateName={onUpdateHouseholdName} />
      <PushRemindersCard household={household} profile={profile} />
      <MembersCard members={members} isAdmin={isAdmin} onInvite={onInvite} />
      <CategoriesCard categories={categories} onCreate={onCreateCategory} onUpdate={onUpdateCategory} onDelete={onDeleteCategory} />
      <AccountsCard accounts={accounts} onCreate={onCreateAccount} onUpdate={onUpdateAccount} onDelete={onDeleteAccount} />
      <DuplicatesCard transactions={transactions} categories={categories} accounts={accounts} onDelete={onDeleteTransaction} />
    </div>
  );
}
