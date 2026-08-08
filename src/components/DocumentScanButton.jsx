import { useRef, useState } from "react";
import { Camera, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { inputClass, secondaryButtonClass } from "./ui";
import { scanFile, extractFromText } from "../lib/documentScan";

/**
 * Botão de "escanear documento" (foto ou PDF) reutilizável — usado tanto no
 * formulário de conta a pagar (boleto) quanto no de lançamento (recibo).
 * Nunca escreve direto no formulário: só chama onExtracted(result) com o
 * que conseguiu ler, pra quem usa decidir o que pré-preencher.
 *
 * result: { source: 'pdf-text'|'ocr'|'manual', confidence: 'high'|'low',
 *           boleto, amount, date, description, rawText }
 */
export function DocumentScanButton({ label = "Escanear documento", onExtracted, allowManualLinhaDigitavel = false }) {
  const inputRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState(null); // { ok: boolean, message: string } | null
  const [manualLinha, setManualLinha] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsScanning(true);
    setStatus(null);
    try {
      const result = await scanFile(file);
      reportResult(result);
    } catch (err) {
      setStatus({ ok: false, message: "Não foi possível ler o arquivo. Tente outra foto ou preencha manualmente." });
      console.error("scanFile falhou:", err);
    } finally {
      setIsScanning(false);
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!manualLinha.trim()) return;
    const result = { ...extractFromText(manualLinha), source: "manual" };
    result.confidence = result.boleto?.valid ? "high" : "low";
    result.amount = result.boleto?.valid ? result.boleto.amount : null;
    result.date = result.boleto?.valid ? result.boleto.dueDate : null;
    result.description = result.boleto?.valid ? `Boleto — ${result.boleto.bankName}` : null;
    reportResult(result);
  }

  function reportResult(result) {
    if (result.boleto && !result.boleto.valid) {
      setStatus({ ok: false, message: result.boleto.reason });
      return;
    }
    if (result.amount == null && result.date == null) {
      setStatus({ ok: false, message: "Não encontramos valor nem data nesse documento — preencha manualmente." });
      return;
    }
    setStatus({
      ok: true,
      message:
        result.confidence === "high"
          ? "Dados encontrados e conferidos."
          : "Dados encontrados por OCR — confira antes de salvar.",
    });
    onExtracted(result);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isScanning}
          className={secondaryButtonClass + " disabled:opacity-60"}
        >
          {isScanning ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          {isScanning ? "Lendo documento..." : label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {allowManualLinhaDigitavel && (
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            value={manualLinha}
            onChange={(e) => setManualLinha(e.target.value)}
            placeholder="ou cole a linha digitável do boleto"
            className={`${inputClass} flex-1 text-xs`}
          />
          <button type="submit" className={secondaryButtonClass}>
            Usar
          </button>
        </form>
      )}

      {status && (
        <p className={`flex items-center gap-1.5 text-xs ${status.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {status.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {status.message}
        </p>
      )}
    </div>
  );
}
