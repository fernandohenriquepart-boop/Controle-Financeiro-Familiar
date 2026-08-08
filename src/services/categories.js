import { supabase } from "./supabaseClient";

function mapFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    colorId: row.color_id,
    icon: row.icon ?? undefined,
    isDefault: row.is_default,
  };
}

function mapToDb(category, householdId) {
  return {
    id: category.id,
    household_id: householdId,
    name: category.name,
    type: category.type,
    color_id: category.colorId ?? "slate",
    icon: category.icon ?? null,
  };
}

export async function fetchCategories(householdId) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data.map(mapFromDb);
}

export async function insertCategory(category, householdId) {
  const { data, error } = await supabase
    .from("categories")
    .insert(mapToDb(category, householdId))
    .select()
    .single();
  if (error) throw error;
  return mapFromDb(data);
}

export async function updateCategory(id, changes) {
  const row = {};
  if ("name" in changes) row.name = changes.name;
  if ("type" in changes) row.type = changes.type;
  if ("colorId" in changes) row.color_id = changes.colorId;
  if ("icon" in changes) row.icon = changes.icon ?? null;
  const { error } = await supabase.from("categories").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
