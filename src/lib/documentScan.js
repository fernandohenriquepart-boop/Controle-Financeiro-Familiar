// Extrai valor/vencimento/descrição de um boleto ou recibo, a partir de PDF
// (texto embutido) ou foto (OCR) — tudo roda no navegador, sem enviar nada
// pra nenhum servidor. pdfjs-dist e tesseract.js são importados sob demanda
// (só quando o usuário realmente escaneia algo) pra não pesar o bundle inicial.
import { parseLinhaDigitavel } from "./boleto.js";

// Restrito a espaço/ponto (não \s) pra não atravessar quebras de linha e
// grudar em números não relacionados de outras partes do documento.
const LINHA_DIGITAVEL_PATTERN = /\d[\d. ]{35,70}\d/g;
const VALOR_PATTERN = /R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/g;
const DATA_PATTERN = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;

function parseValorToken(token) {
  return Number(token.replace(/\./g, "").replace(",", "."));
}

function findLinhaDigitavelCandidates(text) {
  const matches = text.match(LINHA_DIGITAVEL_PATTERN) ?? [];
  const candidates = [];
  for (const match of matches) {
    const digits = match.replace(/\D/g, "");
    if (digits.length === 47 || digits.length === 48) candidates.push(digits);
  }
  return candidates;
}

function guessDescription(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.replace(/\D/g, "").length < l.length * 0.6); // não é uma linha majoritariamente numérica
  return lines[0]?.slice(0, 80) ?? null;
}

/** Procura linha digitável, valores em R$ e datas dentro de um texto já extraído. */
export function extractFromText(text) {
  const linhaDigitavelCandidates = findLinhaDigitavelCandidates(text);
  let boleto = null;
  for (const candidate of linhaDigitavelCandidates) {
    const result = parseLinhaDigitavel(candidate);
    if (result.valid) {
      boleto = result;
      break;
    }
    boleto = boleto ?? result; // guarda o primeiro erro, caso nenhum valide
  }

  const amountCandidates = [...text.matchAll(VALOR_PATTERN)].map((m) => parseValorToken(m[1]));
  const dateCandidates = [...text.matchAll(DATA_PATTERN)].map(
    (m) => new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  );

  return { boleto, amountCandidates, dateCandidates, rawText: text };
}

function normalize(extraction, source) {
  const { boleto, amountCandidates, dateCandidates, rawText } = extraction;
  const boletoValid = boleto?.valid === true;

  const amount = boletoValid ? boleto.amount : (amountCandidates[0] ?? null);
  const date = boletoValid ? boleto.dueDate : (dateCandidates[0] ?? null);
  const description = boletoValid ? `Boleto — ${boleto.bankName}` : guessDescription(rawText);

  const confidence = boletoValid || source === "pdf-text" ? "high" : "low";

  return {
    source,
    confidence,
    boleto,
    amount,
    date,
    description,
    rawText,
  };
}

export class PdfPasswordRequiredError extends Error {
  constructor(incorrect = false) {
    super(incorrect ? "Senha incorreta." : "Este PDF é protegido por senha.");
    this.name = "PdfPasswordRequiredError";
    this.incorrect = incorrect;
  }
}

/** Extrai o texto de um PDF. Se ele pedir senha e nenhuma (ou uma errada) foi
 * passada, lança PdfPasswordRequiredError em vez de deixar o erro genérico
 * do pdfjs vazar — quem chama decide se quer pedir a senha pro usuário. */
export async function extractPdfText(file, password) {
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: buffer, password }).promise;
  } catch (err) {
    if (err?.name === "PasswordException") {
      throw new PdfPasswordRequiredError(err.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD);
    }
    throw err;
  }
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return text;
}

async function extractImageText(file) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Recebe um File (foto ou PDF) e retorna os dados extraídos, já normalizados
 * pra pré-preencher um formulário. Nunca lança erro fatal — se não conseguir
 * extrair nada, retorna campos vazios com confidence "low".
 */
export async function scanFile(file) {
  const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
  const source = isPdf ? "pdf-text" : "ocr";
  const text = isPdf ? await extractPdfText(file) : await extractImageText(file);
  return normalize(extractFromText(text), source);
}
