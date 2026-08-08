import { supabase } from "./supabaseClient";

function mapFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    initialBalance: Number(row.initial_balance),
    creditLimit: row.credit_limit != null ? Number(row.credit_limit) : undefined,
    closingDay: row.closing_day ?? undefined,
    dueDay: row.due_day ?? undefined,
    createdAt: row.created_at,
  };
}

function mapToDb(account, householdId) {
  return {
    id: account.id,
    household_id: householdId,
    name: account.name,
    type: account.type ?? "corrente",
    initial_balance: account.initialBalance ?? 0,
    credit_limit: account.creditLimit ?? null,
    closing_day: account.closingDay ?? null,
    due_day: account.dueDay ?? null,
  };
}

export async function fetchAccounts(householdId) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(mapFromDb);
}

export async function insertAccount(account, householdId) {
  const { data, error } = await supabase.from("accounts").insert(mapToDb(account, householdId)).select().single();
  if (error) throw error;
  return mapFromDb(data);
}

export async function updateAccount(id, changes) {
  const row = {};
  if ("name" in changes) row.name = changes.name;
  if ("type" in changes) row.type = changes.type;
  if ("initialBalance" in changes) row.initial_balance = changes.initialBalance;
  if ("creditLimit" in changes) row.credit_limit = changes.creditLimit ?? null;
  if ("closingDay" in changes) row.closing_day = changes.closingDay ?? null;
  if ("dueDay" in changes) row.due_day = changes.dueDay ?? null;
  const { error } = await supabase.from("accounts").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteAccount(id) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}
