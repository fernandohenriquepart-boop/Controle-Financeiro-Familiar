// Edge Function: cria (ou reaproveita) o cliente + a assinatura no Asaas pra
// família de quem chama, e devolve o link de pagamento (checkout hospedado
// pela própria Asaas) pro app abrir/redirecionar.
//
// Deploy: supabase functions deploy create-asaas-subscription
// Secrets: ASAAS_API_KEY (obrigatório), ASAAS_API_URL (opcional — default
// aponta pro sandbox, troque pra "https://api.asaas.com/v3" só quando for
// cobrar de verdade).
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBSCRIPTION_VALUE = 19.9;
const SUBSCRIPTION_DESCRIPTION = "Assinatura Controle Financeiro Familiar";

async function asaasFetch(path: string, apiUrl: string, apiKey: string, init: RequestInit = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: apiKey, ...(init.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas respondeu ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY")!;
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await callerClient
      .from("profiles")
      .select("household_id, role, full_name")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas o administrador da família pode assinar." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cpfCnpj, mobilePhone } = await req.json();
    if (!cpfCnpj) {
      return new Response(JSON.stringify({ error: "CPF é obrigatório pra criar a assinatura." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: household, error: householdError } = await admin
      .from("households")
      .select("id, name, asaas_customer_id, asaas_subscription_id")
      .eq("id", profile.household_id)
      .single();
    if (householdError || !household) throw householdError || new Error("Família não encontrada.");

    let customerId = household.asaas_customer_id;
    if (!customerId) {
      const customer = await asaasFetch("/customers", asaasApiUrl, asaasApiKey, {
        method: "POST",
        body: JSON.stringify({
          name: profile.full_name || household.name,
          email: user.email,
          cpfCnpj,
          mobilePhone: mobilePhone || undefined,
        }),
      });
      customerId = customer.id;
      await admin.from("households").update({ asaas_customer_id: customerId }).eq("id", household.id);
    }

    let subscriptionId = household.asaas_subscription_id;
    if (!subscriptionId) {
      const subscription = await asaasFetch("/subscriptions", asaasApiUrl, asaasApiKey, {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED", // deixa o pagador escolher Pix/boleto/cartão no checkout
          value: SUBSCRIPTION_VALUE,
          cycle: "MONTHLY",
          nextDueDate: new Date().toISOString().slice(0, 10),
          description: SUBSCRIPTION_DESCRIPTION,
        }),
      });
      subscriptionId = subscription.id;
      await admin.from("households").update({ asaas_subscription_id: subscriptionId }).eq("id", household.id);
    }

    const payments = await asaasFetch(`/payments?subscription=${subscriptionId}&status=PENDING`, asaasApiUrl, asaasApiKey);
    const checkoutUrl = payments?.data?.[0]?.invoiceUrl;
    if (!checkoutUrl) throw new Error("Assinatura criada, mas não achei um link de pagamento pendente.");

    return new Response(JSON.stringify({ success: true, checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-asaas-subscription error:", error);
    return new Response(JSON.stringify({ error: String((error as Error)?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
