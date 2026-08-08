import { supabase } from "./supabaseClient";

function mapFromDb(row) {
  return {
    id: row.id,
    accountId: row.account_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    type: row.type,
    amount: Number(row.amount),
    description: row.description ?? "",
    date: row.date,
    isRecurring: row.is_recurring,
    recurrenceRule: row.recurrence_rule ?? undefined,
    createdBy: row.created_by ?? undefined,
    seriesId: row.series_id ?? undefined,
    createdAt: row.created_at,
  };
}

function mapToDb(transaction, householdId) {
  return {
    id: transaction.id,
    household_id: householdId,
    account_id: transaction.accountId || null,
    category_id: transaction.categoryId || null,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description ?? "",
    date: transaction.date,
    is_recurring: transaction.isRecurring ?? false,
    recurrence_rule: transaction.recurrenceRule || null,
    created_by: transaction.createdBy || null,
    series_id: transaction.seriesId || null,
  };
}

export async function fetchTransactions(householdId, { from, to } = {}) {
  let query = supabase.from("transactions").select("*").eq("household_id", householdId);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  const { data, error } = await query.order("date", { ascending: false });
  if (error) throw error;
  return data.map(mapFromDb);
}

export async function insertTransaction(transaction, householdId) {
  const { data, error } = await supabase
    .from("transactions")
    .insert(mapToDb(transaction, householdId))
    .select()
    .single();
  if (error) throw error;
  return mapFromDb(data);
}

export async function insertTransactionsBulk(transactions, householdId) {
  const { data, error } = await supabase
    .from("transactions")
    .insert(transactions.map((t) => mapToDb(t, householdId)))
    .select();
  if (error) throw error;
  return data.map(mapFromDb);
}

export async function updateTransaction(id, changes) {
  const row = {};
  if ("accountId" in changes) row.account_id = changes.accountId || null;
  if ("categoryId" in changes) row.category_id = changes.categoryId || null;
  if ("type" in changes) row.type = changes.type;
  if ("amount" in changes) row.amount = changes.amount;
  if ("description" in changes) row.description = changes.description ?? "";
  if ("date" in changes) row.date = changes.date;
  if ("isRecurring" in changes) row.is_recurring = changes.isRecurring;
  if ("recurrenceRule" in changes) row.recurrence_rule = changes.recurrenceRule || null;
  const { error } = await supabase.from("transactions").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
