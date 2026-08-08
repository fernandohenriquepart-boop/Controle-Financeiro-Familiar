import { supabase } from "./supabaseClient";

export async function fetchHousehold(householdId) {
  const { data, error } = await supabase.from("households").select("*").eq("id", householdId).single();
  if (error) throw error;
  return { id: data.id, name: data.name, ownerId: data.owner_id, createdAt: data.created_at };
}

export async function updateHouseholdName(householdId, name) {
  const { error } = await supabase.from("households").update({ name }).eq("id", householdId);
  if (error) throw error;
}

export async function fetchMembers(householdId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_emoji, is_active")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    avatarEmoji: row.avatar_emoji ?? undefined,
    isActive: row.is_active,
  }));
}

export async function updateMember(id, changes) {
  const row = {};
  if ("fullName" in changes) row.full_name = changes.fullName;
  if ("role" in changes) row.role = changes.role;
  if ("avatarEmoji" in changes) row.avatar_emoji = changes.avatarEmoji ?? null;
  if ("isActive" in changes) row.is_active = changes.isActive;
  const { error } = await supabase.from("profiles").update(row).eq("id", id);
  if (error) throw error;
}
