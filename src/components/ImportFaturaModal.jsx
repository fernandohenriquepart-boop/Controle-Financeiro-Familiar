import { useRef, useState } from "react";
import { Upload, Loader2, AlertTriangle, Lock } from "lucide-react";
import { Modal, Field, EmptyState, Badge, inputClass, primaryButtonClass, secondaryButtonClass } from "./ui";
import { extractPdfText, PdfPasswordRequiredError } from "../lib/documentScan";
import { parseFatura } from "../lib/faturaParsers";
import { toDateInputValue } from "../domain";

function isDuplicate(row, accountId, existingTransactions) {
  const rowTime = new Date(row.date).getTime();
  return existingTransactions.some((t) => {
    if (t.accountId !== accountId) return false;
    if (Math.abs(t.amount - row.amount) > 0.005) return false;
    const diffDays = Math.abs(new Date(t.date).getTime() - rowTime) / 86400000;
    return diffDays <= 3;
  });
}

function guessCategoryId(hint, categories) {
  if (!hint) return "";
  const match = categories.find(
    (c) => c.type === "expense" && (c.name.toLowerCase().includes(hint) || hint.includes(c.name.toLowerCase()))
  );
  return match?.id ?? "";
}

export function ImportFaturaModal({ isOpen, onClose, cardAccounts, categories, transactions, onImport }) {
  const fileInputRef = useRef(null);
  const [accountId, setAccountId] = useState(cardAccounts[0]?.id ?? "");
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [bankLabel, setBankLabel] = useState("");
  const [rows, setRows] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  function reset() {
    setFile(null);
    setPassword("");
    setNeedsPassword(false);
    setPasswordError("");
    setError("");
    setBankLabel("");
    setRows(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function runParse(text) {
    const result = parseFatura(text);
    if (result.error || result.transactions.length === 0) {
      setError(result.error || "Não encontrei nenhum lançamento nessa fatura.");
      return;
    }
    if (!result.vencimentoDate) {
      setError("Não encontrei a data de vencimento dessa fatura.");
      return;
    }
    setBankLabel(result.bankLabel);
    // A data que fica salva é a do vencimento da fatura (mesmo mês que a
    // "Nova compra" manual já usa), não a data exata da compra — assim o
    // lançamento aparece no mês em que a fatura realmente cai, não no mês em
    // que a compra foi feita. A data de compra fica só como referência.
    const vencimento = toDateInputValue(result.vencimentoDate);
    setRows(
      result.transactions.map((t, i) => {
        // Compara pela data da fatura (não pela data de compra) — reimportar
        // a mesma fatura duas vezes deve gerar a mesma data de vencimento
        // sempre, então é isso que detecta a duplicata de forma confiável.
        const duplicate = isDuplicate({ date: vencimento, amount: t.amount }, accountId, transactions);
        return {
          id: i,
          included: !duplicate,
          duplicate,
          date: vencimento,
          purchaseDate: toDateInputValue(t.date),
          description: t.description,
          amount: String(t.amount),
          categoryId: guessCategoryId(t.category, categories),
          installment: t.installment,
        };
      })
    );
  }

  async function handleFile(e) {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;
    setFile(selected);
    setError("");
    setNeedsPassword(false);
    setIsProcessing(true);
    try {
      const text = await extractPdfText(selected);
      await runParse(text);
    } catch (err) {
      if (err instanceof PdfPasswordRequiredError) {
        setNeedsPassword(true);
      } else {
        setError(err.message || "Não foi possível ler o PDF.");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError("");
    setIsProcessing(true);
    try {
      const text = await extractPdfText(file, password);
      setNeedsPassword(false);
      await runParse(text);
    } catch (err) {
      if (err instanceof PdfPasswordRequiredError) {
        setPasswordError(err.incorrect ? "Senha incorreta, tente de novo." : "Este PDF pede senha.");
      } else {
        setError(err.message || "Não foi possível ler o PDF.");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  function updateRow(id, changes) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  async function handleImport() {
    const included = rows.filter((r) => r.included);
    if (included.length === 0) return;
    setIsImporting(true);
    try {
      const plainTransactions = included
        .filter((r) => !r.installment)
        .map((r) => ({ accountId, categoryId: r.categoryId, description: r.description, amount: Number(r.amount), date: r.date }));
      const installmentPurchases = included
        .filter((r) => r.installment)
        .map((r) => ({
          accountId,
          categoryId: r.categoryId,
          description: r.description,
          installmentAmount: Number(r.amount),
          currentInstallment: r.installment.current,
          totalInstallments: r.installment.total,
          currentDate: r.date,
        }));
      await onImport({ plainTransactions, installmentPurchases });
      handleClose();
    } catch (err) {
      setError(err.message || "Não foi possível importar.");
    } finally {
      setIsImporting(false);
    }
  }

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const includedCount = rows?.filter((r) => r.included).length ?? 0;

  return (
    <Modal title="Importar fatura" isOpen={isOpen} onClose={handleClose} wide>
      <div className="flex flex-col gap-3">
        <Field label="Cartão desta fatura">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputClass} w-full`}>
            {cardAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        {!rows && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className={secondaryButtonClass + " justify-center disabled:opacity-60"}
            >
              {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {isProcessing ? "Lendo fatura..." : file ? file.name : "Selecionar PDF da fatura"}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFile} className="hidden" />

            {needsPassword && (
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <Lock size={13} /> Esse PDF é protegido por senha.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha do PDF"
                    className={`${inputClass} flex-1`}
                  />
                  <button type="submit" disabled={isProcessing} className={secondaryButtonClass}>
                    {isProcessing ? "Tentando..." : "Confirmar"}
                  </button>
                </div>
                {passwordError && <p className="text-xs text-rose-600">{passwordError}</p>}
              </form>
            )}

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600">
                <AlertTriangle size={12} /> {error}
              </p>
            )}
          </>
        )}

        {rows && (
          <>
            <p className="text-xs text-slate-500">
              Banco identificado: <strong>{bankLabel}</strong> · {rows.length} lançamento{rows.length !== 1 ? "s" : ""} encontrado
              {rows.length !== 1 ? "s" : ""}, {includedCount} selecionado{includedCount !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-slate-400">
              Todos os lançamentos entram no mês de vencimento desta fatura
              {rows[0] ? ` (${new Date(rows[0].date + "T00:00:00").toLocaleDateString("pt-BR")})` : ""} — a data de compra
              original aparece só como referência abaixo da descrição.
            </p>
            <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="p-2"></th>
                    <th className="p-2">Data (fatura)</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2">Valor</th>
                    <th className="p-2">Categoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className={row.included ? "" : "opacity-50"}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={(e) => updateRow(row.id, { included: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, { date: e.target.value })}
                          className={`${inputClass} w-32 !py-1`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(row.id, { description: e.target.value })}
                          className={`${inputClass} w-full !py-1`}
                        />
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-[11px] text-slate-400">
                            compra em {new Date(row.purchaseDate + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                          {row.installment && (
                            <Badge className="border border-violet-200 bg-violet-50 text-violet-700">
                              {row.installment.current}/{row.installment.total} parcelas
                            </Badge>
                          )}
                          {row.duplicate && (
                            <Badge className="border border-amber-200 bg-amber-50 text-amber-700">possível duplicata</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                          className={`${inputClass} w-24 !py-1`}
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={row.categoryId}
                          onChange={(e) => updateRow(row.id, { categoryId: e.target.value })}
                          className={`${inputClass} w-full !py-1`}
                        >
                          <option value="">Sem categoria</option>
                          {expenseCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600">
                <AlertTriangle size={12} /> {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={reset} className={secondaryButtonClass}>
                Trocar arquivo
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || includedCount === 0}
                className={primaryButtonClass + " disabled:opacity-60"}
              >
                {isImporting ? "Importando..." : `Importar ${includedCount} selecionado${includedCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}

        {cardAccounts.length === 0 && (
          <EmptyState title="Nenhum cartão cadastrado" description="Cadastre um cartão em Configurações primeiro." />
        )}
      </div>
    </Modal>
  );
}
