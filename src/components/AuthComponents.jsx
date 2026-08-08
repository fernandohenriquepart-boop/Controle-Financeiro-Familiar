import { useState } from "react";
import { LogIn, UserPlus, Wallet } from "lucide-react";
import { inputClass, primaryButtonClass, Field } from "./ui";
import { signIn, signUp } from "../services/auth";

// Tela de login / cadastro — porta de entrada antes de qualquer dado carregar.
// ---------------------------------------------------------------------------

export function LoginScreen() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (mode === "signin") {
        await signIn(email, password);
        // sucesso: onAuthStateChange (em App.jsx) detecta a sessão e troca a tela sozinho
      } else {
        await signUp(email, password, fullName);
        setInfo("Conta criada. Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada antes de entrar.");
      }
    } catch (err) {
      setError(err.message || "Não foi possível concluir. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Wallet size={20} />
          </div>
          <h1 className="text-base font-semibold text-slate-900">Controle Financeiro Familiar</h1>
          <p className="text-xs text-slate-400">
            {mode === "signin"
              ? "Entre com sua conta para continuar."
              : "Crie sua conta — isso cria uma nova família, você pode convidar os outros depois."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <Field label="Seu nome">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`${inputClass} w-full`}
                placeholder="Seu nome"
              />
            </Field>
          )}
          <Field label="E-mail">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} w-full`}
              placeholder="voce@email.com"
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} w-full`}
              placeholder="••••••••"
            />
          </Field>

          {error && <p className="text-xs text-rose-600">{error}</p>}
          {info && <p className="text-xs text-emerald-600">{info}</p>}

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {mode === "signin" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {isSubmitting ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-700"
        >
          {mode === "signin" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
