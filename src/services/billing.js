import { supabase } from "./supabaseClient";

/** Cria (ou reaproveita) a assinatura no Asaas e devolve o link de pagamento (checkout). */
export async function createAsaasSubscription({ cpfCnpj, mobilePhone }) {
  const { data, error } = await supabase.functions.invoke("create-asaas-subscription", {
    body: { cpfCnpj, mobilePhone },
  });
  if (error) throw error;
  return data;
}
