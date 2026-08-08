import { supabase } from "./supabaseClient";
import { insertTransactionsBulk } from "./transactions";
import { buildInstallmentSchedule, buildRecurringSchedule, monthlyDates } from "../lib/installments";

const INDEFINITE_HORIZON_MONTHS = 24;
const INDEFINITE_MIN_MONTHS_AHEAD = 12;

function mapFromDb(row) {
  return {
    id: row.id,
    kind: row.kind,
    type: row.type,
    description: row.description,
    categoryId: row.category_id ?? undefined,
    accountId: row.account_id ?? undefined,
    totalAmount: row.total_amount != null ? Number(row.total_amount) : undefined,
    installmentAmount: Number(row.installment_amount),
    installmentCount: row.installment_count ?? undefined,
    installmentsGenerated: row.installments_generated,
    startDate: row.start_date,
    createdAt: row.created_at,
  };
}

export async function fetchSeries(householdId) {
  const { data, error } = await supabase
    .from("recurring_series")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapFromDb);
}

async function insertSeriesRow(series, householdId) {
  const { data, error } = await supabase
    .from("recurring_series")
    .insert({
      household_id: householdId,
      kind: series.kind,
      type: series.type,
      description: series.description,
      category_id: series.categoryId || null,
      account_id: series.accountId || null,
      total_amount: series.totalAmount ?? null,
      installment_amount: series.installmentAmount,
      installment_count: series.installmentCount ?? null,
      installments_generated: series.installmentsGenerated,
      start_date: series.startDate,
    })
    .select()
    .single();
  if (error) throw error;
  return mapFromDb(data);
}

/** Cria uma compra parcelada de cartão: a série + as N transações já materializadas. */
export async function createInstallmentPurchase(
  { description, totalAmount, count, categoryId, accountId, dueDay, purchaseDate },
  householdId
) {
  const schedule = buildInstallmentSchedule({ purchaseDate: new Date(purchaseDate), dueDay, count, totalAmount });
  const series = await insertSeriesRow(
    {
      kind: "installment",
      type: "expense",
      description,
      categoryId,
      accountId,
      totalAmount,
      installmentAmount: schedule[0]?.amount ?? 0,
      installmentCount: count,
      installmentsGenerated: count,
      startDate: purchaseDate,
    },
    householdId
  );
  const transactions = schedule.map((s, i) => ({
    type: "expense",
    accountId,
    categoryId,
    amount: s.amount,
    description: `${description} (${i + 1}/${count})`,
    date: s.date.toISOString().slice(0, 10),
    isRecurring: true,
    seriesId: series.id,
  }));
  await insertTransactionsBulk(transactions, householdId);
  return series;
}

/** Cria uma despesa/receita recorrente: a série + as ocorrências já materializadas
 * (limitadas a INDEFINITE_HORIZON_MONTHS quando count é null / sem fim). */
export async function createRecurringTransaction(
  { type, amount, description, categoryId, accountId, startDate, count },
  householdId
) {
  const toGenerate = count ?? INDEFINITE_HORIZON_MONTHS;
  const schedule = buildRecurringSchedule({ startDate: new Date(startDate), count: toGenerate, amount });
  const series = await insertSeriesRow(
    {
      kind: "recurring",
      type,
      description,
      categoryId,
      accountId,
      installmentAmount: amount,
      installmentCount: count ?? null,
      installmentsGenerated: toGenerate,
      startDate,
    },
    householdId
  );
  const transactions = schedule.map((s) => ({
    type,
    accountId,
    categoryId,
    amount: s.amount,
    description,
    date: s.date.toISOString().slice(0, 10),
    isRecurring: true,
    seriesId: series.id,
  }));
  await insertTransactionsBulk(transactions, householdId);
  return series;
}

export async function deleteSeries(id) {
  // Cascade no banco (transactions.series_id on delete cascade) remove as parcelas junto.
  const { error } = await supabase.from("recurring_series").delete().eq("id", id);
  if (error) throw error;
}

async function updateInstallmentsGenerated(id, count) {
  const { error } = await supabase.from("recurring_series").update({ installments_generated: count }).eq("id", id);
  if (error) throw error;
}

/**
 * Roda uma vez por carregamento do app: para cada série "sem fim" que não
 * cobre mais os próximos INDEFINITE_MIN_MONTHS_AHEAD meses, gera as
 * transações que faltam até completar o horizonte de novo.
 */
export async function extendIndefiniteSeries(householdId) {
  const allSeries = await fetchSeries(householdId);
  const indefinite = allSeries.filter((s) => s.kind === "recurring" && s.installmentCount == null);

  const horizonCutoff = new Date();
  horizonCutoff.setMonth(horizonCutoff.getMonth() + INDEFINITE_MIN_MONTHS_AHEAD);

  for (const series of indefinite) {
    const generatedDates = monthlyDates(new Date(series.startDate), series.installmentsGenerated);
    const lastGeneratedDate = generatedDates[generatedDates.length - 1];
    if (lastGeneratedDate && lastGeneratedDate >= horizonCutoff) continue;

    const newHorizonCount = series.installmentsGenerated + INDEFINITE_HORIZON_MONTHS;
    const fullSchedule = monthlyDates(new Date(series.startDate), newHorizonCount);
    const missing = fullSchedule.slice(series.installmentsGenerated);
    if (missing.length === 0) continue;

    const transactions = missing.map((date) => ({
      type: series.type,
      accountId: series.accountId,
      categoryId: series.categoryId,
      amount: series.installmentAmount,
      description: series.description,
      date: date.toISOString().slice(0, 10),
      isRecurring: true,
      seriesId: series.id,
    }));
    await insertTransactionsBulk(transactions, householdId);
    await updateInstallmentsGenerated(series.id, newHorizonCount);
  }
}
