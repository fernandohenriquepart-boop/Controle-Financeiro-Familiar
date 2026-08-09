import { supabase } from "./supabaseClient";

function mapFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    targetDate: row.target_date ?? undefined,
    colorId: row.color_id,
    accountId: row.account_id ?? undefined,
    createdAt: row.created_at,
  };
}

function mapToDb(goal, householdId) {
  return {
    id: goal.id,
    household_id: householdId,
    name: goal.name,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount ?? 0,
    target_date: goal.targetDate || null,
    color_id: goal.colorId ?? "emerald",
    account_id: goal.accountId || null,
  };
}

export async function fetchGoals(householdId) {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(mapFromDb);
}

export async function insertGoal(goal, householdId) {
  const { data, error } = await supabase.from("goals").insert(mapToDb(goal, householdId)).select().single();
  if (error) throw error;
  return mapFromDb(data);
}

export async function updateGoal(id, changes) {
  const row = {};
  if ("name" in changes) row.name = changes.name;
  if ("targetAmount" in changes) row.target_amount = changes.targetAmount;
  if ("currentAmount" in changes) row.current_amount = changes.currentAmount;
  if ("targetDate" in changes) row.target_date = changes.targetDate || null;
  if ("colorId" in changes) row.color_id = changes.colorId;
  if ("accountId" in changes) row.account_id = changes.accountId || null;
  const { error } = await supabase.from("goals").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
