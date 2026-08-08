import { supabase } from "./supabaseClient";

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, household_id, full_name, role, avatar_emoji, is_active")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function inviteMember(email, fullName) {
  const { data, error } = await supabase.functions.invoke("invite-member", {
    body: { email, fullName },
  });
  if (error) throw error;
  return data;
}
