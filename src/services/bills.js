import { supabase } from "./supabaseClient";

function mapFromDb(row) {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    categoryId: row.category_id ?? undefined,
    accountId: row.account_id ?? undefined,
    isRecurring: row.is_recurring,
    recurrenceRule: row.recurrence_rule ?? undefined,
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapToDb(bill, householdId) {
  return {
    id: bill.id,
    household_id: householdId,
    type: bill.type,
    description: bill.description,
    amount: bill.amount,
    due_date: bill.dueDate,
    status: bill.status ?? "pending",
    category_id: bill.categoryId || null,
    account_id: bill.accountId || null,
    is_recurring: bill.isRecurring ?? false,
    recurrence_rule: bill.recurrenceRule || null,
    paid_at: bill.paidAt || null,
  };
}

export async function fetchBills(householdId) {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("household_id", householdId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data.map(mapFromDb);
}

export async function insertBill(bill, householdId) {
  const { data, error } = await supabase.from("bills").insert(mapToDb(bill, householdId)).select().single();
  if (error) throw error;
  return mapFromDb(data);
}

export async function updateBill(id, changes) {
  const row = {};
  if ("type" in changes) row.type = changes.type;
  if ("description" in changes) row.description = changes.description;
  if ("amount" in changes) row.amount = changes.amount;
  if ("dueDate" in changes) row.due_date = changes.dueDate;
  if ("status" in changes) row.status = changes.status;
  if ("categoryId" in changes) row.category_id = changes.categoryId || null;
  if ("accountId" in changes) row.account_id = changes.accountId || null;
  if ("isRecurring" in changes) row.is_recurring = changes.isRecurring;
  if ("recurrenceRule" in changes) row.recurrence_rule = changes.recurrenceRule || null;
  if ("paidAt" in changes) row.paid_at = changes.paidAt || null;
  const { error } = await supabase.from("bills").update(row).eq("id", id);
  if (error) throw error;
}

export async function markBillPaid(id, paidAt = new Date().toISOString()) {
  const { error } = await supabase.from("bills").update({ status: "paid", paid_at: paidAt }).eq("id", id);
  if (error) throw error;
}

export async function deleteBill(id) {
  const { error } = await supabase.from("bills").delete().eq("id", id);
  if (error) throw error;
}
