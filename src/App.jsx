import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Receipt, PieChart, CalendarClock, Target, Settings, CreditCard, X } from "lucide-react";
import { currentMonthKey, shiftMonthKey } from "./domain";
import { getSession, onAuthStateChange, fetchProfile, signOut, inviteMember as inviteMemberApi } from "./services/auth";
import * as householdsApi from "./services/households";
import * as accountsApi from "./services/accounts";
import * as categoriesApi from "./services/categories";
import * as transactionsApi from "./services/transactions";
import * as budgetsApi from "./services/budgets";
import * as billsApi from "./services/bills";
import * as goalsApi from "./services/goals";
import * as recurringSeriesApi from "./services/recurringSeries";
import { LoginScreen } from "./components/AuthComponents";
import { DesktopSidebar, MobileTopBar, MobileNavDrawer } from "./components/Navigation";
import { DashboardTab, MonthSwitcher } from "./components/DashboardComponents";
import { TransactionsTab } from "./components/TransactionsComponents";
import { BudgetsTab } from "./components/BudgetsComponents";
import { BillsTab } from "./components/BillsComponents";
import { GoalsTab } from "./components/GoalsComponents";
import { CardsTab } from "./components/CardsComponents";
import { SettingsTab } from "./components/SettingsComponents";

const TABS = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard },
  { id: "transactions", label: "Lançamentos", icon: Receipt },
  { id: "cards", label: "Lançamentos Cartões", icon: CreditCard },
  { id: "budgets", label: "Orçamentos", icon: PieChart },
  { id: "bills", label: "Contas", icon: CalendarClock },
  { id: "goals", label: "Metas", icon: Target },
  { id: "settings", label: "Configurações", icon: Settings },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async (nextSession) => {
    if (!nextSession) {
      setProfile(null);
      return;
    }
    try {
      setProfileError(null);
      const data = await fetchProfile(nextSession.user.id);
      setProfile(data);
    } catch (err) {
      setProfileError(err.message || "Não foi possível carregar seu perfil.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const current = await getSession();
      if (cancelled) return;
      setSession(current);
      await loadProfile(current);
      if (!cancelled) setIsAuthLoading(false);
    }
    init();
    const subscription = onAuthStateChange((nextSession) => {
      setSession(nextSession);
      loadProfile(nextSession);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [series, setSeries] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const [tab, setTab] = useState("dashboard");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(currentMonthKey());

  const flashSyncError = useCallback((err) => {
    console.error(err);
    setSyncError(err?.message || "Falha ao sincronizar com o servidor. Tente novamente.");
    setTimeout(() => setSyncError(null), 5000);
  }, []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    async function load() {
      try {
        const [householdData, membersData, accountsData, categoriesData, transactionsData, billsData, goalsData, seriesData] =
          await Promise.all([
            householdsApi.fetchHousehold(profile.household_id),
            householdsApi.fetchMembers(profile.household_id),
            accountsApi.fetchAccounts(profile.household_id),
            categoriesApi.fetchCategories(profile.household_id),
            transactionsApi.fetchTransactions(profile.household_id),
            billsApi.fetchBills(profile.household_id),
            goalsApi.fetchGoals(profile.household_id),
            recurringSeriesApi.fetchSeries(profile.household_id),
          ]);
        if (cancelled) return;
        setHousehold(householdData);
        setMembers(membersData);
        setAccounts(accountsData);
        setCategories(categoriesData);
        setTransactions(transactionsData);
        setBills(billsData);
        setGoals(goalsData);
        setSeries(seriesData);

        // Completa recorrências "sem fim" que estejam ficando sem meses futuros
        // gerados, então recarrega só o que pode ter mudado.
        await recurringSeriesApi.extendIndefiniteSeries(profile.household_id);
        if (cancelled) return;
        const [refreshedTransactions, refreshedSeries] = await Promise.all([
          transactionsApi.fetchTransactions(profile.household_id),
          recurringSeriesApi.fetchSeries(profile.household_id),
        ]);
        if (cancelled) return;
        setTransactions(refreshedTransactions);
        setSeries(refreshedSeries);
      } catch (err) {
        if (!cancelled) flashSyncError(err);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile, flashSyncError]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    budgetsApi
      .fetchBudgets(profile.household_id, monthKey)
      .then((data) => !cancelled && setBudgets(data))
      .catch((err) => !cancelled && flashSyncError(err));
    return () => {
      cancelled = true;
    };
  }, [profile, monthKey, flashSyncError]);

  // --- Lançamentos -----------------------------------------------------
  async function createTransaction(draft) {
    try {
      const created = await transactionsApi.insertTransaction(
        { ...draft, createdBy: profile.id },
        profile.household_id
      );
      setTransactions((prev) => [created, ...prev]);
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function editTransaction(id, changes) {
    try {
      await transactionsApi.updateTransaction(id, changes);
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function removeTransaction(id) {
    try {
      await transactionsApi.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      flashSyncError(err);
    }
  }

  async function refreshTransactionsAndSeries() {
    const [t, s] = await Promise.all([
      transactionsApi.fetchTransactions(profile.household_id),
      recurringSeriesApi.fetchSeries(profile.household_id),
    ]);
    setTransactions(t);
    setSeries(s);
  }

  async function createRecurringTransaction(draft, months) {
    try {
      await recurringSeriesApi.createRecurringTransaction(
        { ...draft, startDate: draft.date, count: months },
        profile.household_id
      );
      await refreshTransactionsAndSeries();
    } catch (err) {
      flashSyncError(err);
    }
  }

  // --- Lançamentos Cartões -----------------------------------------------
  async function createCardPurchase(draft) {
    try {
      const account = accounts.find((a) => a.id === draft.accountId);
      await recurringSeriesApi.createInstallmentPurchase(
        { ...draft, dueDay: account?.dueDay ?? new Date(draft.purchaseDate).getDate() },
        profile.household_id
      );
      await refreshTransactionsAndSeries();
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function removeSeries(id) {
    try {
      await recurringSeriesApi.deleteSeries(id);
      setSeries((prev) => prev.filter((s) => s.id !== id));
      setTransactions((prev) => prev.filter((t) => t.seriesId !== id));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function importFaturaTransactions({ plainTransactions, installmentPurchases }) {
    if (plainTransactions.length > 0) {
      await transactionsApi.insertTransactionsBulk(
        plainTransactions.map((t) => ({ ...t, type: "expense", isRecurring: false })),
        profile.household_id
      );
    }
    for (const purchase of installmentPurchases) {
      await recurringSeriesApi.createInstallmentPurchaseFromImport(purchase, profile.household_id);
    }
    await refreshTransactionsAndSeries();
  }

  // --- Orçamentos --------------------------------------------------------
  async function setBudget(categoryId, limitAmount) {
    try {
      await budgetsApi.upsertBudget({ categoryId, month: monthKey, limitAmount }, profile.household_id);
      const refreshed = await budgetsApi.fetchBudgets(profile.household_id, monthKey);
      setBudgets(refreshed);
    } catch (err) {
      flashSyncError(err);
    }
  }

  // --- Contas a pagar/receber -----------------------------------------
  async function createBill(draft) {
    try {
      const created = await billsApi.insertBill(draft, profile.household_id);
      setBills((prev) => [...prev, created].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function editBill(id, changes) {
    try {
      await billsApi.updateBill(id, changes);
      setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...changes } : b)));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function removeBill(id) {
    try {
      await billsApi.deleteBill(id);
      setBills((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function markBillPaid(id) {
    const paidAt = new Date().toISOString();
    try {
      await billsApi.markBillPaid(id, paidAt);
      setBills((prev) => prev.map((b) => (b.id === id ? { ...b, status: "paid", paidAt } : b)));
    } catch (err) {
      flashSyncError(err);
    }
  }

  // --- Metas -----------------------------------------------------------
  async function createGoal(draft) {
    try {
      const created = await goalsApi.insertGoal(draft, profile.household_id);
      setGoals((prev) => [...prev, created]);
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function editGoal(id, changes) {
    try {
      await goalsApi.updateGoal(id, changes);
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...changes } : g)));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function removeGoal(id) {
    try {
      await goalsApi.deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      flashSyncError(err);
    }
  }

  // --- Configurações -----------------------------------------------------
  async function updateHouseholdName(name) {
    try {
      await householdsApi.updateHouseholdName(profile.household_id, name);
      setHousehold((prev) => ({ ...prev, name }));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function inviteMember(email, fullName) {
    await inviteMemberApi(email, fullName);
  }
  async function createCategory(draft) {
    try {
      const created = await categoriesApi.insertCategory(draft, profile.household_id);
      setCategories((prev) => [...prev, created]);
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function editCategory(id, changes) {
    try {
      await categoriesApi.updateCategory(id, changes);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function removeCategory(id) {
    try {
      await categoriesApi.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function createAccount(draft) {
    try {
      const created = await accountsApi.insertAccount(draft, profile.household_id);
      setAccounts((prev) => [...prev, created]);
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function editAccount(id, changes) {
    try {
      await accountsApi.updateAccount(id, changes);
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
    } catch (err) {
      flashSyncError(err);
    }
  }
  async function removeAccount(id) {
    try {
      await accountsApi.deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      flashSyncError(err);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 text-sm text-slate-400">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900">
        <LoginScreen />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-rose-600">{profileError}</p>
        <button
          onClick={() => loadProfile(session)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Tentar novamente
        </button>
        <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600">
          Sair
        </button>
      </div>
    );
  }

  if (!profile || !isHydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 text-sm text-slate-400">
        Carregando dados da família...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900 md:flex-row">
      <DesktopSidebar tabs={TABS} activeTab={tab} onSelect={setTab} household={household} profile={profile} onSignOut={signOut} />
      <MobileTopBar household={household} onOpenDrawer={() => setIsDrawerOpen(true)} />

      <div className="flex min-h-0 flex-1 flex-col">
        {syncError && (
          <div className="flex items-center justify-between gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-rose-100">
              <X size={13} />
            </button>
          </div>
        )}

        {["dashboard", "transactions", "budgets"].includes(tab) && (
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">{TABS.find((t) => t.id === tab)?.label}</h2>
            <MonthSwitcher monthKey={monthKey} onChange={(delta) => setMonthKey((m) => shiftMonthKey(m, delta))} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "dashboard" ? (
            <DashboardTab accounts={accounts} transactions={transactions} categories={categories} bills={bills} monthKey={monthKey} />
          ) : tab === "transactions" ? (
            <TransactionsTab
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              monthKey={monthKey}
              onCreate={createTransaction}
              onCreateRecurring={createRecurringTransaction}
              onUpdate={editTransaction}
              onDelete={removeTransaction}
            />
          ) : tab === "cards" ? (
            <CardsTab
              accounts={accounts}
              transactions={transactions}
              categories={categories}
              series={series}
              onCreatePurchase={createCardPurchase}
              onDeleteSeries={removeSeries}
              onImportFatura={importFaturaTransactions}
              onUpdateTransaction={editTransaction}
              onDeleteTransaction={removeTransaction}
            />
          ) : tab === "budgets" ? (
            <BudgetsTab categories={categories} budgets={budgets} transactions={transactions} monthKey={monthKey} onSetBudget={setBudget} />
          ) : tab === "bills" ? (
            <BillsTab
              bills={bills}
              categories={categories}
              accounts={accounts}
              onCreate={createBill}
              onUpdate={editBill}
              onDelete={removeBill}
              onMarkPaid={markBillPaid}
            />
          ) : tab === "goals" ? (
            <GoalsTab goals={goals} onCreate={createGoal} onUpdate={editGoal} onDelete={removeGoal} />
          ) : (
            <SettingsTab
              household={household}
              profile={profile}
              members={members}
              categories={categories}
              accounts={accounts}
              onUpdateHouseholdName={updateHouseholdName}
              onInvite={inviteMember}
              onCreateCategory={createCategory}
              onUpdateCategory={editCategory}
              onDeleteCategory={removeCategory}
              onCreateAccount={createAccount}
              onUpdateAccount={editAccount}
              onDeleteAccount={removeAccount}
            />
          )}
        </div>
      </div>

      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        tabs={TABS}
        activeTab={tab}
        onSelect={setTab}
        household={household}
        profile={profile}
        onSignOut={signOut}
      />
    </div>
  );
}
