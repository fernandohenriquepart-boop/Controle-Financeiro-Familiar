import { supabase } from "./supabaseClient";

function mapFromDb(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    month: row.month,
    limitAmount: Number(row.limit_amount),
  };
}

export async function fetchBudgets(householdId, month) {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("household_id", householdId)
    .eq("month", month);
  if (error) throw error;
  return data.map(mapFromDb);
}

export async function upsertBudget(budget, householdId) {
  const { error } = await supabase.from("budgets").upsert(
    {
      household_id: householdId,
      category_id: budget.categoryId,
      month: budget.month,
      limit_amount: budget.limitAmount,
    },
    { onConflict: "household_id,category_id,month" }
  );
  if (error) throw error;
}

export async function deleteBudget(id) {
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
}
