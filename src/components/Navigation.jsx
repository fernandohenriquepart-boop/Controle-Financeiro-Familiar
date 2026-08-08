import { useEffect, useRef } from "react";
import { Menu, X, LogOut, Wallet } from "lucide-react";
import { Avatar } from "./ui";

// Navegação: sidebar fixa no desktop (md+), header compacto + menu
// hambúrguer no mobile. Mesmos dados/handlers dos dois lados — só a
// marcação muda por breakpoint, sem detecção de viewport via JS.
// ---------------------------------------------------------------------------

function NavList({ tabs, activeTab, onSelect }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === t.id ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          <t.icon size={16} /> {t.label}
        </button>
      ))}
    </nav>
  );
}

function ProfileFooter({ profile, onSignOut }) {
  return (
    <div className="mt-auto border-t border-slate-200 p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Avatar name={profile.full_name} emoji={profile.avatar_emoji} size={24} />
        <span className="truncate text-xs text-slate-500">{profile.full_name}</span>
      </div>
      <button
        onClick={onSignOut}
        className="flex w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <LogOut size={13} /> Sair
      </button>
    </div>
  );
}

export function DesktopSidebar({ tabs, activeTab, onSelect, household, profile, onSignOut }) {
  return (
    <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-slate-200 md:bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Wallet size={16} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight text-slate-900">{household?.name}</h1>
          <p className="truncate text-[11px] text-slate-400">Controle Financeiro Familiar</p>
        </div>
      </div>
      <NavList tabs={tabs} activeTab={activeTab} onSelect={onSelect} />
      <ProfileFooter profile={profile} onSignOut={onSignOut} />
    </aside>
  );
}

export function MobileTopBar({ household, onOpenDrawer }) {
  return (
    <header
      className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 md:hidden"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      <button
        onClick={onOpenDrawer}
        aria-label="Abrir menu"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
      >
        <Menu size={18} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
          <Wallet size={14} />
        </div>
        <h1 className="truncate text-sm font-semibold text-slate-900">{household?.name}</h1>
      </div>
    </header>
  );
}

export function MobileNavDrawer({ isOpen, onClose, tabs, activeTab, onSelect, household, profile, onSignOut }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <div className={`fixed inset-0 z-50 md:hidden ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-white shadow-2xl outline-none transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5"
          style={{ paddingTop: "max(0.875rem, env(safe-area-inset-top))" }}
        >
          <span className="truncate text-sm font-semibold text-slate-900">{household?.name}</span>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <NavList
          tabs={tabs}
          activeTab={activeTab}
          onSelect={(id) => {
            onSelect(id);
            onClose();
          }}
        />
        <ProfileFooter profile={profile} onSignOut={onSignOut} />
      </div>
    </div>
  );
}
